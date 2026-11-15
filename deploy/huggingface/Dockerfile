# Moonwalk backend (FastAPI + SPICE) for a Hugging Face Docker Space.
#
# The Space holds only this Dockerfile and README.md. The build clones the public GitHub repo, so the SPICE
# kernels, LOLA DEM, PSR map, Diviner data and 3D models come straight from git. The terrain-horizon cache
# (about 10 minutes of CPU) is built here, at image build time, so the first visitor never waits for it.
#
# To pick up new commits on main, use "Factory rebuild" in the Space settings, or bump CACHE_BUST below.
FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Hugging Face runs the container as uid 1000.
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user PATH=/home/user/.local/bin:$PATH PYTHONUNBUFFERED=1
WORKDIR /home/user

ARG REPO=https://github.com/Sythire/spaceAppsFall2026.git
ARG REF=main
ARG CACHE_BUST=1
RUN git clone --depth 1 --branch "$REF" "$REPO" app && rm -rf app/.git app/frontend app/node_modules

WORKDIR /home/user/app/backend
RUN pip install --no-cache-dir --user -r requirements.txt

# Precompute terrain horizons for both analysis grids into backend/cache.
RUN python -c "from api import horizon; horizon.get_grid('global'); horizon.get_grid('southpole'); print('horizon cache ready')"

EXPOSE 7860
CMD ["python", "-m", "uvicorn", "api.main:app", "--host", "0.0.0.0", "--port", "7860"]
