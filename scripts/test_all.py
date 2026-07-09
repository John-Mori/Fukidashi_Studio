from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PNPM = shutil.which("pnpm") or shutil.which("pnpm.cmd") or "pnpm.cmd"
COMMANDS = [
    [PNPM, "run", "build"],
    [PNPM, "run", "test"],
    [PNPM, "run", "python:test"],
    [PNPM, "run", "python:smoke"],
]


def run_command(command: list[str]) -> dict:
    started = datetime.now(timezone.utc)
    completed = subprocess.run(command, cwd=ROOT, text=True, encoding="utf-8", errors="replace", capture_output=True, shell=False)
    ended = datetime.now(timezone.utc)
    return {
        "command": command,
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "started_at": started.isoformat(),
        "ended_at": ended.isoformat(),
        "stdout_tail": (completed.stdout or "")[-4000:],
        "stderr_tail": (completed.stderr or "")[-4000:],
    }


def main() -> int:
    results = [run_command(command) for command in COMMANDS]
    ok = all(result["ok"] for result in results)
    report = {
        "ok": ok,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "results": results,
    }
    report_path = ROOT / "docs" / "CHECK_REPORT.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": ok, "report": str(report_path)}, ensure_ascii=False))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())

