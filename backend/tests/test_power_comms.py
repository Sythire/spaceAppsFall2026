"""Terrain horizons and terrain-aware power / communication statistics."""
import base64
import math
from datetime import datetime, timezone

import numpy as np
import pytest

from api import horizon, power_comms as pc, terrain

UTC = timezone.utc
pytestmark = pytest.mark.skipif(not terrain.available(), reason="ldem_16_uint.tif not in modelResources")


# ---------------------------------------------------------------- synthetic terrain
@pytest.fixture
def synthetic_dem(monkeypatch):
    """Replace the DEM with a flat sphere; tests may add features to the returned array."""
    real = terrain._load()
    dem = np.zeros_like(real)
    monkeypatch.setattr(terrain, "_dem", dem)
    return dem


def test_destination_moves_the_right_distance_and_direction():
    lat, lon = horizon._destination(np.array([0.0]), np.array([0.0]), 0.0, np.array([100_000.0]))
    assert lat[0] == pytest.approx(math.degrees(100_000 / horizon.R_M), rel=1e-9)  # due north
    assert lon[0] == pytest.approx(0, abs=1e-9)
    lat, lon = horizon._destination(np.array([0.0]), np.array([179.9]), math.pi / 2, np.array([30_000.0]))
    assert lon[0] < -179  # wraps across the dateline heading east


def test_flat_moon_horizon_is_just_below_level(synthetic_dem):
    hz, hd = horizon.compute_horizons(np.array([10.0]), np.array([20.0]))
    # On a bare sphere the steepest "slope" is the curvature drop at the first sample: -d/(2R).
    expected = -horizon.DISTANCES_M[0] / (2 * horizon.R_M)
    assert np.allclose(hz, expected, atol=1e-6)
    grid = horizon.Grid("t", (1, 1), np.array([10.0]), np.array([20.0]), np.ones(1, bool), np.zeros(1, np.float32),
                        np.array([[1.0, 0, 0]]), np.zeros(1, np.float32), hz, hd, 0, "")
    flat = horizon.horizon_elevation(grid, np.array([0.0]), 0.0)
    raised = horizon.horizon_elevation(grid, np.array([0.0]), 10.0)
    assert -0.02 < flat[0] < 0 and raised[0] < flat[0]  # a taller mast sees further down


def test_a_ridge_to_the_north_raises_only_the_northern_horizon(synthetic_dem):
    # 1000 m wall roughly 20 km north of a site at the equator (1/16° rows ≈ 1.9 km each).
    row_site = int(90 * 16)
    synthetic_dem[row_site - 11:row_site - 9, :] = 1000.0
    hz, hd = horizon.compute_horizons(np.array([0.0]), np.array([0.0]))
    north = math.degrees(math.atan(hz[0, 0]))
    south = math.degrees(math.atan(hz[0, horizon.N_AZ // 2]))
    expected = math.degrees(math.atan(1000 / hd[0, 0] - hd[0, 0] / (2 * horizon.R_M)))
    assert north == pytest.approx(expected, abs=0.05)
    assert 2.0 < north < 4.0          # ~1 km at ~19-21 km
    assert south < 0.0
    assert 15_000 < hd[0, 0] < 25_000


def test_panel_cosine_for_tilt_and_sun_elevation():
    up = np.array([[0.0, 0.0, 1.0]])
    el = math.radians(30)
    sun = np.array([[math.cos(el), 0.0, math.sin(el)]])
    assert pc._panel_cos(up, sun, 0)[0] == pytest.approx(0.5)                  # flat panel: sin(30°)
    assert pc._panel_cos(up, sun, 60)[0] == pytest.approx(1.0)                 # tilted to face the Sun
    assert pc._panel_cos(up, sun, 90)[0] == pytest.approx(math.cos(el))       # vertical, facing the Sun
    overhead = np.array([[0.0, 0.0, 1.0]])
    assert pc._panel_cos(up, overhead, 30)[0] == pytest.approx(1.0)           # Sun at zenith: tilt undefined, use ground


@pytest.mark.parametrize("kwargs", [dict(panel_tilt_deg=-1), dict(panel_tilt_deg=91), dict(comm_mask_deg=95),
                                    dict(panel_height_m=-1), dict(comm_height_m=5000)])
def test_equipment_validation(kwargs):
    with pytest.raises(ValueError):
        pc.Equipment(**kwargs).validate()


def test_longest_run():
    assert pc._longest_run(np.array([1, 1, 0, 1, 1, 1, 0], bool), 2.0) == 6.0
    assert pc._longest_run(np.zeros(5, bool), 1.0) == 0.0


# ---------------------------------------------------------------- real terrain, real ephemeris
@pytest.fixture(scope="module")
def apollo11():
    return pc.site_series(0.674, 23.473, datetime(2026, 11, 14, tzinfo=UTC), 30, 1, pc.Equipment())


def test_apollo11_month_is_half_sunlit_and_earth_always_up(apollo11):
    s = apollo11["summary"]
    assert 45 < s["sunlitPct"] < 55
    assert s["earthVisiblePct"] == 100 and s["longestCommOutageHours"] == 0
    assert 300 < s["longestDarkHours"] < 370          # a lunar night is ~354 h
    assert s["peakPowerWm2"] < 1420


def test_series_is_internally_consistent(apollo11):
    ser, s = apollo11["series"], apollo11["summary"]
    power = np.array(ser["powerWm2"])
    sunlit = np.array(ser["sunlit"])
    assert np.all(power[~sunlit] == 0)
    assert np.all(np.array(ser["sunElevationDeg"])[sunlit] > np.array(ser["sunHorizonDeg"])[sunlit])
    assert s["meanPowerWm2"] == pytest.approx(power.mean())
    assert s["energyKWhPerM2"] == pytest.approx(power.sum() / 1000)
    assert len(apollo11["horizonProfile"]["azimuthDeg"]) == horizon.N_AZ


def test_tilting_panels_helps_at_the_pole_and_mask_reduces_earth_time():
    start = datetime(2026, 11, 14, tzinfo=UTC)
    flat = pc.site_series(-89.5, 32, start, 30, 2, pc.Equipment())
    tilted = pc.site_series(-89.5, 32, start, 30, 2, pc.Equipment(panel_tilt_deg=80, comm_mask_deg=5))
    assert tilted["summary"]["meanPowerWm2"] > 5 * flat["summary"]["meanPowerWm2"]
    assert tilted["summary"]["earthVisiblePct"] <= flat["summary"]["earthVisiblePct"]


def test_taller_mast_never_sees_less():
    start = datetime(2026, 11, 14, tzinfo=UTC)
    low = pc.site_series(-89.5, 32, start, 30, 2, pc.Equipment(panel_height_m=0, comm_height_m=0))
    high = pc.site_series(-89.5, 32, start, 30, 2, pc.Equipment(panel_height_m=200, comm_height_m=200))
    assert high["summary"]["sunlitPct"] >= low["summary"]["sunlitPct"]
    assert high["summary"]["earthVisiblePct"] >= low["summary"]["earthVisiblePct"]


# ---------------------------------------------------------------- maps on a small stand-in grid
@pytest.fixture
def tiny_grid(monkeypatch):
    lat = np.array([0.674, -89.5, 0.0, 45.0])
    lon = np.array([23.473, 32.0, 180.0, -60.0])
    hz, hd = horizon.compute_horizons(lat, lon)
    normal, slope = horizon._ground_normal(lat, lon)
    grid = horizon.Grid("global", (2, 2), lat, lon, np.array([True, True, True, False]),
                        horizon.sample_dem(lat, lon).astype(np.float32), normal, slope.astype(np.float32), hz, hd, 15.2, "test")
    monkeypatch.setitem(horizon._grids, "global", grid)
    monkeypatch.setattr(pc, "_cache", type(pc._cache)())
    return grid


def _decode(m):
    return np.frombuffer(base64.b64decode(m["valuesF32"]), dtype="<f4").reshape(m["height"], m["width"])


def test_instant_maps(tiny_grid):
    t = datetime(2026, 11, 20, 23, 5, tzinfo=UTC)  # local noon-ish at Apollo 11
    power = _decode(pc.coverage_map("global", "power", "instant", t, pc.Equipment()))
    comms = _decode(pc.coverage_map("global", "comms", "instant", t, pc.Equipment()))
    assert 1000 < power[0, 0] < 1400              # high Sun at Apollo 11
    assert comms[0, 0] > 40                        # Earth high above the horizon at Apollo 11
    assert comms[1, 0] < 0                         # far side: Earth below horizon
    assert np.isnan(power[1, 1])                   # masked cell


def test_monthly_maps_are_percentages(tiny_grid):
    m = pc.coverage_map("global", "comms", "monthly", datetime(2026, 11, 14, tzinfo=UTC), pc.Equipment())
    v = _decode(m)
    assert m["units"] == "%" and m["samples"] == int(round(pc.SYNODIC_DAYS * 24 / pc.MONTHLY_STEP_H)) + 1
    assert v[0, 0] == pytest.approx(100) and v[1, 0] == pytest.approx(0)
    sun = _decode(pc.coverage_map("global", "sunlit", "monthly", datetime(2026, 11, 14, tzinfo=UTC), pc.Equipment()))
    assert 40 < sun[0, 0] < 60


def test_unknown_kind_is_rejected(tiny_grid):
    with pytest.raises(ValueError):
        pc.coverage_map("global", "radiation", "instant", datetime(2026, 11, 14, tzinfo=UTC), pc.Equipment())


def test_polar_grid_cells_lie_inside_the_cap():
    lat, lon, valid, shape = horizon._polar_cells(64)
    assert shape == (64, 64)
    assert np.all(lat[valid] <= horizon.POLAR_CAP_LAT + 1e-9)
    assert lat.min() > -90 and valid.sum() > 0.7 * 64 * 64   # inscribed disc ≈ 78.5% of the square
