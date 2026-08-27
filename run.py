"""
run.py - one-command orchestrator for CredLens.
Spawns the FastAPI backend on :8000 and the Vite frontend on :5173.
"""
from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
IS_WINDOWS = os.name == "nt"


def run_in_background(cmd: list[str], cwd: Path, log_path: Path) -> subprocess.Popen:
    log = open(log_path, "ab", buffering=0)
    kwargs: dict = {
        "cwd": str(cwd),
        "stdout": log,
        "stderr": subprocess.STDOUT,
    }
    if IS_WINDOWS:
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP  # type: ignore[attr-defined]
    else:
        kwargs["start_new_session"] = True
    return subprocess.Popen(cmd, **kwargs)


def main() -> int:
    print("=" * 60)
    print(" CredLens - AI Powered MSME Credit Intelligence Platform")
    print("=" * 60)

    # Backend
    backend_log = ROOT / "backend.log"
    backend_cmd = [
        sys.executable, "-m", "uvicorn", "app.main:app",
        "--host", "0.0.0.0", "--port", "8000", "--reload",
    ]
    print(f"[backend] launching on :8000 (logs -> {backend_log})")
    backend_proc = run_in_background(backend_cmd, BACKEND, backend_log)

    # Frontend
    frontend_log = ROOT / "frontend.log"
    npm_cmd = ["npm.cmd" if IS_WINDOWS else "npm", "run", "dev"]
    print(f"[frontend] launching on :5173 (logs -> {frontend_log})")
    frontend_proc = run_in_background(npm_cmd, FRONTEND, frontend_log)

    print()
    print(" Both services started. Open http://localhost:5173 in your browser.")
    print(" API docs at  http://localhost:8000/docs")
    print(" Press Ctrl+C to stop.")
    print()

    try:
        while True:
            time.sleep(1)
            if backend_proc.poll() is not None:
                print(f"[backend] exited with code {backend_proc.returncode}")
                break
            if frontend_proc.poll() is not None:
                print(f"[frontend] exited with code {frontend_proc.returncode}")
                break
    except KeyboardInterrupt:
        print("\nShutting down...")
    finally:
        for proc, name in [(backend_proc, "backend"), (frontend_proc, "frontend")]:
            if proc.poll() is None:
                try:
                    proc.terminate()
                except Exception:
                    pass
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
        print("Stopped.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
