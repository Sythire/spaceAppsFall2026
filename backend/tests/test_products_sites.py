"""Official PSR map, Diviner temperatures, CLPS catalogue, terrain-aware events and their endpoints."""
import base64
import math
from datetime import datetime, timezone

import numpy as np
import pytest

from api import catalog, data_products as dp, power_comms as pc, terrain

UTC = timezone.utc


@pytest.mark.skipif(not dp.psr_available(), reason="PSR map not downloaded")
class TestPsr:
    @pytest.mark.parametrize("name,lat,lon", [("Shackleton", -89.67, 129.8), ("Haworth", -87.45, -5.0),
                                               ("Faustini", -87.3, 77.0), ("Cabeus", -85.33, -42.13)])
    def test_known_permanently_shadowed_craters(self, name, lat, lon):
        assert dp.psr_at(lat, lon) is True, name

    @pytest.mark.parametrize("lat,lon", [(-86.0, 0.0), (-78.0, 40.0)])
    def test_sunlit_ground_is_not_psr(self, lat, lon):
        assert dp.psr_at(lat, lon) is False

    def test_outside_coverage_is_unknown_not_false(self):
        assert dp.psr_at(0.674, 23.473) is None
        assert dp.psr_at(-70.0, 0.0) is None

    def test_grid_matches_point_lookup_and_is_centred(self):
        g = dp.psr_grid()
        v = np.frombuffer(base64.b64decode(g["valuesF32"]), "<f4").reshape(g["height"], g["width"])
        assert 0.02 < v.mean() < 0.05                     # a few % of 75°S–pole is permanently shadowed
        assert g["capLat"] == pytest.approx(-75.0, abs=0.05)
        cell = g["cellKm"] * 1000
        for lat, lon in [(-89.67, 129.8), (-87.45, -5.0), (-86.0, 0.0)]:
            rho = 2 * dp.R_M * math.tan(math.radians(90 + lat) / 2)
            x, y = rho * math.cos(math.radians(lon)), rho * math.sin(math.radians(lon))
            r, c = int((y + g["rhoMaxM"]) / cell), int((x + g["rhoMaxM"]) / cell)
            assert (v[r, c] > 0.5) == dp.psr_at(lat, lon)


@pytest.mark.skipif(not dp.thermal_available(), reason="Diviner maps not downloaded")
class TestThermal:
    def test_equatorial_day_and_night_temperatures(self):
        t = dp.thermal_at(0.674, 23.473)
        assert 370 < t["dayMaxK"] < 410       # lunar noon ~390 K
        assert 85 < t["nightMinK"] < 110      # pre-dawn ~95 K

    def test_psr_cold_trap_is_cold_all_day(self):
        t = dp.thermal_at(-89.67, 129.8)
        assert t["dayMaxK"] < 130 and t["nightMinK"] < 60

    def test_grid_is_global_and_physical(self):
        g = dp.thermal_grid("nightmin")
        v = np.frombuffer(base64.b64decode(g["valuesF32"]), "<f4")
        assert g["width"] == 1440 and g["height"] == 720 and v.size == 1440 * 720
        assert 15 < g["min"] < 30 and g["max"] < 260
        assert np.isfinite(v).mean() > 0.95
        assert dp.thermal_grid("daymax")["max"] < 420

    def test_longitude_convention(self):
        """Column 0 must be 180°W after re-centring: the column for 23.5°E must hold the Apollo 11 value."""
        g = dp.thermal_grid("daymax")
        v = np.frombuffer(base64.b64decode(g["valuesF32"]), "<f4").reshape(720, 1440)
        row, col = int((90 - 0.674) * 4), int((23.473 + 180) * 4)
        assert v[row, col] == pytest.approx(dp.thermal_at(0.674, 23.473)["dayMaxK"])

    def test_bad_product(self):
        with pytest.raises(ValueError):
            dp.thermal_grid("noon")


def test_clps_sites_are_sourced_and_labelled():
    clps = [s for s in catalog.SITES if s.get("program") == "NASA CLPS"]
    assert {s["id"] for s in clps} >= {"clps-im-1", "clps-blue-ghost-1", "clps-im-2"}
    for s in clps:
        assert s["source"].startswith("https://") and -90 <= s["latitudeDeg"] <= 90 and -180 <= s["longitudeDeg"] <= 180
        if s["kind"] == "clps-planned":
            assert "not a landing point" in s["coordinateNote"]
    ids = [s["id"] for s in catalog.SITES]
    assert len(ids) == len(set(ids))
    im2 = next(s for s in clps if s["id"] == "clps-im-2")
    assert (im2["latitudeDeg"], im2["longitudeDeg"]) == (-84.7906, 29.1957)


@pytest.mark.skipif(not terrain.available(), reason="DEM not available")
def test_terrain_events_bracket_real_crossings():
    start = datetime(2026, 11, 14, 12, tzinfo=UTC)
    ev = pc.terrain_events(0.674, 23.473, start, pc.Equipment())
    assert ev["sun"]["up"] is False and ev["earth"]["up"] is True and ev["earth"]["nextSet"] is None
    rise = datetime.fromisoformat(ev["sun"]["nextRise"].replace("Z", "+00:00"))
    grid, basis = pc._point_grid(0.674, 23.473)
    def lit(t):
        _, s, e = pc._vectors(t, 0, 1)
        return bool(pc.evaluate(grid, s[0], e[0], pc.Equipment(), basis, ("sun",))["sunlit"][0])
    from datetime import timedelta
    assert not lit(rise - timedelta(minutes=2)) and lit(rise + timedelta(minutes=2))


def test_every_catalogue_site_is_accepted_by_the_analysis_schema():
    """The frontend posts catalogue entries straight back in analysis/comparison requests."""
    from api.schemas import AnalysisRequest
    for site in catalog.SITES:
        AnalysisRequest(location=site, utc="2026-11-14T12:00:00Z", durationHours=24)
