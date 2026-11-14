# Integration contracts
## Configuration and transport
frontend/.env.local:
```dotenv
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```
The example environment config uses backend mode for Analysis/Comparison; `VITE_USE_MOCKS=true` opts into fixture demo mode. The explorer always uses live SPICE. Backend mode requires a configured base URL. Requests use JSON; non-2xx results surface errors, and fetch times out after 15 seconds. Configure backend CORS for the frontend origin. The endpoints below are implemented except recommendations. No silent fallback to mocks after service failure. Page notices, site labels and charts distinguish demo fixtures from modeled results.

| Method/path | Request | Response |
| --- | --- | --- |
| GET /sites | none | LunarLocation[] |
| GET /map/layers | none | MapLayerDefinition[] |
| POST /analysis | AnalysisRequest | AnalysisResult |
| POST /timeline | AnalysisRequest | TimelinePoint[] |
| POST /comparisons | { requests: AnalysisRequest[] } | LandingSiteComparison |
| GET /data/sources | none | KernelProvenance |

`POST /recommendations` remains planned; no scientific ranking model is implemented.

Canonical interfaces: frontend/src/types/index.ts. Keep backend response changes synchronized there and in this document.

## Scenario example
```json
{
  "location": {
    "id": "custom",
    "name": "Custom location",
    "latitudeDeg": -89.5,
    "longitudeDeg": 32,
    "frame": "MOON_ME"
  },
  "utc": "2026-11-14T12:00:00.000Z",
  "durationHours": 720,
  "stepHours": 1
}
```
Coordinates: planetocentric north-positive latitude [-90,90], east-positive longitude [-180,180]. Do not mix Mean Earth and principal-axis lunar frames. utc is an ISO 8601 timestamp with Z or explicit offset. Scientific provider validates frame/UTC. Requests default to 720 hours at 1-hour cadence; duration is 1 second–2880 hours, step is 0.25–24 hours, and duration/step must be ≤4000. The final endpoint is always sampled, including a partial last step. Comparisons accept 1–3 scenarios.

## AnalysisResult shape
- request: parsed scenario evaluated, including interval/cadence defaults and catalog provenance when supplied. Null optional catalog fields are omitted.
- mode: simulated, modeled, or verified. SPICE analysis returns modeled; it is a physical approximation derived from actual NASA kernels, not a terrain-verified product.
- source: explicit provenance string. metadata.provenance identifies exact local kernel hashes, source URLs, software versions, frame realization and installed coverage. Original kernel download date is unknown and remains null.
- sun / earth: elevationDeg, azimuthDeg, distanceKm, aboveHorizon, nextRise, nextSet. Azimuth is clockwise from north. Distances are from the surface observer.
- illumination: sunlightPercent, timeline.
- timeline entries: hour (UTC calendar hours from scenario start), utc, sunlightPercent, earthVisibilityPercent, sun, earth, solarFluxWm2, horizontalIrradianceWm2. Instantaneous percentages are binary 0/100 body-center visibility, not panel efficiency or fractional disk visibility.
- illumination.sunlightPercent / earthVisibilityPercent: percentages of elapsed SI time over the requested interval, integrated using refined crossings rather than counting chart samples.
- illumination: additionally daylightHours, darknessHours, aboveHorizonHours, belowHorizonHours, aboveHorizonPercent, visibleWindows, hiddenWindows, events, nextRise, nextSet. earthVisibility has the same visibility summary fields.
- each window: startUtc, endUtc, durationHours, clippedAtStart, clippedAtEnd. Next events are null when none is found inside the requested interval.
- interval: startUtc, endUtc, durationHours, elapsedHours, stepHours, sampleCount. elapsedHours includes any leap seconds.
- metadata: horizonMethod, azimuthConvention, units, UTC timescale, event scan spacing (≤1 hour), numerical refinement bracket (0.1 seconds), generatedAtUtc, limitations, provenance, uncertaintyDeg (null: unquantified).
- terrain: slopeDeg, temperatureK, permanentlyShadowed, each nullable.
- suitability: nullable string; no score/ranking until the team agrees on a documented model.
- comparison: results array, requested in selection order.
- recommendation: location, reason and mode. Mock recommendations are empty.

## Integration gates
Current modeled analysis results specify interval, cadence, kernel/frame versions, coverage, and horizon assumptions. They do not include terrain or quantified physical uncertainty. The explorer separately provides LOLA elevation and regional slope through `/site` and `/terrain/*`, with illumination/elevation overlay availability exposed by `/map/layers`. These do not supply terrain-aware horizons to `/analysis`. Events refine sampled sign changes; brief/grazing events between samples can be missed. Numerical bracket size is not physical accuracy. No arbitrary-time thermal prediction from a climatology. No PSR claim from one dark timestamp. No relay availability or ground-station contact claim from direct Earth elevation alone. Body-center visibility ignores partial disks and eclipses. Invalid inputs and SPICE coverage errors return 422; a missing-kernel condition during a request returns 503, while missing startup kernels fail startup.

Existing frontend service methods match the implemented analysis, comparison, catalog, layer and timeline endpoints. Recommendations remain planned. Analysis/Comparison use live results with `VITE_USE_MOCKS=false`, including shared UTC, duration and sample-spacing controls.


## Implemented ephemeris endpoints (backend/api)
These are live, not proposed. Units are km and degrees; vectors are MOON_ME, Moon-centered; times are ISO 8601 UTC.

| Method/path | Query | Response |
| --- | --- | --- |
| GET /health | none | kernel list, frame, coverage |
| GET /models | none | ModelManifest: path of each GLB or null |
| GET /scene | utc? (default now) | Body vectors, distances, sub-points, IAU_EARTH→MOON_ME quaternion |
| GET /scene/series | start, hours (≤19200), stepHours (≤240), lat?, lon? | SceneSeries: per sample, Moon-centered MOON_ME vectors (sun/earth/mars, LT+S), Sun-centered ECLIPJ2000 positions (`helio`: moon/earth/mars, geometric), MOON_ME→ECLIPJ2000 and IAU_EARTH→ECLIPJ2000 quaternions, optional site angles |
| GET /site | lat, lon, utc? | SiteGeometry: Sun/Earth elevation/azimuth, next rise/set (35-day search), ideal horizontal-panel flux, `terrain` (LOLA elevation + regional slope, or null) |
| GET /terrain/info | none | LOLA DEM metadata (source, resolution, min/max, layout) |
| GET /terrain/elevation.bin | width (divides 5760) | int16 LE metres above 1737.4 km, width × width/2, row 0 = 90°N, col 0 = 180°W |

Out-of-coverage times (outside 1849–2150) return HTTP 422 with the SPICE error. The 3D view is Sun-centered (ECLIPJ2000) with the camera locked on the Moon; site angles stay Moon-fixed. It uses these endpoints directly with no mock fallback. Types live in frontend/src/types/index.ts.
