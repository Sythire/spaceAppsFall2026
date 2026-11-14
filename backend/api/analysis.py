"""Scenario analysis derived locally from the installed NASA SPICE kernels."""
from datetime import datetime, timedelta, timezone
import math

from . import ephemeris as eph
from .schemas import AnalysisRequest


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _grid(duration: float, step: float) -> list[float]:
    offsets = [i * step for i in range(math.ceil(duration / step))]
    return offsets + [duration]


def _elapsed_hours(start: float, end: float) -> float:
    # SPICE epochs are TDB; durations must use uniform SI seconds (TAI).
    return (eph.spice.unitim(end, "TDB", "TAI") - eph.spice.unitim(start, "TDB", "TAI")) / 3600


def _windows(start: float, end: float, initially_up: bool, events: list[tuple[float, str]]):
    """Partition a bounded interval into visible and hidden windows."""
    visible, hidden = [], []
    cursor, up = start, initially_up
    for timestamp, kind in events + [(end, "end")]:
        if timestamp > cursor:
            (visible if up else hidden).append({
                "startUtc": eph._et_to_iso(cursor), "endUtc": eph._et_to_iso(timestamp),
                "durationHours": _elapsed_hours(cursor, timestamp),
                "clippedAtStart": cursor == start, "clippedAtEnd": timestamp == end,
            })
        cursor = timestamp
        up = kind == "rise"
    return visible, hidden


def _body(target: str, ets: list[float], scan: list[float], lat: float, lon: float):
    elevation, azimuth, distance = eph._surface_geometry(target, ets, lat, lon)
    scan_el = eph._surface_geometry(target, scan, lat, lon)[0]
    events = []
    for i in range(len(scan) - 1):
        a, b = float(scan_el[i]), float(scan_el[i + 1])
        if (a > 0) == (b > 0):
            continue
        lo, hi, lo_up = scan[i], scan[i + 1], a > 0
        while hi - lo > 0.1:
            mid = (lo + hi) / 2
            above = eph._surface_geometry(target, [mid], lat, lon)[0][0] > 0
            if above == lo_up:
                lo = mid
            else:
                hi = mid
        events.append(((lo + hi) / 2, "set" if lo_up else "rise"))
    visible, hidden = _windows(ets[0], ets[-1], bool(elevation[0] > 0), events)
    visible_hours = sum(w["durationHours"] for w in visible)
    summary = {
        "aboveHorizonHours": visible_hours,
        "belowHorizonHours": _elapsed_hours(ets[0], ets[-1]) - visible_hours,
        "aboveHorizonPercent": 100 * visible_hours / _elapsed_hours(ets[0], ets[-1]),
        "visibleWindows": visible, "hiddenWindows": hidden,
        "events": [{"utc": eph._et_to_iso(t), "type": kind} for t, kind in events],
        "nextRise": next((eph._et_to_iso(t) for t, kind in events if kind == "rise"), None),
        "nextSet": next((eph._et_to_iso(t) for t, kind in events if kind == "set"), None),
    }
    samples = [{"elevationDeg": float(el), "azimuthDeg": float(az),
                "distanceKm": float(dist), "aboveHorizon": bool(el > 0)}
               for el, az, dist in zip(elevation, azimuth, distance)]
    return samples, summary


@eph._guard
def analyze(request: AnalysisRequest) -> dict:
    start = request.utc.astimezone(timezone.utc)
    offsets = _grid(request.durationHours, request.stepHours)
    # Use UTC interval endpoints so an Earth leap second does not shift the end.
    ets = [eph._to_et(start + timedelta(hours=hour)) for hour in offsets]
    scan = [eph._to_et(start + timedelta(hours=hour))
            for hour in _grid(request.durationHours, min(request.stepHours, 1))]
    lat, lon = request.location.latitudeDeg, request.location.longitudeDeg
    sun, sunlight = _body("SUN", ets, scan, lat, lon)
    earth, visibility = _body("EARTH", ets, scan, lat, lon)
    timeline = []
    for i, hour in enumerate(offsets):
        flux = eph.SOLAR_CONSTANT_W_M2 * (149597870.7 / sun[i]["distanceKm"]) ** 2
        timeline.append({
            "hour": hour, "utc": eph._et_to_iso(ets[i]), "sun": sun[i], "earth": earth[i],
            "sunlightPercent": 100 if sun[i]["aboveHorizon"] else 0,
            "earthVisibilityPercent": 100 if earth[i]["aboveHorizon"] else 0,
            "solarFluxWm2": flux,
            "horizontalIrradianceWm2": flux * max(0, math.sin(math.radians(sun[i]["elevationDeg"]))),
        })
    return {
        "request": request.model_dump(mode="json", exclude_none=True), "mode": "modeled", "source": eph.SOURCE,
        "sun": {**sun[0], "nextRise": sunlight["nextRise"], "nextSet": sunlight["nextSet"]},
        "earth": {**earth[0], "nextRise": visibility["nextRise"], "nextSet": visibility["nextSet"]},
        "illumination": {"sunlightPercent": sunlight["aboveHorizonPercent"], "timeline": timeline,
                         "daylightHours": sunlight["aboveHorizonHours"],
                         "darknessHours": sunlight["belowHorizonHours"], **sunlight},
        "earthVisibilityPercent": visibility["aboveHorizonPercent"], "earthVisibility": visibility,
        "terrain": {"slopeDeg": None, "temperatureK": None, "permanentlyShadowed": None},
        "suitability": None,
        "interval": {"startUtc": _iso(start), "endUtc": _iso(start + timedelta(hours=request.durationHours)),
                     "durationHours": request.durationHours, "stepHours": request.stepHours,
                     "elapsedHours": _elapsed_hours(ets[0], ets[-1]), "sampleCount": len(timeline)},
        "metadata": {"generatedAtUtc": _iso(datetime.now(timezone.utc)),
                     "provenance": eph._provenance(), "horizonMethod": eph.HORIZON_METHOD,
                     "azimuthConvention": "degrees clockwise from local north",
                     "angleUnits": "degrees", "distanceUnits": "km", "timeScale": "UTC",
                     "eventScanStepHours": min(request.stepHours, 1), "eventRefinementSeconds": 0.1,
                     "uncertaintyDeg": None,
                     "limitations": [
                         "Smooth sphere at zero height; no terrain, limb/partial-disk visibility, eclipses or atmospheric refraction.",
                         "Sunlight and visibility use body-center elevation > 0 degrees. Timeline percentages are binary states, not power efficiency.",
                         "Duration percentages are integrated over the requested interval; windows are clipped to its boundaries.",
                         "Crossings are refined inside sampled sign changes; brief or grazing events within a scan step may be missed. Refinement is not physical accuracy.",
                         "Null nextRise/nextSet means no event found within this interval, not that it never happens.",
                         "Earth visibility is geometric direction to Earth's center, not a ground-station contact or link budget.",
                         "Irradiance is incident solar energy per area on an ideal horizontal surface, not electrical power.",
                         "Thermal, slope, permanent shadow and suitability products are unavailable.",
                     ]},
    }
