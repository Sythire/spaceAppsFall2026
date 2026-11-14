"""FastAPI service exposing Moon-anchored SPICE geometry to the frontend.

Run from the backend folder:
    python -m uvicorn api.main:app --host 127.0.0.1 --port 8000
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import ephemeris

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


def _utc(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(422, f"Invalid ISO 8601 UTC timestamp: {value}") from exc


def _call(fn, *args):
    try:
        return fn(*args)
    except ephemeris.EphemerisError as exc:
        raise HTTPException(422, str(exc)) from exc


@app.on_event("startup")
def _startup() -> None:
    ephemeris.load_kernels()


@app.get("/api/v1/health")
def health():
    return {"status": "ok", **ephemeris.coverage()}


@app.get("/api/v1/models")
def models():
    """Which GLB model files are present; the frontend falls back to labeled spheres otherwise."""
    return {key: (f"/models/{name}" if os.path.isfile(os.path.join(MODEL_DIR, name)) else None)
            for key, name in MODEL_FILES.items()}


@app.get("/api/v1/scene")
def scene(utc: str | None = None):
    return _call(ephemeris.scene, _utc(utc))


@app.get("/api/v1/scene/series")
def scene_series(start: str | None = None, hours: float = Query(720, gt=0, le=24 * 800),
                 stepHours: float = Query(2, ge=0.25, le=240),
                 lat: float | None = Query(None, ge=-90, le=90), lon: float | None = Query(None, ge=-180, le=180)):
    if hours / stepHours > 4000:
        raise HTTPException(422, "Too many samples; increase stepHours or reduce hours")
    return _call(ephemeris.series, _utc(start), hours, stepHours, lat, lon)


@app.get("/api/v1/site")
def site(lat: float = Query(..., ge=-90, le=90), lon: float = Query(..., ge=-180, le=180), utc: str | None = None):
    return _call(ephemeris.site, lat, lon, _utc(utc))
