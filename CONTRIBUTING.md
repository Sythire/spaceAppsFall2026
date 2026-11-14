# Contributing
## Start
Install Node 22.12+, run npm ci at the repository root, then npm run dev.
Run npm test and npm run build before opening a PR. Do not commit build artifacts, node_modules, environment secrets or large raw science products.

## Branches and reviews
Do not commit directly to main. Create a branch such as feature/frontend-shell, feature/lunar-map, feature/nasa-data, feature/astronomy-engine, feature/analytics or feature/site-recommendations. Codex-created branches default to codex/. Use develop as integration branch once the team creates it; until then target an agreed review branch rather than silently pushing to main.

Use small commits: feat(map): add lunar layer adapter; fix(analysis): clear stale results; docs(api): specify timeline units.
PRs describe behavior, owned files, screenshots for UI, service/type changes, assumptions and validation. Get a teammate review before merging. Branch protection and develop are recommendations; they have not been configured remotely.

## Six-person ownership
| Owner | Primary area |
| --- | --- |
| Frontend lead | shell, navigation, shared context, types and shared UI |
| Map developer | pages/LunarMap, Cesium lifecycle, mapService |
| NASA data developer | data ingestion, catalog/layer metadata, siteService |
| Astronomy developer | backend geometry and time/frame validation, analysis API |
| Analytics developer | pages/Analysis, charts and pages/Comparison |
| Recommendations developer | recommendation service integration and documented suitability model |

Agree contract changes in a small shared PR before consuming them. Feature pages must not import each other's internal components. Ask the frontend lead to review context/types/shell changes to reduce conflicts. Ownership is guidance, not an access restriction.

