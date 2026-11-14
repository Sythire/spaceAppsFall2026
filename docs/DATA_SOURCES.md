# Data sources and tool evaluation

Research checked 2026-11-14. Links below are candidate official resources; inclusion does not establish challenge eligibility.

## Missing challenge input

The supplied challenge text names Horizons and LOLA but contains no challenge URL or complete resource list. **Obtain the actual challenge page/resource bundle before claiming compliance with the requirement to use mission-provided datasets.** No terrain/model assets are present in the checkout; ignored modelResources paths are not downloaded assets.

## Sources and implementation status

| Resource | Use | Status |
| --- | --- | --- |
| [NASA NSSDCA Apollo sites](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html) | Six Lunar Module coordinates, DE421 Mean Earth/Polar Axis | Used in seed catalog; values transcribed from NASA table |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) / [API](https://ssd-api.jpl.nasa.gov/doc/horizons.html) | Reference geometry; lunar observer calculations | Researched; not integrated |
| [JPL API policy](https://ssd-api.jpl.nasa.gov/doc/index.php) | Browser/CORS and request constraints | Requires server-side integration; check output version |
| [NAIF SPICE](https://naif.jpl.nasa.gov/) / [generic kernels](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/) | Repeatable positions, lunar orientation, spacecraft geometry | Recommended science engine; kernels and coverage not selected yet |
| [LRO PDS Geosciences](https://pds-geosciences.wustl.edu/missions/lro/default.htm) | LOLA elevation/slope; Diviner thermal products | Candidate official archive; no products downloaded |
| [Moon Trek](https://trek.nasa.gov/moon/) | Inspect lunar map layers, terrain and exploration context | Useful discovery/reference viewer; verify individual product metadata and service access before integration |
| [OpenSpace](https://www.openspaceproject.com/) | Scientific globe/mission visualization reference | Useful for outreach/reference; not chosen as browser MVP runtime |

## Recommendation: SPICE + browser globe

SPICE is the geometry system, Horizons is a reference/service option, and OpenSpace is a visualization environment. They serve different roles. Our engineering judgment is that a React/Three.js UI with a small SPICE-backed provider gives the team more direct control over site comparisons and power tools. Horizons can validate sample cases or supply bounded precomputed data. OpenSpace would be useful for a separate immersive demonstration, but integrating its environment is outside the MVP budget.

Moon Trek is useful for finding context and datasets; do not assume it provides a complete, continuously current catalog of future missions. Curate additional missions from primary agency/company pages with source date and confidence. Model operator (company/agency) separately from program (e.g. CLPS), sponsor, mission type and status; those categories overlap.

## Import checklist

For each actual product record: mission/instrument, product ID, release/version, source URL, attribution/license, download date, spatial resolution, coordinate frame/projection, units, temporal coverage, uncertainty and missing-value encoding. Preserve original metadata. Tile or downsample big rasters outside the browser. Validate CRS alignment before calculating slope or combining layers.

Diviner observations or climatologies are not arbitrary-time surface temperature predictions. PSR requires long-term terrain illumination analysis or an authoritative PSR product; a location dark at one selected time is not necessarily permanently shadowed. No temperature or PSR values may be inferred from the illustrative scene.
