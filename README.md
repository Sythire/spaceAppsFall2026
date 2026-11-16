# Moonwalk

Website Deployment: https://spaceappsfall2026.vercel.app/explorer

**Explore the Moon. Compare landing sites. Understand when to land.**

Moonwalk is a NASA Space Apps project that helps people explore lunar landing sites and compare sunlight, terrain and Earth visibility at a chosen date and time.

## What you can do

- **Lunar Explorer:** rotate the Moon, select a mission site or enter coordinates, and view layers for sunlight, elevation, temperature, permanent shadow, solar power and Earth visibility.
- **Site Research:** investigate a location or compare up to three sites using graphs and visibility windows.
- **Overview and Missions:** explore lunar imagery and learn about past and planned missions.

To get started, open **Lunar Explorer**, choose a site and scenario time, then turn on the layers you want to explore. Open **Site Research** to compare sites over time.

## Run locally

Already installed? Run this from the repository folder:

```sh
npm run dev:local
```

Open [Moonwalk](http://127.0.0.1:5173/). Keep the terminal open; **Ctrl+C stops both the website and backend**.

### First-time setup

Install **Node.js 22.12+**, **Python 3.11+** and **Git**. Internet access is needed for installation and externally hosted imagery.

Clone the project:

```sh
git clone https://github.com/Sythire/spaceAppsFall2026.git
cd spaceAppsFall2026
npm ci
```

Then follow the instructions for your operating system.

**Windows PowerShell**

```powershell
python -m venv backend/.venv
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements.txt
npm run dev:local
```

**macOS / Linux**

```sh
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
npm run dev:local
```

The launcher creates `frontend/.env.local` if it is missing, starts the backend on port **8000**, and starts the website on port **5173**. You do not need to activate the Python environment or start a second terminal.

### Updating an existing installation

Stop the servers and save your local changes before pulling updates:

```sh
git pull --ff-only origin main
```

If `package-lock.json` changed, run `npm ci`. If `backend/requirements.txt` changed, repeat the Python install command above. Then run `npm run dev:local` again.

### Connection settings

For local use, `frontend/.env.local` should contain:

```dotenv
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

Restart the servers after changing these settings. Demo mode uses example analysis results; the 3D explorer still needs the backend.

| Problem | What to do |
| --- | --- |
| “Ephemeris service unavailable” or “Failed to fetch” | Run `npm run dev:local`, check the settings above, and open the [backend health check](http://127.0.0.1:8000/api/v1/health). Read any Python error in the terminal. |
| Port 5173 or 8000 is already in use | Stop the previous project servers with Ctrl+C before restarting. |
| Windows `EPERM` / `lightningcss` error during `npm ci` | Stop the project servers before reinstalling dependencies. |
| A map is unavailable | Check that its scientific files are present in `modelResources/`; see the [backend reference](backend/README.md). The first terrain calculation can take several minutes. |

## Data and limitations

Moonwalk uses NASA/JPL SPICE data for celestial positions, LOLA data for terrain and permanent shadow, and Diviner measurements for temperature. Local calculations do not require an API key. Keep the supplied scientific files and models in their existing folders.

These are exploratory assessments. Smooth-horizon summaries and terrain-aware maps use different assumptions. Earth visibility does not guarantee a working radio link, and temperature measurements are historical averages rather than forecasts.

If the backend is slow or offline, the site list can use a bundled catalogue. Live geometry, maps and analysis still require the backend.

## For teammates

The frontend uses React, TypeScript, Vite and Three.js. The backend uses Python, FastAPI and SPICE.

Run the frontend checks from the repository folder:

```sh
npm test
npm run build
```

To run backend tests on Windows:

```powershell
backend/.venv/Scripts/python.exe -m pip install -r backend/requirements-dev.txt
backend/.venv/Scripts/python.exe -m pytest backend/tests -q
```

On macOS/Linux, use `backend/.venv/bin/python` instead.

- [Team documentation](docs/README.md)
- [Contribution guide](CONTRIBUTING.md)
- [Backend and data reference](backend/README.md) · [Local API documentation](http://127.0.0.1:8000/docs)
- [Backend deployment guide](deploy/huggingface/README.md)
