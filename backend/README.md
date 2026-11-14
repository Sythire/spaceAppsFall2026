# Backend: Moon-anchored ephemeris service

FastAPI + SpiceyPy service that computes Sun, Earth and Mars geometry in the Moon-fixed **MOON_ME** frame (Moon center origin, km) and site-relative Sun/Earth elevation, azimuth and rise/set times. It also serves the GLB models in `../modelResources` at `/models`.

The scientific data come from the bundled NASA/JPL kernels below. Requests compute
locally: there is no Horizons API dependency or API key. Restart after changing
kernels so SPICE and cached provenance use the same files.

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

On macOS/Linux, from the repository root:
```bash
python3 -m venv backend/.venv
backend/.venv/bin/python -m pip install -r backend/requirements.txt
backend/.venv/bin/python -m uvicorn api.main:app --app-dir backend --host 127.0.0.1 --port 8000
```

## Analyze a site/date interval

Open http://127.0.0.1:8000/docs and try `POST /api/v1/analysis`, or run this from
the repository root (on Windows use `curl.exe`):
```bash
curl -X POST http://127.0.0.1:8000/api/v1/analysis -H 'Content-Type: application/json' --data-binary @backend/examples/analysis-request.json
```

The example evaluates 89.5° S, 32° E starting at 2026-11-14 12:00 UTC for 720
hours with hourly chart samples. This is a hypothetical test location. Change
coordinates, UTC, `durationHours` or `stepHours` to evaluate another scenario.
Defaults are 720 hours and 1-hour samples. Intervals range from 1 second to 2880 hours,
sample spacing is 0.25–24 hours, and each scenario accepts at most 4001 points.
Coordinates are planetocentric north-positive latitude and east-positive longitude.
UTC must include `Z` or an explicit offset; offsets are normalized for calculations.

Implemented data endpoints (all under `/api/v1`):

| Endpoint | Returns |
| --- | --- |
| `POST /analysis` | Starting Sun/Earth angles, angle timeline, daylight/darkness hours, bounded visibility windows and provenance |
| `POST /timeline` | Timeline point array for the same scenario request |
| `POST /comparisons` | `{ "requests": [...] }`, 1–3 scenarios, results in request order |
| `GET /sites` | Six NASA-sourced Apollo LM locations plus an explicitly hypothetical polar reference |
| `GET /data/sources` | NASA kernel URLs, installed SHA256 hashes, software versions, frame and actual kernel coverage |
| `GET /map/layers` | Illumination overlay, elevation when its DEM exists, Earth visibility marked unavailable |

`mode: modeled` means computed from NASA kernels with stated physical assumptions.
`illumination.sunlightPercent` and `earthVisibilityPercent` are time-weighted
fractions over the requested interval. Individual timeline values are 0 or 100
based on whether the corresponding body's center is above the horizon; they are
not solar-panel efficiencies. `horizontalIrradianceWm2` is incident flux per area,
before panel efficiency or conversion losses.

Windows are clipped to the interval boundaries. `nextRise` and `nextSet` refer
only to events found inside that interval; null does not mean no event will ever
occur. Events use a scan spacing of at most one hour, followed by bisection to
0.1-second numerical brackets. Brief/grazing events between scan samples can be
missed. This bracket size does not represent physical accuracy. Durations use SI
seconds, including leap seconds when applicable; `elapsedHours` records this
separately from the requested UTC calendar interval.

No terrain obstruction, partial disk visibility, eclipses, ground station contacts
or radio link budgets are modeled. Terrain slope, temperature, PSR status and
suitability remain null. No recommendation/ranking endpoint is implemented.
Out-of-coverage requests return 422; invalid coordinates, timezones, frames and
oversized requests are rejected. Missing kernels fail startup with named files.

The explorer uses live SPICE. With `VITE_USE_MOCKS=false` (the example config),
Site Analysis and Comparison use the same backend. Select a site and UTC, then
choose 1, 7, 30 or 90 days; results update automatically. Analysis shows angle
curves, duration totals and daylight/Earth-visibility windows. `VITE_USE_MOCKS=true`
retains the optional fixture demo mode for those pages.

## Tests

From the repository root:
```bash
backend/.venv/bin/python -m pip install -r backend/requirements-dev.txt
backend/.venv/bin/python -W error::RuntimeWarning -m unittest discover -s backend/tests -v
```
Tests exercise the actual kernels, API validation, window totals and crossing
directions, comparisons, and a captured NASA/JPL Horizons Sun-angle reference.
Horizons is used only as an independent validation reference, not at runtime.

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
- Site angles use SPICE `spkcpo`, `LT+S`, a fixed surface observer on a 1737.4 km mean sphere, and the output frame evaluated at observation time. Moon-centered scene vectors continue to use `spkpos`.
- Horizon: mean sphere, disk center, no terrain, no refraction (the Moon has no atmosphere). Terrain horizons need LOLA data.
- Rise/set: 1-hour sampling over 35 days, bisection to under a minute.
- Automated reference: NASA/JPL Horizons airless Sun angles at 89.5° S, 32° E, 2026-11-14 12:00 UTC, agree within 0.000001°. This validates that case, not all mission conditions.

## NASA source datasets

- [NAIF generic kernels](https://naif.jpl.nasa.gov/naif/data_generic.html): ephemerides, lunar orientation, frames and leap seconds. Exact file URLs and hashes are exposed by `/api/v1/data/sources`.
- [NASA Apollo landing-site coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html): catalog LM locations in the DE421 Mean Earth/polar-axis system; the installed MOON_ME alias uses `MOON_ME_DE440_ME421`.
- The explorer uses `modelResources/ldem_16_uint.tif` for LOLA relief and regional slope through `/site` and `/terrain/*`. These display products do not change the smooth-horizon analysis calculations. [NASA Goddard LOLA south-pole elevation maps](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/) are a higher-resolution future source for local horizons.
- [SPICE surface-observer routine](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/cspice/spkcpo_c.html): geometry method used by this backend.

## Explorer and terrain tests
```bash
python -m pytest tests -q
```
Run from this `backend/` folder. `test_ephemeris.py` and `test_terrain.py` run offline (the terrain tests skip if `ldem_16_uint.tif` is missing). `test_api.py` calls a running server at `http://127.0.0.1:8000` (override with `LUNARSITE_API`) and skips if none is up. Frontend tests: `npm test` in the repo root.
