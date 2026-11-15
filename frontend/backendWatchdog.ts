/**
 * Vite dev-server plugin: keeps the Python SPICE backend running while the web app is running.
 *
 * - Every 5 s it calls the backend's /health endpoint (address from VITE_API_BASE_URL).
 * - If nothing answers and it isn't already running one, it starts uvicorn in backend/
 *   (backend/.venv's Python if present, otherwise `python` on PATH) with --reload, so backend
 *   code edits restart it automatically.
 * - If that process exits or crashes, it is started again, waiting longer after repeated failures
 *   (5 s, 10 s, 20 s … up to 60 s) so a broken backend doesn't spin.
 * - When the dev server stops, the backend it started is stopped too. A backend started by someone
 *   else (a terminal, `npm run dev:local`) is only watched, never started twice or killed.
 * - Disable with LUNARSITE_BACKEND=external (set by scripts/dev-local.mjs, which manages its own).
 *
 * Dev-only: `vite build` / `vite preview` are unaffected.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

export function backendWatchdog(apiBaseUrl: string | undefined): Plugin {
  return {
    name: 'lunarsite-backend-watchdog',
    apply: 'serve',
    configureServer(server) {
      if (process.env.LUNARSITE_BACKEND === 'external') return;
      let base: URL;
      try { base = new URL(apiBaseUrl || 'http://127.0.0.1:8000/api/v1'); } catch { return; }
      if (!['127.0.0.1', 'localhost'].includes(base.hostname)) return; // only manage a local backend
      const healthUrl = base.href.replace(/\/$/, '') + '/health';
      const port = base.port || '8000';
      const backendDir = path.resolve(server.config.root, '..', 'backend');
      const venvPython = path.join(backendDir, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
      const python = existsSync(venvPython) ? venvPython : process.platform === 'win32' ? 'python' : 'python3';
      const log = (msg: string) => server.config.logger.info(`[backend] ${msg}`, { timestamp: true });

      let child: ChildProcess | null = null;
      let failures = 0;
      let nextStartAt = 0;
      let stopping = false;

      const healthy = async () => {
        try {
          const r = await fetch(healthUrl, { signal: AbortSignal.timeout(2500) });
          return r.ok;
        } catch { return false; }
      };

      const start = () => {
        log(`not responding at ${healthUrl}; starting uvicorn (${python === venvPython ? 'backend/.venv' : python})`);
        const proc = spawn(python, ['-u', '-m', 'uvicorn', 'api.main:app', '--host', base.hostname === 'localhost' ? '127.0.0.1' : base.hostname,
          '--port', port, '--reload', '--reload-dir', 'api'], { cwd: backendDir, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
        child = proc;
        // Relay backend output, minus the watchdog's own 5-second health checks.
        const relay = (data: Buffer) => { for (const line of data.toString().split(/\r?\n/)) if (line.trim() && !line.includes('/health')) log(line); };
        proc.stdout?.on('data', relay);
        proc.stderr?.on('data', relay);
        proc.once('error', err => { log(`could not start: ${err.message}`); });
        proc.once('exit', code => {
          if (child === proc) child = null;
          if (stopping) return;
          failures += 1;
          const wait = Math.min(60, 5 * 2 ** (failures - 1));
          nextStartAt = Date.now() + wait * 1000;
          log(`stopped (exit ${code}); restarting in ${wait} s`);
        });
      };

      const check = async () => {
        if (stopping) return;
        if (await healthy()) { failures = 0; return; }
        if (!child && Date.now() >= nextStartAt) start();
      };

      const kill = () => {
        stopping = true;
        clearInterval(timer);
        const proc = child;
        child = null;
        if (!proc || proc.exitCode !== null || proc.pid === undefined) return;
        if (process.platform === 'win32') {
          // --reload runs a reloader plus a worker; stop the whole tree we started (and only that).
          spawn('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
        } else {
          proc.kill('SIGTERM');
        }
      };

      const timer = setInterval(() => { void check(); }, 5000);
      void check();
      server.httpServer?.once('close', kill);
      process.once('exit', kill);
      for (const sig of ['SIGINT', 'SIGTERM'] as const) process.once(sig, () => { kill(); process.exit(0); });
    },
  };
}
