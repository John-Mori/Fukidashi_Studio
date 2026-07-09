from __future__ import annotations

import json
import sys
from pathlib import Path

from image_inspect import inspect_image


def emit(payload: dict) -> int:
    print(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    return 0


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        return emit({"ok": False, "error": "missing command"})

    command = argv[1]
    if command == "ping":
        return emit({"ok": True, "command": "ping", "message": "pong"})

    if command == "inspect-image":
        if len(argv) < 3:
            return emit({"ok": False, "error": "missing image path"})
        try:
            result = inspect_image(Path(argv[2]))
            return emit({"ok": True, "image": result})
        except Exception as exc:  # noqa: BLE001 - CLI returns structured errors.
            return emit({"ok": False, "error": str(exc)})

    return emit({"ok": False, "error": f"unknown command: {command}"})


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
