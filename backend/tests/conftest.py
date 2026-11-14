"""Make both import styles work whether pytest runs from the repo root or from backend/:
`from api import ...` (backend/ on the path) and `from backend.api import ...` (repo root on the path)."""
import os
import sys

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
for path in (BACKEND, os.path.dirname(BACKEND)):
    if path not in sys.path:
        sys.path.insert(0, path)
