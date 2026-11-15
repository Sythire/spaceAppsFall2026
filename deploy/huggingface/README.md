---
title: Moonwalk API
emoji: 🌕
colorFrom: gray
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
short_description: SPICE + LOLA terrain backend for the Moonwalk lunar site app
---

# Moonwalk API

FastAPI backend for the Moonwalk lunar landing-site app: JPL SPICE geometry, LOLA terrain horizons,
terrain-aware power and Earth-visibility maps, LOLA permanent-shadow and Diviner temperature products.

Health check: `/api/v1/health` · interactive docs: `/docs`

## Deploying (one-time setup)

This folder (`deploy/huggingface/`) is the whole Space: the Dockerfile clones the public GitHub repo at build time.

1. On huggingface.co, create a new Space, pick **Docker → Blank**, hardware **CPU basic (free)**, visibility **Public**.
2. In the Space's **Files** tab, upload `Dockerfile` and this `README.md` (replace the generated README).
3. Wait for the build (about 15 minutes; most of it is precomputing the terrain-horizon cache).
   The API is then at `https://<user>-<space>.hf.space/api/v1/health`.
4. In the Vercel project, set these environment variables, then redeploy:
   - `VITE_API_BASE_URL` = `https://<user>-<space>.hf.space/api/v1`
   - `VITE_USE_MOCKS` = `false`

CORS already allows `*.vercel.app`. For a custom domain, add a Space variable
`CORS_ORIGINS=https://your.domain` (comma-separated for several).

**Updating:** the Space does not watch GitHub. After pushing to `main`, open the Space's settings and
use **Factory rebuild**.

**Sleeping:** free Spaces sleep after 48 hours without visits; the next request wakes it in about a minute.
