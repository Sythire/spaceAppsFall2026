"""Terrain horizons from the LOLA DEM, on two analysis grids, cached to disk.

For every grid cell and each of N_AZ compass directions we march outward over the DEM and record the
steepest terrain "slope" seen from the ground (rise over distance, minus the curvature drop d²/2R) and the
distance at which it occurs. The horizon elevation for an observer h metres above the ground is then

    horizon = atan(slope - h / distance)

which is exact while the blocking point stays the same and a very good approximation for mast heights of
metres to tens of metres (the DEM itself is ~1.9 km per pixel, so sub-pixel features are not resolved).

Grids
  * global: 0.5° equirectangular cells, 720 x 360, row 0 = 89.75°N, column 0 = 179.75°W.
  * southpole: polar stereographic patch poleward of 80°S, POLAR_N x POLAR_N cells (~1.9 km each);
    x = ρ·cos(lon), y = ρ·sin(lon), ρ = 2R·tan(colatitude/2). Cells outside the cap are masked.
"""
from __future__ import annotations

import math
import os
import threading
from dataclasses import dataclass

import numpy as np

from . import terrain

R_M = terrain.MOON_MEAN_RADIUS_M
N_AZ = 48                                   # 7.5° azimuth bins
MAX_DIST_M = 270_000.0                      # beyond this, curvature hides anything the Moon's relief can raise
DISTANCES_M = np.geomspace(600.0, MAX_DIST_M, 56).astype(np.float64)
POLAR_CAP_LAT = -80.0
POLAR_N = 320
CACHE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "cache"))
CACHE_VERSION = 2

_lock = threading.Lock()
_grids: dict[str, "Grid"] = {}


@dataclass
class Grid:
    name: str
    shape: tuple[int, int]          # (rows, cols)
    lat: np.ndarray                 # degrees, flattened (cells,)
    lon: np.ndarray
    valid: np.ndarray               # bool mask (cells,)
    height_m: np.ndarray            # DEM height at cell centre
    normal: np.ndarray              # ground normal from DEM slope, MOON_ME unit vectors (cells, 3)
    slope_deg: np.ndarray           # regional slope at cell
    hz_slope: np.ndarray            # (cells, N_AZ) max (rise/dist - dist/2R) from the ground
    hz_dist_m: np.ndarray           # (cells, N_AZ) distance of that maximum
    cell_km: float
    description: str

    @property
    def up(self) -> np.ndarray:
        la, lo = np.radians(self.lat), np.radians(self.lon)
        return np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=1)


# ---------------------------------------------------------------- DEM sampling
def sample_dem(lat_deg: np.ndarray, lon_deg: np.ndarray) -> np.ndarray:
    """Vectorised bilinear DEM height (m) at arrays of planetocentric lat/lon."""
    dem = terrain._load()
    h, w = dem.shape
    ppd = terrain.PIXELS_PER_DEGREE
    x = (np.asarray(lon_deg) + 180.0) * ppd - 0.5
    y = (90.0 - np.asarray(lat_deg)) * ppd - 0.5
    x0 = np.floor(x).astype(np.int64)
    y0 = np.floor(y).astype(np.int64)
    fx = (x - x0).astype(np.float32)
    fy = (y - y0).astype(np.float32)
    x0w, x1w = x0 % w, (x0 + 1) % w
    y0c, y1c = np.clip(y0, 0, h - 1), np.clip(y0 + 1, 0, h - 1)
    top = dem[y0c, x0w] * (1 - fx) + dem[y0c, x1w] * fx
    bot = dem[y1c, x0w] * (1 - fx) + dem[y1c, x1w] * fx
    return top * (1 - fy) + bot * fy


def _destination(lat_deg, lon_deg, az_rad, dist_m):
    """Great-circle destination from (lat, lon) along azimuth (clockwise from north)."""
    phi1, lam1 = np.radians(lat_deg), np.radians(lon_deg)
    delta = dist_m / R_M
    sin_phi2 = np.sin(phi1) * np.cos(delta) + np.cos(phi1) * np.sin(delta) * np.cos(az_rad)
    phi2 = np.arcsin(np.clip(sin_phi2, -1, 1))
    lam2 = lam1 + np.arctan2(np.sin(az_rad) * np.sin(delta) * np.cos(phi1), np.cos(delta) - np.sin(phi1) * sin_phi2)
    return np.degrees(phi2), (np.degrees(lam2) + 180.0) % 360.0 - 180.0


def _basis(lat_deg, lon_deg):
    la, lo = np.radians(lat_deg), np.radians(lon_deg)
    up = np.stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)], axis=-1)
    east = np.stack([-np.sin(lo), np.cos(lo), np.zeros_like(lo)], axis=-1)
    north = np.cross(up, east)
    return up, east, north


# ---------------------------------------------------------------- horizon computation
def compute_horizons(lat: np.ndarray, lon: np.ndarray, chunk: int = 20000) -> tuple[np.ndarray, np.ndarray]:
    """(cells, N_AZ) max terrain slope seen from the ground and its distance."""
    n = lat.size
    h0 = sample_dem(lat, lon).astype(np.float32)
    best = np.full((n, N_AZ), -np.inf, dtype=np.float32)
    best_d = np.full((n, N_AZ), DISTANCES_M[0], dtype=np.float32)
    d = DISTANCES_M[None, :]
    drop = (d * d / (2 * R_M)).astype(np.float32)
    for a in range(N_AZ):
        az = 2 * math.pi * a / N_AZ
        for s in range(0, n, chunk):
            la, lo = lat[s:s + chunk, None], lon[s:s + chunk, None]
            plat, plon = _destination(la, lo, az, d)
            rise = sample_dem(plat, plon) - h0[s:s + chunk, None]
            slope = rise / d.astype(np.float32) - drop / d.astype(np.float32)
            k = np.argmax(slope, axis=1)
            idx = np.arange(slope.shape[0])
            best[s:s + chunk, a] = slope[idx, k]
            best_d[s:s + chunk, a] = DISTANCES_M[k]
    return best, best_d


def _ground_normal(lat, lon):
    """Ground normal from DEM central differences over about one DEM pixel (~1.9 km)."""
    step = 1.0 / terrain.PIXELS_PER_DEGREE
    up, east, north = _basis(lat, lon)
    dn = (sample_dem(np.clip(lat + step, -90, 90), lon) - sample_dem(np.clip(lat - step, -90, 90), lon)) / (R_M * math.radians(2 * step))
    coslat = np.maximum(np.cos(np.radians(lat)), 1e-3)
    dlon = np.minimum(step / coslat, 90.0)
    de = (sample_dem(lat, lon + dlon) - sample_dem(lat, lon - dlon)) / (R_M * coslat * np.radians(2 * dlon))
    normal = up - de[:, None] * east - dn[:, None] * north
    normal /= np.linalg.norm(normal, axis=1, keepdims=True)
    slope = np.degrees(np.arctan(np.hypot(de, dn)))
    return normal, slope


# ---------------------------------------------------------------- grids
def _global_cells(step=0.5):
    lats = 90 - step / 2 - step * np.arange(int(180 / step))
    lons = -180 + step / 2 + step * np.arange(int(360 / step))
    lo, la = np.meshgrid(lons, lats)
    return la.ravel(), lo.ravel(), np.ones(la.size, bool), (lats.size, lons.size)


def polar_rho_max_m() -> float:
    return 2 * R_M * math.tan(math.radians(90 + POLAR_CAP_LAT) / 2)


def _polar_cells(n=POLAR_N):
    rho_max = polar_rho_max_m()
    c = (np.arange(n) + 0.5) / n * 2 - 1  # -1..1 cell centres
    x, y = np.meshgrid(c * rho_max, c * rho_max)
    rho = np.hypot(x, y)
    colat = 2 * np.degrees(np.arctan(rho / (2 * R_M)))
    lat = -(90 - colat)
    lon = np.degrees(np.arctan2(y, x))
    return lat.ravel(), lon.ravel(), (rho <= rho_max).ravel(), (n, n)


def _build(name: str) -> Grid:
    if name == "global":
        lat, lon, valid, shape = _global_cells()
        cell_km, desc = 15.2, "0.5° equirectangular, row 0 = 89.75°N, col 0 = 179.75°W"
    elif name == "southpole":
        lat, lon, valid, shape = _polar_cells()
        cell_km = 2 * polar_rho_max_m() / POLAR_N / 1000
        desc = f"polar stereographic poleward of {abs(POLAR_CAP_LAT):.0f}°S, x = ρ·cos(lon), y = ρ·sin(lon)"
    else:
        raise ValueError(f"unknown grid {name}")
    stamp = int(os.path.getmtime(terrain.DEM_PATH))
    path = os.path.join(CACHE_DIR, f"horizon_{name}_v{CACHE_VERSION}_{N_AZ}az_{stamp}.npz")
    if os.path.isfile(path):
        z = np.load(path)
        hz, hd = z["hz_slope"], z["hz_dist_m"]
    else:
        hz = np.full((lat.size, N_AZ), -1.0, np.float32)
        hd = np.full((lat.size, N_AZ), DISTANCES_M[0], np.float32)
        hz[valid], hd[valid] = compute_horizons(lat[valid], lon[valid])
        os.makedirs(CACHE_DIR, exist_ok=True)
        np.savez_compressed(path, hz_slope=hz, hz_dist_m=hd)
    normal, slope = _ground_normal(lat, lon)
    return Grid(name, shape, lat, lon, valid, sample_dem(lat, lon).astype(np.float32), normal, slope.astype(np.float32),
                hz, hd, cell_km, desc)


def get_grid(name: str) -> Grid:
    with _lock:
        if name not in _grids:
            _grids[name] = _build(name)
        return _grids[name]


def horizon_elevation(grid: Grid, az_deg: np.ndarray, mount_m: float, cells: slice | np.ndarray = slice(None)) -> np.ndarray:
    """Terrain horizon elevation (degrees) toward each cell's azimuth, for an observer mount_m above ground."""
    f = (np.asarray(az_deg) % 360.0) / (360.0 / N_AZ)
    i0 = np.floor(f).astype(np.int64) % N_AZ
    i1 = (i0 + 1) % N_AZ
    t = (f - np.floor(f)).astype(np.float32)
    if isinstance(cells, slice) and cells == slice(None) and i0.shape[0] == grid.hz_slope.shape[0]:
        hs, hd = grid.hz_slope, grid.hz_dist_m           # one azimuth per cell: gather along axis 1
        def at(table, i):
            return np.take_along_axis(table, i[:, None], axis=1)[:, 0]
    else:
        rows = np.arange(grid.hz_slope.shape[0])[cells]
        def at(table, i):
            return table[rows, i]
        hs, hd = grid.hz_slope, grid.hz_dist_m
    s = at(hs, i0) * (1 - t) + at(hs, i1) * t
    d = at(hd, i0) * (1 - t) + at(hd, i1) * t
    return np.degrees(np.arctan(s - mount_m / d))
