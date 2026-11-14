# Six-person integration plan
Use CONTRIBUTING.md for ownership and workflow.
1. Frontend lead: maintain shell/context/contracts; foundation is implemented.
2. Map owner: replace MapViewport with Cesium, preserve props and coordinate fallback.
3. NASA data owner: confirm challenge resources, produce sourced sites/layer metadata and coverage.
4. Astronomy owner: implement analysis/timeline service using validated Moon-fixed geometry.
5. Analytics owner: evolve charts and comparison, preserve source labels and unknown fields.
6. Recommendations owner: agree explainable suitability criteria, implement recommendations endpoint and UI.

Start with mock mode. Agree types and units before connecting a service. Set VITE_USE_MOCKS=false only after backend contracts are available. Handle unavailable coverage explicitly. Integrate one validated equatorial and one polar case before the demo.

Exact challenge URL/resources remain missing. No remote branches, PRs or deployment were created for this local-only request.

