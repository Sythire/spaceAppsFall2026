# Moonwalk / LunarSite Explorer

NASA Space Apps lunar landing-site workspace: a 3D explorer, live SPICE analysis, site comparison, scientific layers, a Moon tour and mission guide.

## Already set up? Start here

If this checkout already has its dependencies and Python environment, run only:

```powershell
npm run dev:local
```

**Do not rerun `npm ci` while the app is running.** First press **Ctrl+C in the terminal running the servers**. On Windows, Vite locks the native `lightningcss` file; `npm ci` deletes and recreates dependencies, so it fails with `EPERM` until Vite stops. If an assistant started your servers, ask it to stop them before reinstalling.

The setup sections below are for a new checkout. You do not need to recreate the virtual environment or reinstall dependencies on every startup.

## Prerequisites

- Node.js 22.12+ and npm 10+ (tested locally with Node 22.18).
- Python 3.11+ with pip and venv (tested locally with Python 3.14).
- Git and internet access for initial installs and externally hosted imagery/model-viewer.
- Run all setup commands from the **repository root**.

## First-time setup: Windows PowerShell

Stop any existing servers for this checkout before running these installation commands.

```powershell
git clone https://github.com/Sythire/spaceAppsFall2026.git
cd spaceAppsFall2026
git switch main
npm ci
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
Copy-Item frontend/.env.example frontend/.env.local
npm run dev:local
```

If you already have the checkout, enter its folder, commit or stash your changes, then run `git pull --ff-only origin main` instead of cloning. Preserve existing `.env.local` customizations. Virtual-environment activation is unnecessary with the explicit Python path above.

## First-time setup: macOS / Linux

```sh
git clone https://github.com/Sythire/spaceAppsFall2026.git
cd spaceAppsFall2026
git switch main
npm ci
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
cp frontend/.env.example frontend/.env.local
npm run dev:local
```

## Everyday startup: one terminal

```sh
npm run dev:local
```

Open [the website](http://127.0.0.1:5173/) or [Lunar Explorer](http://127.0.0.1:5173/explorer).

The launcher starts the backend, waits for its SPICE health check, then starts Vite on a fixed port. Keep the terminal open. **Ctrl+C stops both servers.** If a server fails, the other is stopped. Occupied ports produce an error instead of silently changing ports or killing unrelated processes. The launcher creates `frontend/.env.local` from the example only if missing; it never installs dependencies automatically.

After pulling changes, stop the servers first. Run `npm ci` when the lockfile changes and the pip install command when backend requirements change. Restart the launcher after changing Python code, kernels or environment variables. Vite updates frontend source edits automatically.

## Configuration

The ignored `frontend/.env.local` should contain:

```dotenv
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Restart Vite after environment changes. `VITE_USE_MOCKS=true` enables fixtures for analysis/comparison; the 3D explorer still requires the backend. VITE variables are visible to the browser: never store secrets there.

- Website: http://127.0.0.1:5173/
- Backend health: http://127.0.0.1:8000/api/v1/health
- API documentation: http://127.0.0.1:8000/docs

The combined launcher uses ports 5173 and 8000. For custom API addresses, use the manual workflow and configure backend CORS to match your frontend origin.

## Manual startup: two terminals

`npm run dev` retains its original behavior: it starts **only the frontend**. Live data also requires the backend.

```powershell
# Terminal 1, repository root, Windows
backend/.venv/Scripts/python.exe -m uvicorn api.main:app --app-dir backend --host 127.0.0.1 --port 8000

# Terminal 2, repository root
npm run dev --workspace frontend -- --port 5173 --strictPort
```

On macOS/Linux replace the Python executable with `backend/.venv/bin/python`. Do not run the manual servers and combined launcher simultaneously.

## Scientific files

The required SPICE kernels are tracked on main in `backend/ephermis_data_retreiver/required_kernels/`:

- `naif0012.tls`
- `pck00011.tpc`
- `de440s.bsp`
- `moon_pa_de440_200625.bpc`
- `moon_de440_250416.tf`

The backend computes geometry locally; no Horizons API key is needed. See [backend documentation](backend/README.md) for sources, coverage and methods. Restart after changing kernels.

Keep the provided GLB models and scientific products in `modelResources/`, with their exact filenames and metadata. These include LOLA elevation and available PSR/Diviner products. Missing planetary models use labeled reference spheres; unavailable scientific products must remain labeled unavailable. Some backend tests skip when optional data are absent. The launcher does not download large scientific products.

Follow each view's displayed assumptions: smooth-horizon summaries differ from terrain-aware sections. Earth visibility is geometric, not a radio link budget. The removed experimental rover-power mesh is not restored by these startup changes.

## Troubleshooting

`git switch main` showing `M README.md` or `M package.json` is a Git status notice about local edits, not an error. Preserve those edits; do not reset them just to start the app.

| Symptom | Fix |
| --- | --- |
| Ephemeris service unavailable / Failed to fetch | Use `npm run dev:local`, not just `npm run dev`. Check backend health, Python output and the API URL above. Restart both servers after pulling Python changes, then refresh the page. |
| Port 5173 or 8000 already in use | Stop the old project terminals with Ctrl+C, then retry. Do not start multiple copies. |
| Windows EPERM/unlink error involving lightningcss during npm ci | Stop all dev servers for this checkout before reinstalling. Vite holds native dependencies open. Administrator mode is normally unnecessary. |
| Missing React types, tsx or Vite | Run `npm ci` at the repository root after stopping servers. |
| Missing fastapi, spiceypy or PIL | Install `backend/requirements.txt` using the same backend/.venv Python used to launch the server. |
| Missing kernels or dates outside coverage | Read the backend error, restore required files from main and select a supported UTC. Do not silently substitute demo results. |
| Browser still displays an old failure | Confirm backend health succeeds, then refresh http://127.0.0.1:5173/explorer. |

## Checks

```sh
npm test
npm run build
```

Backend tests, from the repository root on Windows:

```powershell
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
```

On macOS/Linux use `backend/.venv/bin/python`. The production build is written to `frontend/dist`. `npm run preview` serves that build but still needs the backend for live features. Production hosting must rewrite client routes to index.html and configure an appropriate API address/CORS policy.

## Team reference

Start at [docs/README.md](docs/README.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

- `frontend/`: React, TypeScript, Vite, Tailwind CSS, Router, Three.js, Lucide and Recharts.
- `backend/`: FastAPI, SPICE and scientific data services.
- `docs/` and `data/`: architecture, contracts, research and provenance.

Use feature branches and pull requests. Do not commit virtual environments, node_modules, private environment files or generated caches.
