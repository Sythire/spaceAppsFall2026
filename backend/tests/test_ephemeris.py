"""SPICE geometry tests. Reference values come from JPL Horizons (observer on the Moon,
MEAN_ME frame, airless), fetched 2026-11-14."""
from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from api import ephemeris as eph

AU_KM = 149597870.7
UTC = timezone.utc

# (lat, lon, utc, body, Horizons azimuth, Horizons elevation)
HORIZONS_CASES = [
    (0.674, 23.473, datetime(2026, 11, 20, 23, 5, tzinfo=UTC), "sun", 96.862725, 71.427770),     # Apollo 11, equatorial
    (-89.5, 32.0, datetime(2026, 11, 14, 12, 0, tzinfo=UTC), "sun", 88.537332, 1.569432),        # south polar
    (-89.5, 32.0, datetime(2026, 11, 14, 12, 0, tzinfo=UTC), "earth", 326.094891, -3.706594),    # south polar, Earth below horizon
]


@pytest.mark.parametrize("lat,lon,utc,body,az,el", HORIZONS_CASES)
def test_site_angles_match_jpl_horizons(lat, lon, utc, body, az, el):
    result = eph.site(lat, lon, utc)
    assert result[body]["azimuthDeg"] == pytest.approx(az, abs=1e-3)
    assert result[body]["elevationDeg"] == pytest.approx(el, abs=1e-3)


def test_site_reports_frame_method_and_conventions():
    r = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12, tzinfo=UTC))
    assert r["location"]["frame"] == "MOON_ME"
    assert "no terrain" in r["horizonMethod"]
    assert r["azimuthConvention"] == "degrees clockwise from local north"
    assert r["utc"].endswith("Z")


def test_lunar_day_length_from_rise_and_set_events():
    """At the equator the Sun is up for about half a synodic month (~14.77 days)."""
    r = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12, tzinfo=UTC))
    assert r["sun"]["aboveHorizon"] is False
    rise = datetime.fromisoformat(r["sun"]["nextRise"].replace("Z", "+00:00"))
    set_ = datetime.fromisoformat(r["sun"]["nextSet"].replace("Z", "+00:00"))
    assert rise < set_
    assert (set_ - rise).total_seconds() / 86400 == pytest.approx(14.77, abs=0.5)


def test_rise_event_is_a_real_horizon_crossing():
    r = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12, tzinfo=UTC))
    rise = datetime.fromisoformat(r["sun"]["nextRise"].replace("Z", "+00:00"))
    before = eph.site(0.674, 23.473, rise - timedelta(minutes=5))["sun"]["elevationDeg"]
    after = eph.site(0.674, 23.473, rise + timedelta(minutes=5))["sun"]["elevationDeg"]
    assert before < 0 < after


def test_near_side_site_keeps_earth_up_all_month():
    """Apollo 11 is near the sub-Earth point: Earth never sets (libration is only ~±8°)."""
    r = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12, tzinfo=UTC))
    assert r["earth"]["aboveHorizon"] is True
    assert r["earth"]["nextSet"] is None
    assert r["earth"]["elevationDeg"] > 45


def test_far_side_site_never_sees_earth():
    r = eph.site(0.0, 180.0, datetime(2026, 11, 14, 12, tzinfo=UTC))
    assert r["earth"]["elevationDeg"] < -60
    assert r["earth"]["nextRise"] is None


def test_power_is_zero_at_night_and_positive_by_day():
    night = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12, tzinfo=UTC))
    day = eph.site(0.674, 23.473, datetime(2026, 11, 20, 23, 5, tzinfo=UTC))
    assert night["power"]["horizontalPanelWm2"] == 0
    assert day["power"]["horizontalPanelWm2"] == pytest.approx(
        day["power"]["solarFluxWm2"] * np.sin(np.radians(day["sun"]["elevationDeg"])), rel=1e-9)
    assert 1300 < day["power"]["solarFluxWm2"] < 1420  # inverse-square of ~0.98-1.02 AU


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), (0, -181)])
def test_site_rejects_out_of_range_coordinates(lat, lon):
    with pytest.raises(eph.EphemerisError):
        eph.site(lat, lon, datetime(2026, 11, 14, tzinfo=UTC))


def test_times_outside_kernel_coverage_raise_a_clear_error():
    with pytest.raises(eph.EphemerisError, match="SPKINSUFFDATA"):
        eph.series(datetime(2200, 1, 1, tzinfo=UTC), 1, 1, None, None)


def test_naive_datetimes_are_treated_as_utc():
    a = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12))
    b = eph.site(0.674, 23.473, datetime(2026, 11, 14, 12, tzinfo=UTC))
    assert a["sun"]["elevationDeg"] == pytest.approx(b["sun"]["elevationDeg"], abs=1e-9)


@pytest.fixture(scope="module")
def series():
    return eph.series(datetime(2026, 11, 14, tzinfo=UTC), 48, 6, -89.5, 32.0)


class TestSeries:
    def test_sample_count_and_spacing(self, series):
        samples = series["samples"]
        assert len(samples) == 9  # 0..48 h every 6 h, inclusive
        t0 = datetime.fromisoformat(samples[0]["utc"].replace("Z", "+00:00"))
        t1 = datetime.fromisoformat(samples[1]["utc"].replace("Z", "+00:00"))
        assert (t1 - t0) == timedelta(hours=6)

    def test_frames_are_declared(self, series):
        assert series["frame"] == "MOON_ME"
        assert series["helioFrame"] == "ECLIPJ2000"

    def test_heliocentric_distances_are_physical(self, series):
        s = series["samples"][0]["helio"]
        moon, earth, mars = (np.array(s[k]) for k in ("moon", "earth", "mars"))
        assert 0.98 < np.linalg.norm(earth) / AU_KM < 1.02
        assert 356_000 < np.linalg.norm(moon - earth) < 407_000  # perigee..apogee
        assert 1.38 < np.linalg.norm(mars) / AU_KM < 1.67          # perihelion..aphelion
        assert 0.30 < np.linalg.norm(s["mercury"]) / AU_KM < 0.47  # perihelion..aphelion
        assert 0.71 < np.linalg.norm(s["venus"]) / AU_KM < 0.73
        # Ecliptic frame: Earth stays in the ecliptic plane (|z| tiny relative to 1 AU).
        assert abs(earth[2]) / AU_KM < 1e-4

    def test_moon_centered_and_sun_centered_vectors_agree(self, series):
        """Sun as seen from the Moon (MOON_ME) must have the same length as -(Moon from Sun)."""
        s = series["samples"][0]
        d_moon_frame = np.linalg.norm(s["sun"])
        d_helio = np.linalg.norm(s["helio"]["moon"])
        assert d_moon_frame == pytest.approx(d_helio, rel=1e-5)  # LT+S vs geometric: tiny difference

    def test_rotation_quaternions_are_unit(self, series):
        for s in series["samples"]:
            assert np.linalg.norm(s["moonRotationQuat"]) == pytest.approx(1, abs=1e-9)
            assert np.linalg.norm(s["earthRotationQuat"]) == pytest.approx(1, abs=1e-9)

    def test_earth_spins_about_one_turn_per_sidereal_day(self, series):
        q0 = np.array(series["samples"][0]["earthRotationQuat"])
        q4 = np.array(series["samples"][4]["earthRotationQuat"])  # +24 h
        angle = np.degrees(2 * np.arccos(min(1.0, abs(float(q0 @ q4)))))
        assert angle == pytest.approx(0.986, abs=0.2)  # 24 h = 1 sidereal day + ~0.99°

    def test_site_angles_included_when_lat_lon_given(self, series):
        site = series["samples"][0]["site"]
        assert set(site) == {"sun", "earth"}
        assert series["horizonMethod"] is not None

    def test_site_angles_omitted_without_location(self):
        s = eph.series(datetime(2026, 11, 14, tzinfo=UTC), 1, 1, None, None)
        assert "site" not in s["samples"][0]
        assert s["horizonMethod"] is None


def test_scene_snapshot_sub_points():
    s = eph.scene(datetime(2026, 11, 14, 12, tzinfo=UTC))
    sub_earth = s["bodies"]["earth"]["subPoint"]
    # Libration keeps the sub-Earth point within ~±8° of 0°,0°.
    assert abs(sub_earth["latitudeDeg"]) < 8 and abs(sub_earth["longitudeDeg"]) < 9
    assert abs(s["bodies"]["sun"]["subPoint"]["latitudeDeg"]) < 1.6  # lunar obliquity ~1.54°
