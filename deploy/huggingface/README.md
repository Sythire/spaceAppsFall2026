# Backend on a Hugging Face Space (Gradio SDK)

Free Hugging Face accounts can't create Docker Spaces any more, but a **Gradio** Space runs `python app.py`
and serves whatever listens on port 7860. `app.py` clones this repo and starts the FastAPI backend there.
No Gradio UI is used.

## One-time setup

1. huggingface.co → **New Space** → SDK **Gradio** (template **Blank**), hardware **CPU basic (free)**,
   visibility **Public** → **Create Space**.
2. **Files** tab → **+ Contribute → Upload files**, and upload:
   - `deploy/huggingface/app.py`
   - `deploy/huggingface/requirements.txt`
   - both `backend/cache/horizon_*.npz` files from a machine that has run the backend
     (about 70 MB; optional but recommended. Without them the first boot spends ~10–15 min computing them).
3. Edit the Space's `README.md` and add these lines inside the `---` header (keep the generated lines):
   ```yaml
   startup_duration_timeout: 1h
   ```
4. Wait for **Running**, then open `https://<user>-<space>.hf.space/api/v1/health`. It should return JSON.
   (The Space's own page shows an error or blank, because there is no Gradio UI; that's expected.)
5. Vercel → **Settings → Environment Variables**, then redeploy:
   - `VITE_API_BASE_URL` = `https://<user>-<space>.hf.space/api/v1`
   - `VITE_USE_MOCKS` = `false`

CORS already allows `*.vercel.app`. For a custom domain, add a Space variable `CORS_ORIGINS=https://your.domain`.

**Updating:** `app.py` clones `main` on every start. After pushing, use **Settings → Restart Space**
(or **Factory rebuild**). If a backend change bumps `horizon.CACHE_VERSION`, upload fresh cache files.

**Sleeping:** free Spaces sleep after 48 h without visits; the next request wakes it in about a minute.

`deploy/docker/Dockerfile` is the equivalent image for hosts that take a Dockerfile (Railway, Fly.io,
a paid Hugging Face Docker Space).
