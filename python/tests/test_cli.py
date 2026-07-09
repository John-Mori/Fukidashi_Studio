from __future__ import annotations

import json
import subprocess
import sys
import unittest
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PYTHON_SRC = ROOT / "python" / "src"
FIXTURES = ROOT / "python" / "fixtures"


def make_png(path: Path, width: int, height: int) -> None:
    def chunk(kind: bytes, payload: bytes) -> bytes:
        import binascii
        body = kind + payload
        return len(payload).to_bytes(4, "big") + body + binascii.crc32(body).to_bytes(4, "big")

    raw = b"".join(b"\x00" + b"\xff\xff\xff\xff" * width for _ in range(height))
    data = b"\x89PNG\r\n\x1a\n"
    data += chunk(b"IHDR", width.to_bytes(4, "big") + height.to_bytes(4, "big") + b"\x08\x06\x00\x00\x00")
    data += chunk(b"IDAT", zlib.compress(raw))
    data += chunk(b"IEND", b"")
    path.write_bytes(data)


class CliTests(unittest.TestCase):
    def setUp(self) -> None:
        FIXTURES.mkdir(parents=True, exist_ok=True)

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
        make_png(image_path, 852, 1280)
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
