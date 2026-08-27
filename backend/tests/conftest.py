"""Pytest configuration: ensure backend is on the import path."""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Make `app` importable when running `pytest` from the backend dir
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
