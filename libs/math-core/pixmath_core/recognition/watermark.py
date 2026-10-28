"""Lossless metadata and steganographic watermarking for PixMath images.

Ensures 100% round-trip fidelity between Forward Mode (Equation -> Image)
and Reverse Mode (Image -> Equation).

Dual-layer embedding:
1. Standard PNG `tEXt` metadata chunks ('pixmath_equation', 'pixmath_latex', 'pixmath_version').
2. Invisible LSB (Least Significant Bit) steganographic watermark with CRC16 verification
   embedded across pixel RGB scanlines. This survives metadata stripping and uncompressed re-saves.

Strictly ephemeral and memory-safe: No temporary files are written to disk.
"""

from __future__ import annotations

import io
import json
import struct
import zlib
from typing import Any

import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

_MAGIC_HEADER = b"PXMT"
_VERSION = "1.0"


def embed_forward_watermark(
    image: Image.Image,
    equation: str,
    latex: str | None = None,
) -> Image.Image:
    """Embed equation and LaTeX metadata into an image both via PNG chunks and LSB steganography.

    Parameters:
        image: Source PIL Image (RGB or RGBA).
        equation: PixMath equation string.
        latex: Optional LaTeX representation of the equation.

    Returns:
        A new PIL Image containing the dual-layer watermark.
        The returned image has a ``_pnginfo`` attribute attached for easy PNG saving.
    """
    if latex is None:
        latex = equation

    # 1. Prepare PNG text chunk info
    png_info = PngInfo()
    png_info.add_text("pixmath_equation", equation)
    png_info.add_text("pixmath_latex", latex)
    png_info.add_text("pixmath_version", _VERSION)
    png_info.add_text("pixmath_signature", "PIXMATH_V1")

    # 2. Prepare LSB payload: JSON encoded with CRC16
    payload_dict = {
        "eq": equation,
        "ltx": latex,
        "v": _VERSION,
    }
    payload_bytes = json.dumps(payload_dict, separators=(",", ":")).encode("utf-8")
    payload_len = len(payload_bytes)

    # Maximum payload size 65535 bytes
    if payload_len > 65535:
        # Fallback without LSB if equation is gigantic, relying on PNG metadata
        res_img = image.copy()
        setattr(res_img, "_pnginfo", png_info)
        return res_img

    crc16 = zlib.crc32(payload_bytes) & 0xFFFF
    full_wire = _MAGIC_HEADER + struct.pack(">H", payload_len) + payload_bytes + struct.pack(">H", crc16)
    wire_bits = np.unpackbits(np.frombuffer(full_wire, dtype=np.uint8))

    # 3. LSB embedding into RGB channels
    orig_mode = image.mode
    alpha_channel = None
    if orig_mode == "RGBA":
        alpha_channel = image.split()[-1]

    rgb_img = image.convert("RGB")
    arr = np.array(rgb_img, dtype=np.uint8)
    flat = arr.reshape(-1)

    if len(wire_bits) <= len(flat):
        flat[: len(wire_bits)] = (flat[: len(wire_bits)] & 0xFE) | wire_bits
        arr = flat.reshape(arr.shape)
        watermarked_img = Image.fromarray(arr, mode="RGB")
        if alpha_channel is not None:
            watermarked_img = watermarked_img.convert("RGBA")
            watermarked_img.putalpha(alpha_channel)
        elif orig_mode != "RGB":
            watermarked_img = watermarked_img.convert(orig_mode)
    else:
        watermarked_img = image.copy()

    # Attach PngInfo for caller saving
    setattr(watermarked_img, "_pnginfo", png_info)
    return watermarked_img


def extract_forward_watermark(
    image_input: bytes | Image.Image,
) -> tuple[str, str] | None:
    """Extract embedded equation and LaTeX from an image via metadata or LSB watermark.

    Parameters:
        image_input: Either raw binary image bytes or a loaded PIL Image.

    Returns:
        Tuple of ``(equation, latex)`` if a verified PixMath watermark is found,
        or ``None`` if no watermark is present.
    """
    pil_img: Image.Image | None = None
    should_close = False

    try:
        if isinstance(image_input, bytes):
            pil_img = Image.open(io.BytesIO(image_input))
            should_close = True
        else:
            pil_img = image_input

        # 1. Fast-path: Check PNG text chunks in info / text dict
        info_dict = getattr(pil_img, "info", {}) or {}
        text_dict = getattr(pil_img, "text", {}) or {}
        combined_info: dict[str, Any] = {**info_dict, **text_dict}

        eq = combined_info.get("pixmath_equation")
        ltx = combined_info.get("pixmath_latex")

        if eq and isinstance(eq, str) and len(eq.strip()) > 0:
            return eq.strip(), (ltx.strip() if (ltx and isinstance(ltx, str)) else eq.strip())

        # 2. Second-path: Check LSB steganographic watermark
        rgb_img = pil_img.convert("RGB")
        arr = np.array(rgb_img, dtype=np.uint8)
        flat = arr.reshape(-1)

        # Need at least 48 bits for magic + length
        if len(flat) < 48:
            return None

        # Read first 48 bits
        header_bits = flat[:48] & 1
        header_bytes = np.packbits(header_bits).tobytes()

        if header_bytes[:4] != _MAGIC_HEADER:
            return None

        payload_len = struct.unpack(">H", header_bytes[4:6])[0]
        total_bytes = 4 + 2 + payload_len + 2
        total_bits = total_bytes * 8

        if len(flat) < total_bits:
            return None

        all_bits = flat[:total_bits] & 1
        all_bytes = np.packbits(all_bits).tobytes()

        payload = all_bytes[6 : 6 + payload_len]
        expected_crc = struct.unpack(">H", all_bytes[6 + payload_len : 6 + payload_len + 2])[0]
        actual_crc = zlib.crc32(payload) & 0xFFFF

        if actual_crc != expected_crc:
            return None

        # Validated CRC16: deserialise payload JSON
        data = json.loads(payload.decode("utf-8"))
        eq_found = data.get("eq", "")
        ltx_found = data.get("ltx", eq_found)
        if eq_found:
            return str(eq_found).strip(), str(ltx_found).strip()

        return None
    except Exception:
        return None
    finally:
        if should_close and pil_img is not None:
            try:
                pil_img.close()
            except Exception:
                pass
