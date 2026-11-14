"""LOLA DEM tests (modelResources/ldem_16_uint.tif). Skipped if the file is not present."""
import numpy as np
import pytest

from api import terrain

pytestmark = pytest.mark.skipif(not terrain.available(), reason="ldem_16_uint.tif not in modelResources")


def test_info_matches_known_lunar_extremes():
    info = terrain.info()
    assert (info["width"], info["height"], info["pixelsPerDegree"]) == (5760, 2880, 16)
    # Lowest (Antoniadi crater) about -9 km, highest (Selenean summit) about +10.7 km vs 1737.4 km.
    assert -9200 < info["minM"] < -8700
    assert 10400 < info["maxM"] < 10900


def test_highest_and_lowest_points_are_where_they_should_be():
    dem = terrain._load()
    def latlon(idx):
        r, c = np.unravel_index(idx, dem.shape)
        return 90 - (r + 0.5) / 16, -180 + (c + 0.5) / 16
    hi_lat, hi_lon = latlon(dem.argmax())
    lo_lat, lo_lon = latlon(dem.argmin())
    assert hi_lat == pytest.approx(5.4, abs=1) and hi_lon == pytest.approx(-158.6, abs=1)   # Selenean summit
    assert lo_lat == pytest.approx(-70.3, abs=1) and lo_lon == pytest.approx(-172.5, abs=1)  # Antoniadi


def test_apollo_11_site_elevation():
    """Apollo 11 landed about 1.9 km below the 1737.4 km reference sphere."""
    s = terrain.site(0.674, 23.473)
    assert s["elevationM"] == pytest.approx(-1920, abs=150)
    assert 0 <= s["regionalSlopeDeg"] < 3  # mare plain


def test_mare_is_lower_than_far_side_highlands():
    assert terrain._sample(33, -16) < 0 < terrain._sample(5, -160)


@pytest.mark.parametrize("lat,lon", [(0, 0), (89.99, 10), (-89.99, -170), (45, 179.99), (-45, -179.99)])
def test_site_handles_poles_and_dateline(lat, lon):
    s = terrain.site(lat, lon)
    assert np.isfinite(s["elevationM"]) and np.isfinite(s["regionalSlopeDeg"])
    assert 0 <= s["regionalSlopeDeg"] < 60


def test_longitude_wraps_across_dateline():
    assert terrain._sample(10, 180) == pytest.approx(terrain._sample(10, -180), abs=1e-3)


def test_bilinear_sample_hits_pixel_centres_exactly():
    dem = terrain._load()
    # Pixel (row 1000, col 2000) centre
    lat, lon = 90 - (1000 + 0.5) / 16, -180 + (2000 + 0.5) / 16
    assert terrain._sample(lat, lon) == pytest.approx(float(dem[1000, 2000]), abs=1e-3)


@pytest.mark.parametrize("width", [360, 1440, 5760])
def test_grid_shape_and_layout(width):
    data, w, h = terrain.grid(width)
    assert (w, h) == (width, width // 2)
    grid = np.frombuffer(data, dtype="<i2").reshape(h, w)
    # Block averaging preserves the global mean height.
    assert grid.mean() == pytest.approx(float(terrain._load().mean()), abs=2)


def test_grid_rejects_widths_that_do_not_divide_the_dem():
    with pytest.raises(ValueError):
        terrain.grid(1000)


def test_site_returns_none_without_dem(monkeypatch):
    monkeypatch.setattr(terrain, "available", lambda: False)
    assert terrain.site(0, 0) is None
