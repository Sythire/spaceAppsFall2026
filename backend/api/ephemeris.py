"""Moon-anchored ephemeris geometry backed by NAIF SPICE kernels.

All vectors are expressed in the MOON_ME (Mean Earth / polar axis, DE440) body-fixed
frame with the Moon's center as origin, in kilometres. Site geometry uses a mean
lunar sphere (no terrain), and no atmospheric refraction, since the Moon has none.
"""
from __future__ import annotations

import math
import os
import threading
import hashlib
from functools import lru_cache, wraps
from datetime import datetime, timezone

import numpy as np
import spiceypy as spice

KERNEL_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "..", "ephermis_data_retreiver", "required_kernels"
)
KERNELS = [
    "naif0012.tls",               # leap seconds
    "pck00011.tpc",               # body radii, IAU_EARTH orientation
    "de440s.bsp",                 # planetary ephemeris 1849-2150
    "moon_pa_de440_200625.bpc",   # high-accuracy lunar orientation (libration)
    "moon_de440_250416.tf",       # MOON_ME / MOON_PA frame definitions
]
FRAME = "MOON_ME"
ABCORR = "LT+S"
MOON_MEAN_RADIUS_KM = 1737.4
SOLAR_CONSTANT_W_M2 = 1361.0
BODIES = {"sun": "SUN", "earth": "EARTH", "mars": "MARS BARYCENTER"}
# Sun-centric display frame: origin at the Sun, ecliptic-of-J2000 axes (ecliptic plane = XY), geometric
# positions. Site angles and rise/set events are still computed Moon-fixed above, which is what a lander sees.
HELIO_FRAME = "ECLIPJ2000"
HELIO_BODIES = {"moon": "MOON", "earth": "EARTH", "mars": "MARS BARYCENTER"}
SOURCE = "NAIF SPICE: DE440s ephemeris, moon_pa_de440_200625 orientation, MOON_ME frame (moon_de440_250416.tf)"
HORIZON_METHOD = "Mean lunar sphere (R = 1737.4 km), body disk center, no terrain, no refraction"

_lock = threading.Lock()
_loaded = False


class EphemerisError(ValueError):
    """Raised for requests outside kernel coverage or otherwise invalid."""


class KernelError(RuntimeError):
    """Required local scientific data are missing or cannot be loaded."""


def load_kernels() -> None:
    global _loaded
    with _lock:
        if _loaded:
            return
        missing = [name for name in KERNELS if not os.path.isfile(os.path.join(KERNEL_DIR, name))]
        if missing:
            raise KernelError("Missing SPICE kernels: " + ", ".join(missing))
        loaded = []
        try:
            for name in KERNELS:
                path = os.path.join(KERNEL_DIR, name)
                spice.furnsh(path)
                loaded.append(path)
        except spice.utils.exceptions.SpiceyError as exc:
            for path in reversed(loaded):
                spice.unload(path)
            raise KernelError("Unable to load SPICE kernels: " + str(exc)) from exc
        _loaded = True


def _to_et(utc: datetime) -> float:
    if utc.tzinfo is None:
        utc = utc.replace(tzinfo=timezone.utc)
    utc = utc.astimezone(timezone.utc)
    return spice.str2et(utc.strftime("%Y-%m-%dT%H:%M:%S.%f"))


def _et_to_iso(et: float) -> str:
    return spice.et2utc(et, "ISOC", 3) + "Z"


def _positions(target: str, ets: list[float]) -> np.ndarray:
    pos, _ = spice.spkpos(target, ets, FRAME, ABCORR, "MOON")
    return np.atleast_2d(np.asarray(pos, dtype=float))


def _helio(target: str, ets: list[float]) -> np.ndarray:
    pos, _ = spice.spkpos(target, ets, HELIO_FRAME, "NONE", "SUN")
    return np.atleast_2d(np.asarray(pos, dtype=float))


def _quat(frm: str, to: str, et: float) -> list[float]:
    return [float(x) for x in spice.m2q(spice.pxform(frm, to, et))]  # SPICE order: w, x, y, z


def _site_basis(lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    lat, lon = math.radians(lat_deg), math.radians(lon_deg)
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    north = np.cross(up, east)
    return up * MOON_MEAN_RADIUS_KM, up, east, north


def _horizon_angles(body_pos: np.ndarray, lat_deg: float, lon_deg: float) -> tuple[np.ndarray, np.ndarray]:
    site, up, east, north = _site_basis(lat_deg, lon_deg)
    v = body_pos - site
    v /= np.linalg.norm(v, axis=1, keepdims=True)
    el = np.degrees(np.arcsin(np.clip(np.sum(v * up, axis=1), -1, 1)))
    az = (np.degrees(np.arctan2(np.sum(v * east, axis=1), np.sum(v * north, axis=1))) + 360.0) % 360.0
    return el, az


def _surface_geometry(target: str, ets: list[float], lat: float, lon: float):
    """Apparent topocentric vectors, including the surface observer's velocity.

    Unlike subtracting a site from a Moon-center apparent vector, SPKCPO applies
    light time and stellar aberration for the actual surface observer.
    """
    site, up, east, north = _site_basis(lat, lon)
    vectors = np.asarray([
        spice.spkcpo(target, et, FRAME, "OBSERVER", ABCORR, site, "MOON", FRAME)[0][:3]
        for et in ets
    ])
    distances = np.linalg.norm(vectors, axis=1)
    directions = vectors / distances[:, None]
    elevation = np.degrees(np.arcsin(np.clip(np.sum(directions * up, axis=1), -1, 1)))
    azimuth = np.degrees(np.arctan2(np.sum(directions * east, axis=1),
                                   np.sum(directions * north, axis=1))) % 360
    return elevation, azimuth, distances


def _latlon(vec: np.ndarray) -> dict:
    _, lon, lat = spice.reclat(vec)
    return {"latitudeDeg": math.degrees(lat), "longitudeDeg": math.degrees(lon)}


def _guard(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        load_kernels()
        with _lock:
            try:
                return fn(*args, **kwargs)
            except spice.utils.exceptions.SpiceyError as exc:  # coverage / time errors
                detail = (getattr(exc, "long", "") or str(exc)).strip()
                raise EphemerisError(f"{getattr(exc, 'short', 'SPICE error')}: {detail}") from exc
    return wrapper


@_guard
def scene(utc: datetime) -> dict:
    et = _to_et(utc)
    out = {"utc": _et_to_iso(et), "frame": FRAME, "units": "km", "aberration": ABCORR, "source": SOURCE, "bodies": {}}
    for key, target in BODIES.items():
        p = _positions(target, [et])[0]
        out["bodies"][key] = {"positionKm": p.tolist(), "distanceKm": float(np.linalg.norm(p)),
                              "subPoint": _latlon(p)}
    q = spice.m2q(spice.pxform("IAU_EARTH", FRAME, et))
    out["earthRotationQuat"] = [float(x) for x in q]  # SPICE order: w, x, y, z
    out["moonRadiusKm"] = MOON_MEAN_RADIUS_KM
    return out


@_guard
def series(start: datetime, hours: float, step_hours: float, lat: float | None, lon: float | None) -> dict:
    et0 = _to_et(start)
    n = int(hours // step_hours) + 1
    ets = [et0 + i * step_hours * 3600.0 for i in range(n)]
    pos = {k: _positions(t, ets) for k, t in BODIES.items()}
    helio = {k: _helio(t, ets) for k, t in HELIO_BODIES.items()}
    earth_q = [_quat("IAU_EARTH", HELIO_FRAME, et) for et in ets]
    moon_q = [_quat(FRAME, HELIO_FRAME, et) for et in ets]
    samples = []
    site = None
    if lat is not None and lon is not None:
        sel, saz, _ = _surface_geometry("SUN", ets, lat, lon)
        eel, eaz, _ = _surface_geometry("EARTH", ets, lat, lon)
        site = (sel, saz, eel, eaz)
    for i, et in enumerate(ets):
        s = {"utc": _et_to_iso(et), "sun": pos["sun"][i].tolist(), "earth": pos["earth"][i].tolist(),
             "mars": pos["mars"][i].tolist(),
             "helio": {k: helio[k][i].tolist() for k in HELIO_BODIES},
             "moonRotationQuat": moon_q[i], "earthRotationQuat": earth_q[i]}
        if site:
            s["site"] = {"sun": {"elevationDeg": float(site[0][i]), "azimuthDeg": float(site[1][i])},
                         "earth": {"elevationDeg": float(site[2][i]), "azimuthDeg": float(site[3][i])}}
        samples.append(s)
    return {"frame": FRAME, "helioFrame": HELIO_FRAME, "units": "km", "stepHours": step_hours, "source": SOURCE,
            "horizonMethod": HORIZON_METHOD if site else None, "samples": samples}


def _find_crossings(target: str, et0: float, lat: float, lon: float, span_h: float, step_h: float) -> list[tuple[float, str]]:
    ets = [et0 + i * step_h * 3600.0 for i in range(int(span_h / step_h) + 1)]
    el, _, _ = _surface_geometry(target, ets, lat, lon)
    events = []
    for i in range(len(ets) - 1):
        a, b = el[i], el[i + 1]
        if (a > 0) == (b > 0):
            continue
        lo, hi, flo = ets[i], ets[i + 1], a
        for _ in range(20):  # bisect to well under a minute
            mid = 0.5 * (lo + hi)
            fm = _surface_geometry(target, [mid], lat, lon)[0][0]
            if (fm > 0) == (flo > 0):
                lo, flo = mid, fm
            else:
                hi = mid
        events.append((0.5 * (lo + hi), "set" if a > 0 else "rise"))
    return events


@_guard
def site(lat: float, lon: float, utc: datetime, search_days: float = 35.0) -> dict:
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise EphemerisError("Latitude must be -90..90 and longitude -180..180 degrees")
    et = _to_et(utc)
    result = {"utc": _et_to_iso(et), "location": {"latitudeDeg": lat, "longitudeDeg": lon, "frame": FRAME},
              "source": SOURCE, "horizonMethod": HORIZON_METHOD, "searchWindowDays": search_days,
              "azimuthConvention": "degrees clockwise from local north"}
    for key in ("sun", "earth"):
        el, az, distance = _surface_geometry(BODIES[key], [et], lat, lon)
        events = _find_crossings(BODIES[key], et, lat, lon, search_days * 24, 1.0)
        nxt = lambda kind: next((_et_to_iso(t) for t, k in events if k == kind), None)
        result[key] = {"elevationDeg": float(el[0]), "azimuthDeg": float(az[0]),
                       "distanceKm": float(distance[0]), "aboveHorizon": bool(el[0] > 0),
                       "nextSet": nxt("set"), "nextRise": nxt("rise")}
    # Solar flux at the Moon's distance from the Sun, and on an ideal flat horizontal panel.
    au_km = 149597870.7
    flux = SOLAR_CONSTANT_W_M2 * (au_km / result["sun"]["distanceKm"]) ** 2
    result["power"] = {
        "solarFluxWm2": flux,
        "horizontalPanelWm2": flux * max(0.0, math.sin(math.radians(result["sun"]["elevationDeg"]))),
        "assumptions": "Total solar irradiance 1361 W/m2 at 1 AU scaled by inverse square; flat horizontal "
                       "panel, sun disk center, no terrain shadowing, no conversion losses",
    }
    return result


@lru_cache(maxsize=1)
def _provenance() -> dict:
    """Called under the SPICE lock; bounds come from the installed files."""
    root = "https://naif.jpl.nasa.gov/pub/naif/generic_kernels/"
    paths = ["lsk/naif0012.tls", "pck/pck00011.tpc", "spk/planets/de440s.bsp",
             "pck/moon_pa_de440_200625.bpc", "fk/satellites/moon_de440_250416.tf"]
    kernels = []
    for name, remote in zip(KERNELS, paths):
        path = os.path.join(KERNEL_DIR, name)
        digest = hashlib.sha256()
        with open(path, "rb") as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(block)
        kernels.append({"file": name, "url": root + remote, "sha256": digest.hexdigest(),
                        "bytes": os.path.getsize(path)})
    windows = [spice.spkcov(os.path.join(KERNEL_DIR, "de440s.bsp"), body) for body in (10, 301, 399)]
    orientation = spice.utils.support_types.SPICEDOUBLE_CELL(100)
    spice.pckcov(os.path.join(KERNEL_DIR, "moon_pa_de440_200625.bpc"), 31008, orientation)
    windows.append(orientation)
    common = windows[0]
    for window in windows[1:]:
        common = spice.wnintd(common, window)
    intervals = [spice.wnfetd(common, i) for i in range(spice.wncard(common))]
    return {"provider": "NASA/JPL NAIF SPICE", "kernels": kernels, "frame": FRAME,
            "frameRealization": "MOON_ME_DE440_ME421", "aberrationCorrection": ABCORR,
            "toolkitVersion": spice.tkvrsn("TOOLKIT"), "spiceypyVersion": spice.__version__,
            "coverage": [{"startUtc": _et_to_iso(a), "endUtc": _et_to_iso(b)} for a, b in intervals],
            "coverageNote": "Intersection of Sun/Earth/Moon SPK and lunar orientation coverage; "
                            "light-time correction can require data before an interval boundary.",
            "retrievedAtUtc": None,
            "retrievalNote": "Bundled local kernels; original download date is not recorded. SHA256 identifies installed bytes."}


@_guard
def coverage() -> dict:
    metadata = _provenance()
    intervals = metadata["coverage"]
    return {"kernels": KERNELS, "frame": FRAME, "validFromUtc": intervals[0]["startUtc"],
            "validToUtc": intervals[-1]["endUtc"], "source": SOURCE, "provenance": metadata}
