"""Run the Moonwalk FastAPI backend inside a Hugging Face *Gradio* Space.

Free accounts can no longer create Docker Spaces, but a Gradio Space simply runs `python app.py` and serves
whatever listens on port 7860. This script:

  1. clones the public GitHub repo (SPICE kernels, LOLA DEM, PSR map, Diviner data and models are in git),
  2. installs any terrain-horizon cache files uploaded next to it (horizon_*.npz) so startup takes seconds
     instead of ~10 minutes; without them the cache is computed on first boot,
  3. warms both analysis grids and starts uvicorn on 0.0.0.0:7860.

ZeroGPU hardware: the platform refuses to start unless the app registers at least one @spaces.GPU function
and sends ZeroGPU's startup report. The backend needs no GPU, so a placeholder function is registered (it is
never called, so no GPU quota is used) and spaces.zero.startup() sends the report just before the server
starts. Works with old and new versions of the `spaces` package; on CPU hardware (or locally) both are no-ops.
"""
try:
    import spaces  # must be imported before anything that could touch CUDA
except ImportError:  # running outside Hugging Face
    spaces = None

if spaces is not None:
    @spaces.GPU
    def _zerogpu_placeholder():
        """Never called: satisfies ZeroGPU's startup check that at least one GPU function exists."""
        return None

import glob
import os
import re
import shutil
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.environ.get("REPO_URL", "https://github.com/Sythire/spaceAppsFall2026.git")
REF = os.environ.get("REPO_REF", "main")
SRC = os.path.join(HERE, "moonwalk")
BACKEND = os.path.join(SRC, "backend")
DEM = os.path.join(SRC, "modelResources", "ldem_16_uint.tif")

if not os.path.isdir(BACKEND):
    print(f"Cloning {REPO} ({REF})", flush=True)
    subprocess.run(["git", "clone", "--depth", "1", "--branch", REF, REPO, SRC], check=True)

# The horizon cache is keyed by the DEM's modification time, which a fresh clone resets. The uploaded cache was
# computed from this same DEM, so restore the timestamp its filename records and copy it into place.
cache_dir = os.path.join(BACKEND, "cache")
os.makedirs(cache_dir, exist_ok=True)
for path in glob.glob(os.path.join(HERE, "horizon_*.npz")):
    stamp = int(re.search(r"_(\d+)\.npz$", path).group(1))
    os.utime(DEM, (stamp, stamp))
    target = os.path.join(cache_dir, os.path.basename(path))
    if not os.path.exists(target):
        shutil.copyfile(path, target)
        print("Installed horizon cache", os.path.basename(path), flush=True)

os.chdir(BACKEND)
sys.path.insert(0, BACKEND)
from api import horizon  # noqa: E402

print("Loading terrain horizons (computed now if no cache was uploaded; this can take ~10-15 min)", flush=True)
horizon.get_grid("global")
horizon.get_grid("southpole")

import uvicorn  # noqa: E402
from api.main import app  # noqa: E402

# Send ZeroGPU's startup report ourselves. Every `spaces` version has spaces.zero.startup() on ZeroGPU hardware
# (older ones only call it from Gradio's launch(), which this app never runs; newer ones keep it as an alias of
# zerogpu_startup). On CPU hardware it doesn't exist and this is skipped.
if spaces is not None:
    from spaces import zero as _zero
    if callable(getattr(_zero, "startup", None)):
        print("Sending ZeroGPU startup report", flush=True)
        _zero.startup()

uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
