import { defineConfig, loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { backendWatchdog } from './backendWatchdog';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  // In `npm run dev`, keep the local Python SPICE backend running and restart it if it stops.
  return { plugins: [tailwindcss(), backendWatchdog(env.VITE_API_BASE_URL)] };
});
