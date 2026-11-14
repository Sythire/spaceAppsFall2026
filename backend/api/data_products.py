"""Measured NASA map products: LOLA permanent shadow (PSR) and LRO Diviner surface temperature.

PSR  — modelResources/LPSR_75S_120M_201608.TIF (NASA GSFC PGDA, Mazarico et al. 2011, Icarus 211, 1066-1081).
       South polar stereographic, 7624 x 7624, 120 m/px, true scale at the pole, R = 1737.4 km,
       x = ρ·sin(lon), y = ρ·cos(lon), upper-left corner (-457440, 457440) m. Values int16 with
       scale 2.5e-5 and offset 0.5 → 1 = permanently shadowed, 0 = not.
       Checked: Shackleton and Haworth crater floors read 1; the Malapert massif reads 0.

Thermal — modelResources/diviner/dgdr_tbol_avg_cyl_2010*_004_img.img (LRO Diviner GDR Level 3,
       PDS urn:nasa:pds:lro_diviner_derived1). Bolometric brightness temperature averaged over each
       ~27-day mapping cycle, separately for day (local time 06–18) and night (18–06). Equirectangular
       720 x 1440 (4 px/deg), row 0 = 90°N, column 0 = 0°E, int16 × 0.02 K, missing −32768.
       Composited over all 2010 cycles: day maximum and night minimum per cell.

Both are served to the frontend in the same grid conventions as the terrain-aware coverage maps
(global: row 0 = 89.875°N, column 0 = 180°W; polar: x = ρ·cos(lon), y = ρ·sin(lon)).
"""
from __future__ import annotations

import base64
import glob
import math
import os
import threading
import warnings

import numpy as np

RES = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "modelResources"))
PSR_PATH = os.path.join(RES, "LPSR_75S_120M_201608.TIF")
DIVINER_GLOB = os.path.join(RES, "diviner", "dgdr_tbol_avg_cyl_*_004_img.img")
R_M = 1737400.0
PSR_HALF_M = 457440.0
PSR_PX_M = 120.0
PSR_SOURCE = ("NASA GSFC PGDA / LRO LOLA LPSR_75S_120M_201608 (permanent shadow, 120 m, 75°S–pole); "
              "Mazarico et al. (2011) Icarus 211, 1066-1081, doi:10.1016/j.icarus.2010.10.030")
DIVINER_SOURCE = ("LRO Diviner GDR Level 3 bolometric temperature (tbol_avg, 4 px/deg), PDS "
                  "urn:nasa:pds:lro_diviner_derived1, 2010 mapping cycles composited")

_lock = threading.Lock()
_psr: np.ndarray | None = None
_thermal: dict | None = None


def psr_available() -> bool:
    return os.path.isfile(PSR_PATH)


def thermal_available() -> bool:
    return bool(glob.glob(DIVINER_GLOB))


# ---------------------------------------------------------------- PSR
def _load_psr() -> np.ndarray:
    """Full-resolution PSR flag (uint8 0/1) in the file's own orientation."""
    global _psr
    with _lock:
        if _psr is None:
            from PIL import Image
            Image.MAX_IMAGE_PIXELS = None
            raw = np.asarray(Image.open(PSR_PATH))
            _psr = (raw.astype(np.float32) * 2.5e-5 + 0.5 > 0.5).astype(np.uint8)
        return _psr


def psr_at(lat: float, lon: float) -> bool | None:
    """True/False inside the map's coverage (poleward of ~75°S), None elsewhere."""
    if not psr_available() or lat > -74.5:
        return None
    a = _load_psr()
    colat = math.radians(90 + lat)
    rho = 2 * R_M * math.tan(colat / 2)
    x, y = rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))
    col, row = int((x + PSR_HALF_M) / PSR_PX_M), int((PSR_HALF_M - y) / PSR_PX_M)
    if not (0 <= row < a.shape[0] and 0 <= col < a.shape[1]):
        return None
    return bool(a[row, col])


def psr_grid(n: int = 1524) -> dict:
    """PSR fraction (0..1) per cell on an n x n grid in the frontend polar convention (x = ρcos, y = ρsin)."""
    a = _load_psr()
    k = a.shape[0] // n
    trim = (a.shape[0] - n * k) // 2                                  # trim evenly so the pole stays centred
    a = a[trim: trim + n * k, trim: trim + n * k].reshape(n, k, n, k).mean(axis=(1, 3))   # block mean, file orientation
    # File: row ↓ = decreasing y_f (= ρcos λ), col → = increasing x_f (= ρsin λ).
    # Ours: row ↑ = increasing y_o (= ρsin λ = x_f), col → = increasing x_o (= ρcos λ = y_f).
    ours = a[::-1, :].T          # rows indexed by x_f ascending, cols by y_f ascending
    half = n * k * PSR_PX_M / 2
    return {"width": n, "height": n, "rhoMaxM": half, "capLat": -(90 - 2 * math.degrees(math.atan(half / (2 * R_M)))),
            "valuesF32": base64.b64encode(ours.astype(np.float32).tobytes()).decode("ascii"),
            "units": "fraction of cell permanently shadowed", "cellKm": k * PSR_PX_M / 1000, "source": PSR_SOURCE,
            "layout": "polar stereographic, x = ρ·cos(lon), y = ρ·sin(lon), row 0 = y = -ρmax"}


# ---------------------------------------------------------------- thermal
def _load_thermal() -> dict:
    global _thermal
    with _lock:
        if _thermal is None:
            files = sorted(glob.glob(DIVINER_GLOB))
            day, night, dates = [], [], []
            for f in files:
                a = np.fromfile(f, "<i2").reshape(720, 1440).astype(np.float32)
                a[a == -32768] = np.nan
                a *= 0.02
                a = np.roll(a, 720, axis=1)       # column 0 = 0°E → column 0 = 180°W
                stamp = os.path.basename(f).split("_")[4]  # e.g. 20100121d
                (day if stamp.endswith("d") else night).append(a)
                dates.append(stamp[:8])
            with np.errstate(all="ignore"), warnings.catch_warnings():
                warnings.simplefilter("ignore", RuntimeWarning)  # cells never observed stay NaN
                _thermal = {"daymax": np.nanmax(np.stack(day), axis=0), "nightmin": np.nanmin(np.stack(night), axis=0),
                            "cycles": {"day": len(day), "night": len(night)},
                            "period": f"{min(dates)} to {max(dates)}" if dates else ""}
        return _thermal


def thermal_grid(product: str) -> dict:
    if product not in ("daymax", "nightmin"):
        raise ValueError("product must be daymax or nightmin")
    t = _load_thermal()
    v = t[product].astype(np.float32)
    finite = v[np.isfinite(v)]
    label = ("Highest daytime (06–18 h local) cycle-average temperature in 2010" if product == "daymax"
             else "Lowest night-time (18–06 h local) cycle-average temperature in 2010")
    return {"width": 1440, "height": 720, "units": "K", "product": product, "label": label,
            "min": float(finite.min()), "max": float(finite.max()), "cycles": t["cycles"], "period": t["period"],
            "valuesF32": base64.b64encode(v.tobytes()).decode("ascii"), "source": DIVINER_SOURCE, "cellKm": 7.6,
            "layout": "equirectangular, row 0 = 89.875°N, column 0 = 179.875°W, 4 px/deg"}


def thermal_at(lat: float, lon: float) -> dict | None:
    if not thermal_available():
        return None
    t = _load_thermal()
    row = min(719, max(0, int((90 - lat) * 4)))
    col = int(((lon + 180) % 360) * 4) % 1440
    def val(a):
        x = float(a[row, col])
        return None if math.isnan(x) else x
    return {"dayMaxK": val(t["daymax"]), "nightMinK": val(t["nightmin"]), "source": DIVINER_SOURCE,
            "note": "Cycle-average bolometric temperature at ~7.6 km resolution; not a prediction for the selected time."}
