# Frontend architecture
## Decision
React 19, TypeScript strict mode, Vite 7, Tailwind CSS 4 via its Vite plugin, React Router 7 declarative routing, Lucide React icons and Recharts 3. Lockfile pins resolved dependencies. No auth, database or scientific engine is introduced.

This repository is the project root. npm workspaces allow root commands to target frontend. The 3D explorer uses three.js (lazy-loaded with the Explorer route) instead of Cesium.

## Boundaries
- App.tsx composes routes and AppProvider.
- components/layout and navigation own the shared shell.
- components/ui owns reusable presentation components.
- components/shared owns date, site selection, state indicators and timeline charts.
- pages own feature composition.
- context/AppContext.tsx owns selected coordinates, UTC, active layers, selected comparison sites and analysis.
- hooks/useAsync.ts owns async lifecycle and ignores stale responses.
- services owns backend calls and simulated-provider switching.
- constants/mockData.ts owns all simulated records and values.
- types/index.ts defines UI-independent contracts.
- pages/LunarMap/MapViewport.tsx owns the 3D view UI; pages/LunarMap/scene/MoonScene.ts owns the three.js scene (Moon-fixed MOON_ME world axes, 1 unit = 1 lunar radius).

No API calls belong in presentation components. Page composition calls hooks/services. Scientific calculations will be supplied by backend/astronomy teammates, never recreated inside charts.

## State and lifecycle
Changing site/time clears the previous shared analysis. Analysis page requests new results; pending requests cannot overwrite a later selection. Comparison selection accepts at most three sites. Layer state is an array to allow stacked layers. All state is session-memory only; refresh resets it.

## Map handoff
MapViewport accepts location, layers and onSelect. Replace its decorative grid with a Cesium canvas; return a typed LunarLocation on selection. Preserve accessible coordinate form/list selection. Configure Moon radii and Moon-fixed coordinates explicitly; Cesium Earth/WGS84 defaults are unsuitable. Own Cesium asset hosting, workers, CSS and disposal locally within the map module. Add actual imagery only after metadata/frame checks.

## Current limitations
Map is a labeled placeholder. No terrain, thermal data, PSR, verified ephemerides or suitability model. Simulated charts have fixed fixture values, not date/location predictions. Backend responses are typed but not runtime schema-validated yet; add validation with live integration. NASA connectivity status reports configuration only, never asserts service health.

