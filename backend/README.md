# Backend: Moon-anchored ephemeris service

FastAPI + SpiceyPy service that computes Sun, Earth and Mars geometry in the Moon-fixed **MOON_ME** frame (Moon center origin, km) and site-relative Sun/Earth elevation, azimuth and rise/set times. It also serves the GLB models in `../modelResources` at `/models`.

## Run
On Windows, from the repository root, use an isolated environment:
```powershell
python -m venv backend\.venv
backend\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
cd backend
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```
In a second terminal at the repository root, create `frontend/.env.local` from
`frontend/.env.example` if missing, then run `npm run dev`. Keep both servers
running. The explorer always uses live SPICE geometry even while other pages
use mock data. Check http://127.0.0.1:8000/api/v1/health if it cannot connect.

```bash
pip install -r requirements.txt
python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
```
Run from this `backend/` folder. The frontend reads `VITE_API_BASE_URL` (default `http://127.0.0.1:8000/api/v1`) from `frontend/.env.local`.

## Kernels (`ephermis_data_retreiver/required_kernels/`)
| File | Purpose |
| --- | --- |
| naif0012.tls | Leap seconds |
| de440s.bsp | Planetary ephemeris, 1849–2150 (Mars as MARS BARYCENTER) |
| pck00011.tpc | Body radii, IAU_EARTH orientation |
| moon_pa_de440_200625.bpc | High-accuracy lunar orientation (libration), 1550–2650 |
| moon_de440_250416.tf | MOON_ME / MOON_PA frame definitions |

The Cassini-era kernels in that folder are not used by the service.

## Method and validation
- Aberration correction LT+S, observer Moon center; site vectors subtract the site position on a 1737.4 km mean sphere.
- Horizon: mean sphere, disk center, no terrain, no refraction (the Moon has no atmosphere). Terrain horizons need LOLA data.
- Rise/set: 1-hour sampling over 35 days, bisection to under a minute.
- Checked against JPL Horizons (airless, MEAN_ME observer): 0.674° N 23.473° E at 2026-11-20 23:05 UTC and 89.5° S 32° E at 2026-11-14 12:00 UTC. Sun and Earth azimuth/elevation agree to better than 0.0001°.

## Tests
```bash
python -m pytest tests -q
```
Run from this `backend/` folder. `test_ephemeris.py` and `test_terrain.py` run offline (the terrain tests skip if `ldem_16_uint.tif` is missing). `test_api.py` calls a running server at `http://127.0.0.1:8000` (override with `LUNARSITE_API`) and skips if none is up. Frontend tests: `npm test` in the repo root.
