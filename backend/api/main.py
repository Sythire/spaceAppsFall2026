"""FastAPI service exposing Moon-anchored SPICE geometry to the frontend.

Run from the backend folder:
    python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Query, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import analysis, catalog, data_products, ephemeris, power_comms, terrain
from .schemas import AnalysisRequest, ComparisonRequest

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "modelResources"))
# GLB exports of the provided models. The originals (.usdz / 8k .glb) are never modified.
MODEL_FILES = {
    "moon": "Moon_NASA_LRO_15k_Grid_Small.glb",
    "earth": "earth.glb",
    "sun": "sun.glb",
    "mars": "mars.glb",
    "mercury": "Mercury_1_4878.glb",
    "venus": "Venussurface_1_12103.glb",
}

app = FastAPI(title="LunarSite ephemeris service", version="0.1.0")
# Local dev servers, plus any deployed frontend: extra exact origins via CORS_ORIGINS (comma-separated) and
# a pattern via CORS_ORIGIN_REGEX (default: Vercel production and preview URLs). The API is public and
# read-only with no cookies or auth, so allowing other origins exposes nothing.
_LOCAL_ORIGINS = ["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4173"]
_EXTRA_ORIGINS = [o.strip().rstrip("/") for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_LOCAL_ORIGINS + _EXTRA_ORIGINS,
    allow_origin_regex=os.environ.get("CORS_ORIGIN_REGEX", r"https://[a-z0-9-]+\.vercel\.app"),
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)
if os.path.isdir(MODEL_DIR):
    app.mount("/models", StaticFiles(directory=MODEL_DIR), name="models")


def _utc(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None or parsed.utcoffset() is None:
            raise ValueError("Timezone required")
        return parsed.astimezone(timezone.utc)
    except ValueError as exc:
        raise HTTPException(422, f"Invalid ISO 8601 UTC timestamp: {value}") from exc


def _call(fn, *args):
    try:
        return fn(*args)
    except ephemeris.EphemerisError as exc:
        raise HTTPException(422, str(exc)) from exc
    except ephemeris.KernelError as exc:
        raise HTTPException(503, str(exc)) from exc


@app.on_event("startup")
def _startup() -> None:
    ephemeris.load_kernels()


@app.get("/api/v1/health")
def health():
    return {"status": "ok", **_call(ephemeris.coverage)}


@app.get("/api/v1/models")
def models():
    """Which GLB model files are present; the frontend falls back to labeled spheres otherwise."""
    manifest = {key: (f"/models/{name}" if os.path.isfile(os.path.join(MODEL_DIR, name)) else None)
                for key, name in MODEL_FILES.items()}
    manifest["sky"] = _sky_map()
    return manifest


def _sky_map() -> str | None:
    """NASA SVS Deep Star Map in celestial (J2000) coordinates, if one is in modelResources.
    Galactic-coordinate versions (*_gal*) are ignored because they need a different rotation."""
    if not os.path.isdir(MODEL_DIR):
        return None
    names = sorted(n for n in os.listdir(MODEL_DIR)
                   if n.lower().startswith("starmap") and "_gal" not in n.lower()
                   and n.lower().endswith((".exr", ".jpg", ".jpeg", ".png")))
    # Prefer the smallest resolution available (4k before 8k/16k) to keep load time down.
    names.sort(key=lambda n: (os.path.getsize(os.path.join(MODEL_DIR, n)), n))
    return f"/models/{names[0]}" if names else None


@app.get("/api/v1/scene")
def scene(utc: Optional[str] = None):
    return _call(ephemeris.scene, _utc(utc))


@app.get("/api/v1/scene/series")
def scene_series(start: Optional[str] = None, hours: float = Query(720, gt=0, le=24 * 800),
                 stepHours: float = Query(2, ge=0.25, le=240),
                 lat: Optional[float] = Query(None, ge=-90, le=90), lon: Optional[float] = Query(None, ge=-180, le=180)):
    if hours / stepHours > 4000:
        raise HTTPException(422, "Too many samples; increase stepHours or reduce hours")
    if (lat is None) != (lon is None):
        raise HTTPException(422, "Supply both lat and lon for site-relative angles")
    return _call(ephemeris.series, _utc(start), hours, stepHours, lat, lon)


@app.get("/api/v1/site")
def site(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), utc: Optional[str] = None):
    result = _call(ephemeris.site, lat, lon, _utc(utc))
    result["terrain"] = terrain.site(lat, lon)
    if result["terrain"] is not None:
        result["terrain"]["permanentlyShadowed"] = data_products.psr_at(lat, lon)
        result["terrain"]["psrSource"] = data_products.PSR_SOURCE if data_products.psr_available() else None
    result["thermal"] = data_products.thermal_at(lat, lon)
    return result


@app.get("/api/v1/sites")
def sites():
    return catalog.SITES


@app.get("/api/v1/map/layers")
def layers():
    terrain_layers = {"elevation", "power", "earth-visibility"}  # these need the LOLA DEM
    def available(layer_id: str) -> bool:
        if layer_id in terrain_layers:
            return terrain.available()
        if layer_id == "psr":
            return data_products.psr_available()
        if layer_id == "thermal":
            return data_products.thermal_available()
        return layer_id == "illumination"
    return [{**layer, "available": available(layer["id"])} for layer in catalog.LAYERS]


@app.get("/api/v1/data/sources")
def data_sources():
    return _call(ephemeris.coverage)["provenance"]


@app.post("/api/v1/analysis")
def analyze(request: AnalysisRequest):
    return _call(analysis.analyze, request)


@app.post("/api/v1/timeline")
def timeline(request: AnalysisRequest):
    return _call(analysis.analyze, request)["illumination"]["timeline"]


@app.post("/api/v1/comparisons")
def compare(request: ComparisonRequest):
    return {"results": [_call(analysis.analyze, scenario) for scenario in request.requests]}


@app.get("/api/v1/terrain/info")
def terrain_info():
    if not terrain.available():
        raise HTTPException(404, "LOLA DEM not found: add modelResources/ldem_16_uint.tif")
    return terrain.info()


@app.get("/api/v1/terrain/elevation.bin")
def terrain_grid(width: int = Query(1440, ge=90, le=5760)):
    """Downsampled height grid: little-endian int16 metres above the 1737.4 km sphere, width x width/2,
    row 0 = 90°N, column 0 = 180°W."""
    if not terrain.available():
        raise HTTPException(404, "LOLA DEM not found: add modelResources/ldem_16_uint.tif")
    try:
        data, w, h = terrain.grid(width)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return Response(content=data, media_type="application/octet-stream",
                    headers={"Cache-Control": "max-age=86400", "X-Grid-Width": str(w), "X-Grid-Height": str(h)})


# ---------------------------------------------------------------- terrain-aware power & communication
def _equipment(panelTilt: float, panelHeight: float, commMask: float, commHeight: float,
               panelEfficiency: float = 30.0) -> power_comms.Equipment:
    return power_comms.Equipment(panel_tilt_deg=panelTilt, panel_height_m=panelHeight,
                                 comm_mask_deg=commMask, comm_height_m=commHeight, panel_efficiency_pct=panelEfficiency)


def _planning_call(fn, *args):
    if not terrain.available():
        raise HTTPException(404, "LOLA DEM not found: add modelResources/ldem_16_uint.tif")
    try:
        return _call(fn, *args)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.get("/api/v1/coverage/map")
def coverage_map(grid: str = Query("global", pattern="^(global|southpole)$"),
                 kind: str = Query("power", pattern="^(power|sunlit|comms)$"),
                 mode: str = Query("instant", pattern="^(instant|monthly)$"), utc: Optional[str] = None,
                 panelTilt: float = 0.0, panelHeight: float = 1.0, commMask: float = 0.0, commHeight: float = 1.0,
                  panelEfficiency: float = Query(30.0, ge=1, le=100)):
    """Terrain-aware power / sunlight / Earth-visibility map. valuesF32 is base64 little-endian float32,
    row-major in the grid layout described by `layout` (NaN outside the grid's valid area)."""
    return _planning_call(power_comms.coverage_map, grid, kind, mode, _utc(utc),
                          _equipment(panelTilt, panelHeight, commMask, commHeight, panelEfficiency))


@app.get("/api/v1/coverage/site")
def coverage_site(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), utc: Optional[str] = None,
                  days: float = Query(30, gt=0, le=60), stepHours: float = Query(1, ge=0.25, le=24),
                  panelTilt: float = 0.0, panelHeight: float = 1.0, commMask: float = 0.0, commHeight: float = 1.0,
                  panelEfficiency: float = Query(30.0, ge=1, le=100)):
    """Hour-by-hour terrain-aware power and Earth visibility at one site with summary statistics."""
    if days * 24 / stepHours > 6000:
        raise HTTPException(422, "Too many samples; increase stepHours or reduce days")
    return _planning_call(power_comms.site_series, lat, lon, _utc(utc), days, stepHours,
                          _equipment(panelTilt, panelHeight, commMask, commHeight, panelEfficiency))


# ---------------------------------------------------------------- measured map products
@app.get("/api/v1/products/psr")
def psr_map():
    """Official LOLA permanent-shadow map, resampled to the frontend's polar grid (fraction per cell)."""
    if not data_products.psr_available():
        raise HTTPException(404, "PSR map not found: add modelResources/LPSR_75S_120M_201608.TIF")
    return data_products.psr_grid()


@app.get("/api/v1/products/thermal")
def thermal_map(product: str = Query("daymax", pattern="^(daymax|nightmin)$")):
    """LRO Diviner bolometric temperature composite (K), global equirectangular 4 px/deg."""
    if not data_products.thermal_available():
        raise HTTPException(404, "Diviner maps not found: add modelResources/diviner/dgdr_tbol_avg_cyl_*_004_img.img")
    return data_products.thermal_grid(product)


@app.get("/api/v1/recommendations")
def recommendations_get():
    return []


@app.post("/api/v1/recommendations")
def recommendations(request: AnalysisRequest):
    """No site-suitability model has been agreed, so no recommendations are made (an empty list, not a guess)."""
    return []


@app.get("/api/v1/coverage/events")
def coverage_events(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), utc: Optional[str] = None,
                    panelTilt: float = 0.0, panelHeight: float = 1.0, commMask: float = 0.0, commHeight: float = 1.0,
                  panelEfficiency: float = Query(30.0, ge=1, le=100)):
    """Terrain-aware next sunrise/sunset and Earthrise/Earthset for the given equipment."""
    return _planning_call(power_comms.terrain_events, lat, lon, _utc(utc),
                          _equipment(panelTilt, panelHeight, commMask, commHeight, panelEfficiency))
