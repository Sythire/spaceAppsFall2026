# Integration contracts
## Configuration and transport
frontend/.env.local:
```dotenv
VITE_USE_MOCKS=false
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```
Default is simulated mode. Backend mode requires a configured base URL. Requests use JSON; non-2xx results surface errors, and fetch times out after 15 seconds. Configure backend CORS for the frontend origin. These are proposed endpoints, not an existing backend. No silent fallback to mocks after service failure.

| Method/path | Request | Response |
| --- | --- | --- |
| GET /sites | none | LunarLocation[] |
| GET /map/layers | none | MapLayerDefinition[] |
| POST /analysis | AnalysisRequest | AnalysisResult |
| POST /timeline | AnalysisRequest | TimelinePoint[] |
| POST /comparisons | { requests: AnalysisRequest[] } | LandingSiteComparison |
| POST /recommendations | AnalysisRequest | Recommendation[] |

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
  "utc": "2026-11-14T12:00:00.000Z"
}
```
Coordinates: planetocentric north-positive latitude [-90,90], east-positive longitude [-180,180]. Do not mix Mean Earth and principal-axis lunar frames. utc is an ISO 8601 timestamp with Z. Scientific provider owns frame/UTC validation.

## AnalysisResult shape
- request: exact scenario evaluated.
- mode: simulated or verified. verified requires actual source validation.
- source: explicit provenance string; extend to per-product metadata before multi-source science integration.
- sun / earth: elevationDeg, azimuthDeg; azimuth convention must be agreed as clockwise from north before real integration.
- illumination: sunlightPercent, timeline.
- timeline entries: hour (hours from scenario start), sunlightPercent, earthVisibilityPercent.
- earthVisibilityPercent: percentage over an agreed interval; currently no verified interval is claimed.
- terrain: slopeDeg, temperatureK, permanentlyShadowed, each nullable.
- suitability: nullable string; no score/ranking until the team agrees on a documented model.
- comparison: results array, requested in selection order.
- recommendation: location, reason and mode. Mock recommendations are empty.

## Integration gates
Before verified mode, add explicit timeline interval/cadence, per-product provenance and coverage, horizon method, reference-frame kernel/version, uncertainties and error codes. No arbitrary-time thermal prediction from a climatology. No PSR claim from one dark timestamp. No relay availability claim from direct Earth elevation alone.

Service methods exist for every endpoint; analysis/comparison, site catalog and layers are currently wired to UI. Dedicated timeline and recommendations are ready for integration, not a claim of completed backend functionality.


## Implemented ephemeris endpoints (backend/api)
These are live, not proposed. Units are km and degrees; vectors are MOON_ME, Moon-centered; times are ISO 8601 UTC.

| Method/path | Query | Response |
| --- | --- | --- |
| GET /health | none | kernel list, frame, coverage |
| GET /models | none | ModelManifest: path of each GLB or null |
| GET /scene | utc? (default now) | Body vectors, distances, sub-points, IAU_EARTH→MOON_ME quaternion |
| GET /scene/series | start, hours (≤2880), stepHours, lat?, lon? | SceneSeries: samples with body vectors, Earth quaternion, optional site angles |
| GET /site | lat, lon, utc? | SiteGeometry: Sun/Earth elevation/azimuth, next rise/set (35-day search), ideal horizontal-panel flux |

Out-of-coverage times (outside 1849–2150) return HTTP 422 with the SPICE error. The 3D view uses these directly with no mock fallback. Types live in frontend/src/types/index.ts.
