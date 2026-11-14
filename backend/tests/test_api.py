"""HTTP tests against a running service (python -m uvicorn api.main:app --port 8000).
Skipped when nothing is listening, so `pytest` still runs the unit tests offline.
Set LUNARSITE_API to test another address."""
import json
import os
import urllib.error
import urllib.request

import pytest

BASE = os.environ.get("LUNARSITE_API", "http://127.0.0.1:8000")


def _get(path, headers=None):
    req = urllib.request.Request(BASE + path, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}, r.read()
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}, e.read()


def _json(path):
    status, _, body = _get(path)
    return status, json.loads(body)


def _server_up():
    try:
        return _get("/api/v1/health")[0] == 200
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _server_up(), reason=f"no API server at {BASE}")


def test_health_lists_kernels():
    status, body = _json("/api/v1/health")
    assert status == 200 and body["status"] == "ok"
    assert "de440s.bsp" in body["kernels"] and "moon_pa_de440_200625.bpc" in body["kernels"]


def test_models_manifest_points_to_served_files():
    status, manifest = _json("/api/v1/models")
    assert status == 200 and set(manifest) == {"moon", "earth", "sun", "mars", "sky"}
    for path in filter(None, manifest.values()):
        code, headers, _ = _get(path)
        assert code == 200, path


def test_series_shape():
    status, s = _json("/api/v1/scene/series?start=2026-11-14T00:00:00Z&hours=24&stepHours=6&lat=-89.5&lon=32")
    assert status == 200 and len(s["samples"]) == 5
    sample = s["samples"][0]
    for key in ("sun", "earth", "mars", "helio", "moonRotationQuat", "earthRotationQuat", "site"):
        assert key in sample


def test_long_orbit_window_is_accepted():
    status, s = _json("/api/v1/scene/series?hours=16800&stepHours=72")
    assert status == 200 and len(s["samples"]) == 234


@pytest.mark.parametrize("query", [
    "hours=0", "hours=20000", "stepHours=0.1", "stepHours=500", "hours=1001&stepHours=0.25",
    "lat=95", "lon=-200", "start=not-a-date",
])
def test_series_rejects_bad_input(query):
    status, _ = _json("/api/v1/scene/series?" + query)
    assert status == 422


def test_out_of_coverage_time_is_a_422_with_reason():
    status, body = _json("/api/v1/site?lat=0&lon=0&utc=2200-01-01T00:00:00Z")
    assert status == 422 and "SPKINSUFFDATA" in body["detail"]


def test_site_includes_terrain_and_matches_horizons():
    status, s = _json("/api/v1/site?lat=-89.5&lon=32&utc=2026-11-14T12:00:00Z")
    assert status == 200
    assert s["sun"]["elevationDeg"] == pytest.approx(1.569432, abs=1e-3)
    assert s["terrain"] is None or {"elevationM", "regionalSlopeDeg", "baselineKm"} <= set(s["terrain"])


def test_terrain_binary_grid():
    code, headers, body = _get("/api/v1/terrain/elevation.bin?width=360")
    if code == 404:
        pytest.skip("DEM not installed")
    assert code == 200 and len(body) == 360 * 180 * 2
    assert headers.get("x-grid-width") == "360"


def test_terrain_rejects_bad_width():
    code, _, _ = _get("/api/v1/terrain/elevation.bin?width=1000")
    assert code in (404, 422)


def test_cors_allows_the_dev_frontend():
    _, headers, _ = _get("/api/v1/health", {"Origin": "http://127.0.0.1:5173"})
    assert headers.get("access-control-allow-origin") == "http://127.0.0.1:5173"
