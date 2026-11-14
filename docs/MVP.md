# Hackathon MVP

## Demo story

Choose a known or custom lunar site, select UTC arrival time, inspect Sun/Earth visibility, estimate solar power, then compare with a second candidate. Explain why changing the site or time changes feasibility. Prioritize a reliable two-minute demo over the full wishlist.

## Scope and delivery gates

1. **Foundation — implemented:** React/TypeScript app, orbitable reference sphere, six verified Apollo pings, coordinate entry/click selection, UTC controls, year filter, clearly labeled approximate geometry and ideal panel power.
2. **Scientific core — next:** ingest the challenge-provided resources; validated Moon-fixed Sun/Earth vectors; real lunar imagery/topography; selected-site slope and terrain horizon; provider provenance and coverage errors. Add playback and save two site/date scenarios for comparison. Until then show unavailable metrics rather than invented numbers.
3. **Demo completion:** sourced international/commercial/CLPS records; operator/program/type/year/status filters; stackable terrain, illumination and thermal overlays with legends. Wire thermal and PSR products only if coverage, definitions and resolution are verified. Display sunset/Earthset only when computed across a sampled interval with explicit horizon assumptions.

Cut thermal overlays before compromising trustworthy site-time geometry. If time runs short, keep measured thermal/PSR fields unavailable with source links and demonstrate the geometry/power workflow.

## Acceptance criteria for the data-backed MVP

- Coordinates use planetocentric latitude and east-positive longitude, with the dataset frame documented; search selects and focuses a visible marker.
- Blank time initializes to current UTC; changing the selected time updates both geometry and assessment.
- At least one equatorial and one south-polar case are checked against a trusted geometry reference.
- Measured, modeled, approximate and missing values are visually distinct. Unknown PSR status never means false.
- Panel inputs include area, efficiency, tilt and azimuth. Report W; battery charging requires battery voltage/capacity and conversion-loss assumptions.
- Source, product ID/version, resolution, frame, units, epoch, coverage and fetch date accompany imported datasets.
- Compare two site/date selections with their assumptions preserved.
- Controls work by keyboard and layouts work on a laptop and mobile width. Globe selection has a form/list alternative.

## Explicit stretch goals

Earth/Moon satellite relay maps and link budgets; trajectory import and propagation; rover route/time simulations; Mars transfers; global charge-rate overlay. Relay line of sight alone does not establish a communication link: require orbit epochs, antenna geometry, frequency, range and link budget. Future target coordinates must retain uncertainty and planned status.
