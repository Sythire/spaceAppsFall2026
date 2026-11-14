"""Terrain-aware solar power and Earth-communication maps and site statistics.

Geometry: Sun and Earth vectors come from SPICE (MOON_ME, Moon-centred, LT+S). For each map cell the
vector is taken from the cell's position on the 1737.4 km sphere (Earth parallax included), converted to
local elevation/azimuth, and compared with the cell's terrain horizon in that direction (horizon.py).

Solar panel model: the panel sits on the local ground (DEM slope included), is tilted up by `panel_tilt_deg`
from the ground plane, and turns to face the Sun's direction (azimuth tracking). Power is incident solar
flux on the panel (W/m²): total solar irradiance scaled to the actual Sun distance × cos(incidence), zero
when the Sun's centre is below the terrain horizon. No conversion efficiency is applied.

Communication model: Earth is "visible" when its centre is above both the terrain horizon (for a receiver
`comm_height_m` above the ground) and the mask angle `comm_mask_deg`. Margin = elevation − that limit.
Line of sight only: no antenna pattern, link budget or relay satellites.
"""
from __future__ import annotations

import base64
import math
import threading
from collections import OrderedDict
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone

import numpy as np

from . import ephemeris, horizon

SOLAR_CONSTANT = 1361.0
AU_KM = 149597870.7
SYNODIC_DAYS = 29.530589
MONTHLY_STEP_H = 6.0
R_KM = horizon.R_M / 1000.0
METHOD = ("Terrain horizons from LOLA ldem_16 (48 azimuths, ray-marched to 270 km with curvature); "
          "Sun/Earth disk centre; panel tilted from local ground and tracking Sun azimuth; "
          "Earth line of sight above terrain and mask angle (no link budget or relays)")

_cache_lock = threading.Lock()
_cache: "OrderedDict[tuple, dict]" = OrderedDict()
_CACHE_MAX = 24


@dataclass(frozen=True)
class Equipment:
    panel_tilt_deg: float = 0.0
    panel_height_m: float = 1.0
    comm_mask_deg: float = 0.0
    comm_height_m: float = 1.0

    def validate(self) -> None:
        if not 0 <= self.panel_tilt_deg <= 90:
            raise ValueError("panel tilt must be 0–90°")
        if not -5 <= self.comm_mask_deg <= 90:
            raise ValueError("communication mask angle must be −5–90°")
        for h in (self.panel_height_m, self.comm_height_m):
            if not 0 <= h <= 1000:
                raise ValueError("mount height must be 0–1000 m")


# ---------------------------------------------------------------- geometry
def _vectors(start: datetime, hours: float, step_h: float) -> tuple[list[str], np.ndarray, np.ndarray]:
    """Sun and Earth MOON_ME vectors (km) at regular times."""

    @ephemeris._guard
    def run():
        et0 = ephemeris._to_et(start)
        n = int(round(hours / step_h)) + 1 if hours > 0 else 1
        e = [et0 + i * step_h * 3600 for i in range(n)]
        return ([ephemeris._et_to_iso(x) for x in e], ephemeris._positions("SUN", e), ephemeris._positions("EARTH", e))

    return run()


def _local(vec_km: np.ndarray, up: np.ndarray, east: np.ndarray, north: np.ndarray):
    """Elevation/azimuth (deg) and unit direction of a body seen from each cell."""
    v = vec_km[None, :] - up * R_KM
    dist = np.linalg.norm(v, axis=1)
    v = v / dist[:, None]
    el = np.degrees(np.arcsin(np.clip(np.einsum("ij,ij->i", v, up), -1, 1)))
    az = np.degrees(np.arctan2(np.einsum("ij,ij->i", v, east), np.einsum("ij,ij->i", v, north))) % 360
    return el, az, v, dist


def _panel_cos(normal: np.ndarray, sun_dir: np.ndarray, tilt_deg: float) -> np.ndarray:
    """cos(incidence) for a panel tilted tilt_deg from the ground plane toward the Sun's azimuth."""
    cos_g = np.einsum("ij,ij->i", normal, sun_dir)
    if tilt_deg == 0:
        return cos_g
    t = sun_dir - cos_g[:, None] * normal
    tn = np.linalg.norm(t, axis=1)
    b = math.radians(tilt_deg)
    sin_g = tn  # sun_dir is unit, so |tangential part| = sin(angle from normal)
    # n_panel = cos(b)·normal + sin(b)·t̂  →  n_panel·s = cos(b)·cos_g + sin(b)·sin_g
    return np.where(tn > 1e-9, math.cos(b) * cos_g + math.sin(b) * sin_g, cos_g)


def evaluate(grid: horizon.Grid, sun_km: np.ndarray, earth_km: np.ndarray, eq: Equipment, basis=None,
             need: tuple[str, ...] = ("sun", "earth")) -> dict:
    """Per-cell geometry. `need` limits the work to the Sun and/or Earth parts (maps only need one)."""
    up, east, north = basis if basis is not None else _grid_basis(grid)
    out: dict = {}
    if "sun" in need:
        sun_el, sun_az, sun_dir, sun_d = _local(sun_km, up, east, north)
        sun_hz = horizon.horizon_elevation(grid, sun_az, eq.panel_height_m)
        sunlit = sun_el > sun_hz
        flux = SOLAR_CONSTANT * (AU_KM / sun_d) ** 2
        power = np.where(sunlit, flux * np.clip(_panel_cos(grid.normal, sun_dir, eq.panel_tilt_deg), 0, 1), 0.0)
        out.update(sun_el=sun_el, sun_az=sun_az, sun_hz=sun_hz, sunlit=sunlit, power=power)
    if "earth" in need:
        earth_el, earth_az, _, _ = _local(earth_km, up, east, north)
        earth_hz = horizon.horizon_elevation(grid, earth_az, eq.comm_height_m)
        margin = earth_el - np.maximum(earth_hz, eq.comm_mask_deg)
        out.update(earth_el=earth_el, earth_az=earth_az, earth_hz=earth_hz, margin=margin, visible=margin > 0)
    return out


_basis_cache: dict[str, tuple] = {}


def _grid_basis(grid: horizon.Grid) -> tuple:
    """Local up/east/north per cell (float32), cached for the shared analysis grids."""
    if grid.name in ("global", "southpole") and grid.name in _basis_cache:
        return _basis_cache[grid.name]
    b = tuple(x.astype(np.float32) for x in horizon._basis(grid.lat, grid.lon))
    if grid.name in ("global", "southpole"):
        _basis_cache[grid.name] = b
    return b


def _longest_run(flags: np.ndarray, step_h: float) -> float:
    """Longest consecutive stretch (hours) where flags is True."""
    best = cur = 0
    for f in flags:
        cur = cur + 1 if f else 0
        best = max(best, cur)
    return best * step_h


# ---------------------------------------------------------------- maps
KINDS = {
    "power": {"instant": ("W/m²", "Incident solar power on the panel"), "monthly": ("W/m²", "Mean incident solar power over one lunar month")},
    "sunlit": {"instant": ("bool", "Sun above terrain horizon (1) or not (0)"), "monthly": ("%", "Share of the lunar month in sunlight")},
    "comms": {"instant": ("deg", "Earth elevation margin above terrain and mask (≥0 = visible)"), "monthly": ("%", "Share of the lunar month with Earth in view")},
}


def coverage_map(grid_name: str, kind: str, mode: str, start: datetime, eq: Equipment) -> dict:
    if kind not in KINDS or mode not in ("instant", "monthly"):
        raise ValueError("kind must be power|sunlit|comms and mode instant|monthly")
    eq.validate()
    if mode == "monthly":  # monthly maps change slowly; reuse within the same hour
        start = start.replace(minute=0, second=0, microsecond=0)
    key = (grid_name, kind, mode, start.isoformat(), tuple(asdict(eq).values()))
    with _cache_lock:
        if key in _cache:
            _cache.move_to_end(key)
            return _cache[key]
    grid = horizon.get_grid(grid_name)
    basis = _grid_basis(grid)
    need = ("earth",) if kind == "comms" else ("sun",)
    if mode == "instant":
        times, sun, earth = _vectors(start, 0, 1)
        r = evaluate(grid, sun[0], earth[0], eq, basis, need)
        values = r["margin"] if kind == "comms" else r["power"] if kind == "power" else r["sunlit"].astype(np.float32)
    else:
        hours = SYNODIC_DAYS * 24
        times, sun, earth = _vectors(start, hours, MONTHLY_STEP_H)
        acc = np.zeros(grid.lat.size, np.float64)
        for i in range(len(times)):
            r = evaluate(grid, sun[i], earth[i], eq, basis, need)
            acc += r["visible"] if kind == "comms" else r["power"] if kind == "power" else r["sunlit"]
        values = acc / len(times)
        if kind != "power":
            values = values * 100
    values = np.where(grid.valid, values, np.nan).astype(np.float32)
    units, label = KINDS[kind][mode]
    finite = values[np.isfinite(values)]
    out = {
        "grid": grid_name, "kind": kind, "mode": mode, "units": units, "label": label,
        "width": grid.shape[1], "height": grid.shape[0], "layout": grid.description, "cellKm": grid.cell_km,
        "polarCapLat": horizon.POLAR_CAP_LAT, "polarRhoMaxM": horizon.polar_rho_max_m(),
        "start": times[0], "end": times[-1], "samples": len(times), "equipment": asdict(eq),
        "min": float(finite.min()) if finite.size else None, "max": float(finite.max()) if finite.size else None,
        "valuesF32": base64.b64encode(values.tobytes()).decode("ascii"), "method": METHOD,
    }
    with _cache_lock:
        _cache[key] = out
        while len(_cache) > _CACHE_MAX:
            _cache.popitem(last=False)
    return out


# ---------------------------------------------------------------- site statistics
def site_series(lat: float, lon: float, start: datetime, days: float, step_h: float, eq: Equipment) -> dict:
    """Hour-by-hour terrain-aware power and Earth visibility at one site, plus summary statistics."""
    eq.validate()
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Latitude must be -90..90 and longitude -180..180 degrees")
    la, lo = np.array([lat], float), np.array([lon], float)
    hz, hd = horizon.compute_horizons(la, lo)
    normal, slope = horizon._ground_normal(la, lo)
    point = horizon.Grid("site", (1, 1), la, lo, np.ones(1, bool), horizon.sample_dem(la, lo).astype(np.float32),
                         normal, slope.astype(np.float32), hz, hd, 0.0, "single site")
    times, sun, earth = _vectors(start, days * 24, step_h)
    basis = _grid_basis(point)
    rows = [evaluate(point, sun[i], earth[i], eq, basis) for i in range(len(times))]
    col = lambda k: np.array([float(r[k][0]) for r in rows])
    sunlit, visible, power = col("sunlit") > 0.5, col("visible") > 0.5, col("power")
    profile_az = np.arange(horizon.N_AZ) * 360 / horizon.N_AZ
    return {
        "location": {"latitudeDeg": lat, "longitudeDeg": lon, "frame": "MOON_ME"},
        "equipment": asdict(eq), "stepHours": step_h, "method": METHOD,
        "slopeDeg": float(slope[0]),
        "horizonProfile": {"azimuthDeg": profile_az.tolist(),
                           "panelDeg": horizon.horizon_elevation(point, profile_az, eq.panel_height_m, np.zeros(horizon.N_AZ, int)).tolist(),
                           "commDeg": horizon.horizon_elevation(point, profile_az, eq.comm_height_m, np.zeros(horizon.N_AZ, int)).tolist()},
        "series": {"utc": times, "sunElevationDeg": col("sun_el").tolist(), "sunHorizonDeg": col("sun_hz").tolist(),
                   "powerWm2": power.tolist(), "earthElevationDeg": col("earth_el").tolist(),
                   "earthLimitDeg": np.maximum(col("earth_hz"), eq.comm_mask_deg).tolist(), "earthVisible": visible.tolist(),
                   "sunlit": sunlit.tolist()},
        "summary": {
            "sunlitPct": float(sunlit.mean() * 100), "meanPowerWm2": float(power.mean()), "peakPowerWm2": float(power.max()),
            "energyKWhPerM2": float(power.sum() * step_h / 1000),
            "longestDarkHours": _longest_run(~sunlit, step_h), "earthVisiblePct": float(visible.mean() * 100),
            "longestCommOutageHours": _longest_run(~visible, step_h),
        },
    }


# ---------------------------------------------------------------- terrain-aware rise / set events
def _point_grid(lat: float, lon: float) -> tuple[horizon.Grid, tuple]:
    la, lo = np.array([lat], float), np.array([lon], float)
    hz, hd = horizon.compute_horizons(la, lo)
    normal, slope = horizon._ground_normal(la, lo)
    grid = horizon.Grid("site", (1, 1), la, lo, np.ones(1, bool), horizon.sample_dem(la, lo).astype(np.float32),
                        normal, slope.astype(np.float32), hz, hd, 0.0, "single site")
    return grid, _grid_basis(grid)


def terrain_events(lat: float, lon: float, start: datetime, eq: Equipment, days: float = 35.0) -> dict:
    """Next sunrise/sunset and Earthrise/Earthset against the real terrain skyline (and the receiver mask),
    found on an hourly scan and refined by bisection to under a minute."""
    eq.validate()
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise ValueError("Latitude must be -90..90 and longitude -180..180 degrees")
    grid, basis = _point_grid(lat, lon)
    times, sun, earth = _vectors(start, days * 24, 1.0)
    rows = [evaluate(grid, sun[i], earth[i], eq, basis) for i in range(len(times))]
    t0 = datetime.fromisoformat(times[0].replace("Z", "+00:00"))

    def state(key: str, when: datetime) -> bool:
        _, s, e = _vectors(when, 0, 1)
        r = evaluate(grid, s[0], e[0], eq, basis, ("sun",) if key == "sunlit" else ("earth",))
        return bool(r[key][0])

    def crossings(key: str):
        flags = [bool(r[key][0]) for r in rows]
        out = {"up": flags[0], "nextSet": None, "nextRise": None}
        for i in range(len(flags) - 1):
            if flags[i] == flags[i + 1]:
                continue
            lo, hi = t0 + timedelta(hours=i), t0 + timedelta(hours=i + 1)
            for _ in range(7):  # 60 min / 2^7 < 30 s
                mid = lo + (hi - lo) / 2
                if state(key, mid) == flags[i]:
                    lo = mid
                else:
                    hi = mid
            when = (lo + (hi - lo) / 2).astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            field = "nextSet" if flags[i] else "nextRise"
            if out[field] is None:
                out[field] = when
            if out["nextSet"] and out["nextRise"]:
                break
        return out

    return {"utc": times[0], "searchWindowDays": days, "equipment": asdict(eq), "method": METHOD,
            "sun": crossings("sunlit"), "earth": crossings("visible")}
