"""Development server for the CrossEx backend.

Why this exists
---------------
Two separate problems bite you when the repo lives inside a OneDrive-synced
folder (this one does):

1. **File watching.** OneDrive exposes files as *reparse points*, which breaks
   the OS file-change notifications Uvicorn's ``watchfiles`` reloader relies on.
   The dev server then silently stops picking up your edits - you keep running
   stale code and chase phantom bugs. ``StatReload`` polls file mtimes instead,
   so it works regardless of where the repo is stored.

2. **The Windows restart race.** Uvicorn's win32 reload sends a
   ``CTRL_C_EVENT`` to the worker to restart it. That event can also reach the
   *supervisor*, which then stops supervising: the worker keeps running with
   stale code forever, and (because Windows allows two sockets on one port)
   can squat the port against a newer instance. ``SafeStatReload`` below
   terminates the worker directly instead, so the supervisor always survives.

Usage (from the ``backend/`` directory)::

    .\\venv\\Scripts\\python scripts\\dev_server.py
"""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

# Make sure the repo root is importable when run as `python scripts/dev_server.py`.
BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from uvicorn._subprocess import get_subprocess
from uvicorn.supervisors.statreload import StatReload


class SafeStatReload(StatReload):
    """StatReload that restarts the worker without Uvicorn's Windows CTRL_C dance."""

    def restart(self) -> None:
        self.mtimes = {}

        process = getattr(self, "process", None)
        if process is not None and process.is_alive():
            # multiprocessing.Process API (not subprocess.Popen - there is no
            # .poll() here).
            process.terminate()
            process.join(timeout=10)
            if process.is_alive():
                process.kill()
                process.join(timeout=5)

        self.process = get_subprocess(
            config=self.config, target=self.target, sockets=self.sockets
        )
        self.process.start()


# Force the polling reloader instead of the notification-based one.
# NOTE: `uvicorn.main` as an *attribute* of the package is the click Command
# object, not the module - the real module has to come from sys.modules.
uvicorn_main = importlib.import_module("uvicorn.main")
uvicorn_main.ChangeReload = SafeStatReload

import uvicorn  # noqa: E402  (imported after the patch so `run` sees it)

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8001


def main() -> None:
    host = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_HOST
    port = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PORT

    print(
        f"CrossEx dev server on http://{host}:{port} "
        "(mtime polling reload - OneDrive safe)"
    )
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=True,
        # Only watch source folders; the venv holds tens of thousands of files.
        reload_dirs=[str(BACKEND_ROOT / "app"), str(BACKEND_ROOT / "tests")],
        reload_delay=0.5,
        log_level="info",
    )


if __name__ == "__main__":
    main()
