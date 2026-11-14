"""Run from repository root: backend/.venv/bin/python -m unittest discover -s backend/tests -v"""
import copy
import json
import math
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import numpy as np
from fastapi.testclient import TestClient

from backend.api import analysis, ephemeris, terrain
from backend.api.main import app
from backend.api.schemas import AnalysisRequest

REQUEST = json.loads((Path(__file__).parents[1] / "examples/analysis-request.json").read_text())


class AnalysisTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.polar = analysis.analyze(AnalysisRequest(**REQUEST))
        request = copy.deepcopy(REQUEST)
        request["location"].update(latitudeDeg=0.67416, longitudeDeg=23.47314)
        cls.equatorial = analysis.analyze(AnalysisRequest(**request))

    def test_nasa_horizons_reference(self):
        # Actual NASA/JPL Horizons response fetched 2026-11-14. COMMAND=10,
        # CENTER=coord@301, SITE_COORD=32,-89.5,0, QUANTITIES=4, AIRLESS,
        # at 2026-11-14 12:00 UTC. Horizons is a validation reference only.
        self.assertAlmostEqual(self.polar["sun"]["elevationDeg"], 1.569431534, places=6)
        self.assertAlmostEqual(self.polar["sun"]["azimuthDeg"], 88.537332329, places=6)

    def test_duration_conservation_and_windows(self):
        for result in (self.polar, self.equatorial):
            for summary in (result["illumination"], result["earthVisibility"]):
                elapsed = result["interval"]["elapsedHours"]
                self.assertAlmostEqual(summary["aboveHorizonHours"] + summary["belowHorizonHours"], elapsed)
                self.assertAlmostEqual(sum(w["durationHours"] for w in summary["visibleWindows"]), summary["aboveHorizonHours"])
                self.assertTrue(0 <= summary["aboveHorizonPercent"] <= 100)
                windows = sorted(summary["visibleWindows"] + summary["hiddenWindows"], key=lambda w: w["startUtc"])
                self.assertEqual(windows[0]["startUtc"], result["interval"]["startUtc"])
                self.assertEqual(windows[-1]["endUtc"], result["interval"]["endUtc"])
                for a, b in zip(windows, windows[1:]):
                    self.assertEqual(a["endUtc"], b["startUtc"])
        self.assertAlmostEqual(self.polar["illumination"]["daylightHours"], 720, places=7)
        self.assertGreater(self.equatorial["illumination"]["daylightHours"], 250)
        self.assertGreater(self.equatorial["illumination"]["darknessHours"], 250)

    def test_event_directions(self):
        for result in (self.polar, self.equatorial):
            loc = result["request"]["location"]
            for key, target in (("illumination", "SUN"), ("earthVisibility", "EARTH")):
                for event in result[key]["events"]:
                    et = ephemeris._to_et(datetime.fromisoformat(event["utc"].replace("Z", "+00:00")))
                    el = ephemeris._surface_geometry(target, [et - 1, et + 1], loc["latitudeDeg"], loc["longitudeDeg"])[0]
                    self.assertEqual(bool(el[0] < 0 < el[1]), event["type"] == "rise")
                    self.assertLess(el[0] * el[1], 0)

    def test_full_dark_interval_and_partial_last_step(self):
        request = copy.deepcopy(REQUEST)
        request.update(durationHours=2.5, stepHours=2)
        request["location"].update(latitudeDeg=0, longitudeDeg=0)
        # The antipodal site must have the opposite solar horizon state.
        a = analysis.analyze(AnalysisRequest(**request))
        request["location"]["longitudeDeg"] = 180
        b = analysis.analyze(AnalysisRequest(**request))
        self.assertNotEqual(a["sun"]["aboveHorizon"], b["sun"]["aboveHorizon"])
        dark = a if not a["sun"]["aboveHorizon"] else b
        self.assertEqual(dark["illumination"]["sunlightPercent"], 0)
        self.assertAlmostEqual(dark["illumination"]["darknessHours"], 2.5, places=7)
        self.assertEqual([p["hour"] for p in dark["illumination"]["timeline"]], [0, 2, 2.5])
        self.assertEqual(dark["sun"]["nextRise"], None)
        self.assertEqual(dark["illumination"]["timeline"][0]["horizontalIrradianceWm2"], 0)

    def test_zero_and_exact_boundary_crossings(self):
        et = ephemeris._to_et(datetime(2026, 11, 14, tzinfo=timezone.utc))
        # Exercise a zero-height endpoint and an event exactly at the boundary.
        def geometry(target, times, lat, lon):
            el = np.asarray([(t - et) / 3600 for t in times])
            return el, np.zeros(len(times)), np.ones(len(times))
        with patch.object(ephemeris, "_surface_geometry", geometry):
            _, result = analysis._body("SUN", [et, et + 3600], [et, et + 3600], 0, 0)
        self.assertEqual(len(result["events"]), 1)
        self.assertEqual(result["events"][0]["type"], "rise")
        self.assertLess(result["belowHorizonHours"], 0.1 / 3600)

    def test_every_sample_is_finite_and_angles_are_bounded(self):
        for result in (self.polar, self.equatorial):
            for point in result["illumination"]["timeline"]:
                for key in ("sun", "earth"):
                    self.assertTrue(-90 <= point[key]["elevationDeg"] <= 90)
                    self.assertTrue(0 <= point[key]["azimuthDeg"] < 360)
                    self.assertTrue(math.isfinite(point[key]["distanceKm"]))
                self.assertIn(point["sunlightPercent"], (0, 100))
                self.assertGreaterEqual(point["horizontalIrradianceWm2"], 0)

    def test_physical_disclosures_and_provenance(self):
        self.assertEqual(self.polar["mode"], "modeled")
        self.assertTrue(all(v is None for v in self.polar["terrain"].values()))
        self.assertIsNone(self.polar["suitability"])
        source = self.client.get("/api/v1/data/sources").json()
        self.assertEqual(source["frameRealization"], "MOON_ME_DE440_ME421")
        self.assertEqual(len(source["kernels"]), 5)
        self.assertTrue(all(len(k["sha256"]) == 64 for k in source["kernels"]))
        self.assertTrue(source["coverage"])

    def test_api_analysis_timeline_and_comparison_order(self):
        request = {**REQUEST, "durationHours": 24}
        response = self.client.post("/api/v1/analysis", json=request)
        self.assertEqual(response.status_code, 200, response.text)
        points = self.client.post("/api/v1/timeline", json=request)
        self.assertEqual(points.json(), response.json()["illumination"]["timeline"])
        other = copy.deepcopy(request)
        other["location"].update(id="second", longitudeDeg=-45)
        comparison = self.client.post("/api/v1/comparisons", json={"requests": [other, request]})
        self.assertEqual(comparison.status_code, 200, comparison.text)
        self.assertEqual([r["request"]["location"]["id"] for r in comparison.json()["results"]], ["second", "polar-reference"])

    def test_invalid_requests(self):
        for field, value in (("utc", "2026-11-14T12:00:00"), ("utc", "bad"), ("utc", 0),
                             ("durationHours", 0), ("durationHours", 1e-12), ("durationHours", 2881), ("stepHours", 0.1),
                             ("stepHours", 25), ("unknown", True)):
            with self.subTest(field=field, value=value):
                response = self.client.post("/api/v1/analysis", json={**REQUEST, field: value})
                self.assertEqual(response.status_code, 422, response.text)
        for field, value in (("latitudeDeg", -91), ("longitudeDeg", 181), ("frame", "MOON_PA")):
            request = copy.deepcopy(REQUEST)
            request["location"][field] = value
            self.assertEqual(self.client.post("/api/v1/analysis", json=request).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/analysis", json={**REQUEST, "utc": "9999-12-31T12:00:00Z"}).status_code, 422)
        self.assertEqual(self.client.post("/api/v1/analysis", json={**REQUEST, "durationHours": 2880, "stepHours": 0.25}).status_code, 422)
        for scenarios in ([], [REQUEST] * 4):
            self.assertEqual(self.client.post("/api/v1/comparisons", json={"requests": scenarios}).status_code, 422)

    def test_coverage_errors_and_timezone_equivalence(self):
        bad = self.client.post("/api/v1/analysis", json={**REQUEST, "utc": "1800-01-01T00:00:00Z"})
        self.assertEqual(bad.status_code, 422)
        offset = self.client.post("/api/v1/analysis", json={**REQUEST, "utc": "2026-11-14T07:00:00-05:00", "durationHours": 1}).json()
        self.assertEqual(offset["sun"]["elevationDeg"], self.polar["sun"]["elevationDeg"])
        self.assertEqual(self.client.get("/api/v1/scene?utc=2026-11-14T12:00:00").status_code, 422)
        self.assertEqual(self.client.get("/api/v1/scene/series?lat=0").status_code, 422)

    def test_catalog_and_unavailable_layers(self):
        sites = self.client.get("/api/v1/sites").json()
        apollo = next(s for s in sites if s["id"] == "apollo-11")
        self.assertEqual(apollo["latitudeDeg"], 0.67416)
        self.assertIn("nasa.gov", apollo["source"])
        response = self.client.post("/api/v1/analysis", json={**REQUEST, "location": apollo, "durationHours": 1})
        self.assertEqual(response.status_code, 200, response.text)
        polar = next(s for s in sites if s["id"] == "polar-reference")
        self.assertEqual(polar["kind"], "exploratory")
        layers = {layer["id"]: layer["available"] for layer in self.client.get("/api/v1/map/layers").json()}
        self.assertTrue(layers["illumination"])
        self.assertEqual(layers["elevation"], terrain.available())
        # Terrain-aware layers need the LOLA DEM.
        self.assertEqual(layers["earth-visibility"], terrain.available())
        self.assertEqual(layers["power"], terrain.available())


if __name__ == "__main__":
    unittest.main()
