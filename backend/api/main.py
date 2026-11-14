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

from . import analysis, catalog, ephemeris, terrain
from .schemas import AnalysisRequest, ComparisonRequest

MODEL_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "modelResources"))
# GLB exports of the provided models. The originals (.usdz / 8k .glb) are never modified.
MODEL_FILES = {
    "moon": "Moon_NASA_LRO_15k_Grid_Small.glb",
    "earth": "earth.glb",
    "sun": "sun.glb",
    "mars": "mars.glb",
}

app = FastAPI(title="LunarSite ephemeris service", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "http://127.0.0.1:4173"],
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
    return {key: (f"/models/{name}" if os.path.isfile(os.path.join(MODEL_DIR, name)) else None)
            for key, name in MODEL_FILES.items()}


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
    return result


@app.get("/api/v1/sites")
def sites():
    return catalog.SITES


@app.get("/api/v1/map/layers")
def layers():
    return [{**layer, "available": terrain.available() if layer["id"] == "elevation"
             else layer["id"] == "illumination"} for layer in catalog.LAYERS]


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
