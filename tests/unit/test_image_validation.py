"""Unit tests for the deep image validation pipeline."""

from __future__ import annotations

import io
import numpy as np
import pytest
from PIL import Image

from pixmath_core.validation import validate_image_ephemeral


def _create_png_bytes(arr: np.ndarray) -> bytes:
    buf = io.BytesIO()
    img = Image.fromarray(arr)
    img.save(buf, format="PNG")
    return buf.getvalue()


class TestImageValidation:
    """Tests for validate_image_ephemeral."""

    def test_valid_math_contour(self) -> None:
        """A continuous wave surface should pass validation with a high score."""
        x, y = np.meshgrid(np.linspace(-1, 1, 256), np.linspace(-1, 1, 256))
        wave = np.sin(10.0 * np.sqrt(x**2 + y**2)) * np.cos(8.0 * np.arctan2(y, x))
        arr = np.uint8(np.clip((wave * 0.5 + 0.5) * 255, 0, 255))
        data = _create_png_bytes(arr)

        report = validate_image_ephemeral(data)
        assert report.is_valid is True
        assert report.overall_score >= 70.0
        assert report.grade in ("A+", "A", "B")
        assert len(report.rejection_reasons) == 0

    def test_solid_monochrome_rejected(self) -> None:
        """A solid white image must be rejected due to lack of contrast."""
        arr = np.full((128, 128), 255, dtype=np.uint8)
        data = _create_png_bytes(arr)

        report = validate_image_ephemeral(data)
        assert report.is_valid is False
        assert report.grade == "Declined"
        assert any("insufficient visual contrast" in r for r in report.rejection_reasons)

    def test_pure_random_noise_rejected(self) -> None:
        """Uncorrelated static noise must be rejected."""
        rng = np.random.default_rng(42)
        arr = rng.integers(0, 256, (256, 256), dtype=np.uint8)
        data = _create_png_bytes(arr)

        report = validate_image_ephemeral(data)
        assert report.is_valid is False
        assert any("excessive random noise" in r for r in report.rejection_reasons)

    def test_tiny_resolution_rejected(self) -> None:
        """Images below 32x32 must be rejected."""
        arr = np.full((16, 16), 128, dtype=np.uint8)
        data = _create_png_bytes(arr)

        report = validate_image_ephemeral(data)
        assert report.is_valid is False
        assert any("too low" in r for r in report.rejection_reasons)

    def test_corrupt_bytes_handled_gracefully(self) -> None:
        """Invalid bytes should return a friendly decline without crashing."""
        report = validate_image_ephemeral(b"not-a-valid-image-stream-garbage")
        assert report.is_valid is False
        assert report.overall_score == 0.0
        assert len(report.rejection_reasons) > 0
