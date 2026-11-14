"""LOLA elevation from the provided NASA CGI Moon Kit DEM (modelResources/ldem_16_uint.tif).

File layout (checked against known features: highest point = Selenean summit 5.4°N 158.7°W,
lowest = Antoniadi crater 70.3°S 172.5°W):
  * 5760 x 2880 unsigned 16-bit, simple cylindrical (equirectangular), 16 pixels per degree.
  * Row 0 is the north edge (90°N); column 0 is the west edge (180°W).
  * Value = height in half-metres above a 1727.4 km sphere.
Heights here are returned in metres relative to the 1737.4 km mean lunar sphere used by the ephemeris code.
"""
from __future__ import annotations

import math
import os
import threading

import numpy as np

DEM_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "modelResources", "ldem_16_uint.tif"))
PIXELS_PER_DEGREE = 16
MOON_MEAN_RADIUS_M = 1737400.0
SOURCE = "LRO LOLA elevation, NASA SVS CGI Moon Kit ldem_16_uint.tif (16 px/deg, ~1.9 km/px)"

_lock = threading.Lock()
_dem: np.ndarray | None = None


def available() -> bool:
    return os.path.isfile(DEM_PATH)


def _load() -> np.ndarray:
    """Heights in metres relative to the 1737.4 km sphere, float32, shape (2880, 5760)."""
    global _dem
    with _lock:
        if _dem is None:
            from PIL import Image  # Pillow reads the uncompressed 16-bit TIFF directly
            Image.MAX_IMAGE_PIXELS = None
            raw = np.asarray(Image.open(DEM_PATH), dtype=np.float32)
            _dem = raw * 0.5 + (1727400.0 - MOON_MEAN_RADIUS_M)
        return _dem


def info() -> dict:
    dem = _load()
    return {"source": SOURCE, "pixelsPerDegree": PIXELS_PER_DEGREE, "width": int(dem.shape[1]), "height": int(dem.shape[0]),
            "minM": float(dem.min()), "maxM": float(dem.max()), "referenceRadiusM": MOON_MEAN_RADIUS_M,
            "layout": "equirectangular; row 0 = 90°N, column 0 = 180°W; metres above 1737.4 km sphere"}


def grid(width: int) -> tuple[bytes, int, int]:
    """Block-averaged height grid as little-endian int16 metres, width x width/2, same layout as the DEM."""
    dem = _load()
    full_h, full_w = dem.shape
    if full_w % width:
        raise ValueError(f"width must divide {full_w}")
    k = full_w // width
    small = dem.reshape(full_h // k, k, width, k).mean(axis=(1, 3))
    return np.round(small).astype("<i2").tobytes(), width, full_h // k


def _sample(lat: float, lon: float) -> float:
    """Bilinear height (m) at a planetocentric lat/lon (east-positive)."""
    dem = _load()
    h, w = dem.shape
    x = (lon + 180.0) * PIXELS_PER_DEGREE - 0.5
    y = (90.0 - lat) * PIXELS_PER_DEGREE - 0.5
    x0, y0 = math.floor(x), math.floor(y)
    fx, fy = x - x0, y - y0
    y0c, y1c = min(max(y0, 0), h - 1), min(max(y0 + 1, 0), h - 1)
    x0w, x1w = x0 % w, (x0 + 1) % w
    top = dem[y0c, x0w] * (1 - fx) + dem[y0c, x1w] * fx
    bot = dem[y1c, x0w] * (1 - fx) + dem[y1c, x1w] * fx
    return float(top * (1 - fy) + bot * fy)


def site(lat: float, lon: float) -> dict | None:
    """Elevation and regional slope at a site; slope from central differences one pixel (~1.9 km) apart."""
    if not available():
        return None
    step = 1.0 / PIXELS_PER_DEGREE
    baseline_m = MOON_MEAN_RADIUS_M * math.radians(step)
    lat_n, lat_s = min(lat + step, 90.0), max(lat - step, -90.0)
    dz_dn = (_sample(lat_n, lon) - _sample(lat_s, lon)) / (MOON_MEAN_RADIUS_M * math.radians(lat_n - lat_s))
    # East-west spacing shrinks with cos(lat); near the poles widen the longitude step to keep ~1 baseline.
    dlon = min(step / max(math.cos(math.radians(lat)), 1e-3), 90.0)
    east_m = MOON_MEAN_RADIUS_M * math.cos(math.radians(lat)) * math.radians(2 * dlon)
    dz_de = (_sample(lat, lon + dlon) - _sample(lat, lon - dlon)) / east_m if east_m > 1.0 else 0.0
    return {
        "elevationM": _sample(lat, lon),
        "regionalSlopeDeg": math.degrees(math.atan(math.hypot(dz_dn, dz_de))),
        "baselineKm": 2 * baseline_m / 1000.0,
        "source": SOURCE,
        "note": "Regional slope over ~3.8 km; local slopes at lander scale can be much steeper.",
    }
