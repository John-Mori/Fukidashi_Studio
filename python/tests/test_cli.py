from __future__ import annotations

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PYTHON_SRC = ROOT / "python" / "src"
FIXTURES = ROOT / "python" / "fixtures"


class CliTests(unittest.TestCase):
    def test_ping(self) -> None:
        result = subprocess.run(
            [sys.executable, str(PYTHON_SRC / "cli.py"), "ping"],
            check=True,
            text=True,
            capture_output=True,
        )
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["message"], "pong")

    def test_inspect_png_size(self) -> None:
        image_path = FIXTURES / "sample_852x1280.png"
        self.assertTrue(image_path.exists(), f"Fixture not found: {image_path}")
        result = subprocess.run(
            [sys.executable, str(PYTHON_SRC / "cli.py"), "inspect-image", str(image_path)],
            check=True,
            text=True,
            capture_output=True,
        )
        payload = json.loads(result.stdout)
        self.assertTrue(payload["ok"])
        self.assertEqual(payload["image"]["format"], "png")
        self.assertEqual(payload["image"]["width"], 852)
        self.assertEqual(payload["image"]["height"], 1280)
        self.assertTrue(payload["image"]["has_alpha"])


if __name__ == "__main__":
    unittest.main()
