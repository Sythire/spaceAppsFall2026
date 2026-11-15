import { spawn } from 'node:child_process';
import { existsSync, copyFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const windows = process.platform === 'win32';
const python = path.join(root, 'backend/.venv', windows ? 'Scripts/python.exe' : 'bin/python');
const vite = path.join(root, 'node_modules/vite/bin/vite.js');
const children = [];
let stopping = false;

async function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  await Promise.all(children.filter(child => child.exitCode === null).map(child => new Promise(resolve => {
    if (windows) {
      // Include the venv Python redirector's child; never stop unrelated process trees.
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    } else {
      child.once('exit', resolve);
      child.kill('SIGTERM');
      setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000).unref();
    }
  })));
  process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { void stop(0); });

function launch(command, args, cwd, env = process.env) {
  const child = spawn(command, args, { cwd, env, stdio: 'inherit', windowsHide: true });
  children.push(child);
  child.once('error', error => { console.error(error.message); void stop(1); });
  child.once('exit', code => {
    if (!stopping) { console.error(`A local server stopped (exit ${code}). Stopping the other server.`); void stop(code || 1); }
  });
}
function assertFree(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Port ${port} is unavailable. Stop the existing project server with Ctrl+C, then retry. No existing processes were stopped.`)));
    server.listen({ host: '127.0.0.1', port, exclusive: true }, () => server.close(resolve));
  });
}

try {
  if (!existsSync(vite)) throw new Error('Frontend dependencies are missing. Run npm ci at the repository root.');
  if (!existsSync(python)) throw new Error('Create backend/.venv and install backend/requirements.txt; see README.md.');
  await assertFree(8000);
  await assertFree(5173);
  const env = path.join(root, 'frontend/.env.local');
  if (!existsSync(env)) {
    copyFileSync(path.join(root, 'frontend/.env.example'), env);
    console.log('Created frontend/.env.local from the example.');
  }
  console.log('Starting SPICE backend on http://127.0.0.1:8000 ...');
  launch(python, ['-u', '-m', 'uvicorn', 'api.main:app', '--host', '127.0.0.1', '--port', '8000'], path.join(root, 'backend'));
  const deadline = Date.now() + 30000;
  let ready = false;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/v1/health', { signal: AbortSignal.timeout(2000) });
      const health = response.ok ? await response.json() : null;
      if (health?.status === 'ok') { ready = true; break; }
    } catch { /* Python startup and kernel loading can take a moment. */ }
    await new Promise(resolve => setTimeout(resolve, 400));
  }
  if (!ready) throw new Error('Backend failed its startup health check. Read the Python error above and check SPICE kernels.');
  // This script manages the backend itself, so switch off the Vite backend watchdog.
  launch(process.execPath, [vite, '--host', '127.0.0.1', '--port', '5173', '--strictPort'], path.join(root, 'frontend'),
    { ...process.env, LUNARSITE_BACKEND: 'external' });
  console.log('\nWebsite: http://127.0.0.1:5173/\nAPI docs: http://127.0.0.1:8000/docs\nKeep this terminal open. Ctrl+C stops BOTH servers.\n');
} catch (error) {
  console.error(`\nLocal startup failed: ${error.message}`);
  await stop(1);
}
