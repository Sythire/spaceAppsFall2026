# Frontend guidelines
1. Functional React components; explicit props and shared types. No undocumented any.
2. Keep one feature per module. Extract presentation and repeated controls.
3. Use Tailwind utilities or shared theme classes in style.css; preserve readable dark contrast and restrained accents.
4. Services own transport. hooks own lifecycle. Components render loading, error, retry and empty states.
5. Mocks live in constants/mockData.ts and must disclose simulated status. Never label fixtures NASA data.
6. Scientific values include units, UTC, coordinate frame and provenance. Unknown is null, not zero.
7. Native controls require labels; buttons need keyboard focus; icons alone need accessible names. Charts expose tabular values.
8. Keep map lifecycle inside MapViewport; use shared context rather than cross-page imports.
9. Run npm test and npm run build before requesting review. Verify routes, mobile width, keyboard controls and stale requests manually.
10. New services must use apiClient and environment configuration. Never add API credentials to VITE_ variables.

Naming: PascalCase component/type names, camelCase functions and hooks prefixed use. Page folders are PascalCase. UI types do not import React or renderer objects.

