from __future__ import annotations

import imghdr
import struct
from pathlib import Path
from typing import TypedDict


class ImageInfo(TypedDict):
    path: str
    format: str
    width: int
    height: int
    has_alpha: bool | None
    size_bytes: int


PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _inspect_png(data: bytes) -> tuple[int, int, bool | None]:
    if len(data) < 33 or not data.startswith(PNG_SIGNATURE):
        raise ValueError("invalid PNG")
    width, height = struct.unpack(">II", data[16:24])
    color_type = data[25]
    has_alpha = color_type in (4, 6)
    return width, height, has_alpha


def _inspect_jpeg(data: bytes) -> tuple[int, int, bool | None]:
    if len(data) < 4 or data[:2] != b"\xff\xd8":
        raise ValueError("invalid JPEG")
    offset = 2
    while offset < len(data):
        if data[offset] != 0xFF:
            offset += 1
            continue
        marker = data[offset + 1]
        offset += 2
        if marker in (0xD8, 0xD9):
            continue
        if offset + 2 > len(data):
            break
        segment_length = struct.unpack(">H", data[offset:offset + 2])[0]
        if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
            if offset + 7 > len(data):
                break
            height, width = struct.unpack(">HH", data[offset + 3:offset + 7])
            return width, height, False
        offset += segment_length
    raise ValueError("JPEG size marker not found")


def _inspect_webp(data: bytes) -> tuple[int, int, bool | None]:
    if len(data) < 30 or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("invalid WebP")
    chunk = data[12:16]
    if chunk == b"VP8X":
        flags = data[20]
        width = 1 + int.from_bytes(data[24:27], "little")
        height = 1 + int.from_bytes(data[27:30], "little")
        return width, height, bool(flags & 0b00010000)
    if chunk == b"VP8 ":
        width, height = struct.unpack("<HH", data[26:30])
        return width & 0x3FFF, height & 0x3FFF, False
    if chunk == b"VP8L":
        b0, b1, b2, b3 = data[21:25]
        width = 1 + (((b1 & 0x3F) << 8) | b0)
        height = 1 + (((b3 & 0x0F) << 10) | (b2 << 2) | ((b1 & 0xC0) >> 6))
        return width, height, True
    raise ValueError("unsupported WebP chunk")


def inspect_image(path: Path) -> ImageInfo:
    data = path.read_bytes()
    kind = imghdr.what(None, data)
    if kind == "png":
        width, height, has_alpha = _inspect_png(data)
        fmt = "png"
    elif kind == "jpeg":
        width, height, has_alpha = _inspect_jpeg(data)
        fmt = "jpeg"
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        width, height, has_alpha = _inspect_webp(data)
        fmt = "webp"
    else:
        raise ValueError("unsupported image format")

    return {
        "path": str(path),
        "format": fmt,
        "width": width,
        "height": height,
        "has_alpha": has_alpha,
        "size_bytes": len(data),
    }
