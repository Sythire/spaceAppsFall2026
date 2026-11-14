# LunarSite Explorer
Frontend foundation for a six-person NASA Space Apps team.

## Local setup
Requires Node 22.12+ and npm 10+. From this repository:
```sh
npm ci
npm run dev
```
Open http://127.0.0.1:5173 (or the port Vite prints).
On Windows, stop this project's dev servers with Ctrl+C before running `npm ci`.
Vite/Tailwind can hold native dependency files open; reinstalling while a server
is running can cause `EPERM: operation not permitted, unlink` errors.
Run `npm ci` once for setup or after lockfile changes; normally use only `npm run dev`.
`npm run build` runs strict TypeScript checks and builds `frontend/dist`.
`npm test` checks fixture contracts. `npm run preview` serves the production build.
You can also run these commands inside frontend.

## What works
Five routed pages, responsive dark dashboard, navigation collapse, global UTC input, candidate/custom coordinate selection, stackable layer selection state, simulated analysis charts, and two/three-site comparisons. Service methods support mock or backend modes. Loading, retry, error and empty states are provided.

**All candidates, analysis metrics and charts are simulated.** No NASA dataset or Cesium renderer is connected. No fake scientific calculation or suitability score is implemented. Mock metrics intentionally do not change with time.

## Structure
- frontend/: React, TypeScript, Vite, Tailwind CSS, React Router, Lucide and Recharts.
- backend/: backend handoff.
- data/: product ingestion handoff.
- docs/: architecture, integration contracts, contributor guidelines and original requirements.

This existing checkout is the project root; no redundant lunar-site-explorer wrapper directory is added.

## Team handoff
Start at [docs/README.md](docs/README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).
Copy frontend/.env.example to frontend/.env.local to configure a service. VITE_USE_MOCKS defaults to true. Set false explicitly for backend mode. Never place secrets in VITE_ variables.

BrowserRouter requires production hosting to rewrite non-file routes to index.html.
No deployment or push is performed as part of this local-only task.
