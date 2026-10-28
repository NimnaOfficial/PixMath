"""Unit tests for Computer Vision 2D Plot Extraction and Symbolic Surface Regression."""

from __future__ import annotations

import io
import numpy as np
import pytest
from PIL import Image

from pixmath_core.recognition import (
    CartesianGridInfo,
    ConfidenceReport,
    ConfidenceScorer,
    ExtractedSurfaceData,
    MathRecognitionEngine,
    MathRecognitionResult,
    SurfaceRegressionResult,
    detect_cartesian_grid,
    embed_forward_watermark,
    extract_forward_watermark,
    extract_surface_points,
    fit_surface_equation,
    map_color_to_z,
    recognize_math_equation,
)


class TestForwardWatermarking:
    """Test lossless round-trip watermarking (PNG metadata + LSB steganography)."""

    def test_png_metadata_and_lsb_roundtrip(self) -> None:
        eq = "sin(x) * cos(y) + sqrt(x^2 + y^2)"
        ltx = r"\sin(x) \cos(y) + \sqrt{x^2 + y^2}"

        img = Image.new("RGB", (256, 256), color=(20, 30, 40))
        watermarked = embed_forward_watermark(img, equation=eq, latex=ltx)

        # 1. Direct PIL extraction
        res1 = extract_forward_watermark(watermarked)
        assert res1 is not None
        assert res1[0] == eq
        assert res1[1] == ltx

        # 2. PNG byte stream extraction (standard metadata path)
        buf = io.BytesIO()
        watermarked.save(buf, format="PNG", pnginfo=getattr(watermarked, "_pnginfo", None))
        png_bytes = buf.getvalue()

        res2 = extract_forward_watermark(png_bytes)
        assert res2 is not None
        assert res2[0] == eq
        assert res2[1] == ltx

        # 3. LSB Steganography extraction (when PNG chunks are stripped)
        loaded = Image.open(io.BytesIO(png_bytes))
        loaded.info.clear()  # forcibly strip PNG metadata chunks
        res3 = extract_forward_watermark(loaded)
        assert res3 is not None
        assert res3[0] == eq
        assert res3[1] == ltx

    def test_watermark_with_rgba_image(self) -> None:
        img = Image.new("RGBA", (128, 128), color=(255, 0, 100, 200))
        watermarked = embed_forward_watermark(img, equation="x**2 + y**2")
        assert watermarked.mode == "RGBA"
        res = extract_forward_watermark(watermarked)
        assert res is not None
        assert res[0] == "x**2 + y**2"

    def test_clean_unwatermarked_image_returns_none(self) -> None:
        img = Image.new("RGB", (64, 64), color="indigo")
        assert extract_forward_watermark(img) is None


class TestSurfaceDataExtraction:
    """Test Computer Vision 2D plot extraction: grid detection and color-to-Z mapping."""

    def test_cartesian_grid_detection_with_axes(self) -> None:
        img = np.zeros((256, 256), dtype=np.float32)
        # Background gradient
        y, x = np.mgrid[0:256, 0:256]
        img[:, :] = np.sin(x / 16.0) * 0.2 + 0.5
        # Primary axes at center 128, 128
        img[128, :] = 1.0
        img[:, 128] = 1.0

        grid_info = detect_cartesian_grid(img)
        assert isinstance(grid_info, CartesianGridInfo)
        assert abs(grid_info.origin_x - 128.0) <= 2.0
        assert abs(grid_info.origin_y - 128.0) <= 2.0

    def test_color_to_z_mapping(self) -> None:
        orange_peak = np.array([0.96, 0.62, 0.04])
        black_trough = np.array([0.02, 0.03, 0.05])
        cyan_zero = np.array([0.02, 0.71, 0.83])
        green_zero = np.array([0.06, 0.72, 0.51])

        z_orange = float(map_color_to_z(orange_peak))
        z_black = float(map_color_to_z(black_trough))
        z_cyan = float(map_color_to_z(cyan_zero))
        z_green = float(map_color_to_z(green_zero))

        assert z_orange >= 0.7, f"Orange should map to positive peak, got {z_orange}"
        assert z_black <= -0.7, f"Black should map to negative trough, got {z_black}"
        assert abs(z_cyan) <= 0.35, f"Cyan should map near zero, got {z_cyan}"
        assert abs(z_green) <= 0.35, f"Green should map near zero, got {z_green}"

    def test_extract_surface_points_ephemeral(self) -> None:
        pil_img = Image.new("RGB", (128, 128), color=(30, 40, 50))
        surf_data = extract_surface_points(pil_img, sample_resolution=32)

        assert isinstance(surf_data, ExtractedSurfaceData)
        assert surf_data.coords.shape == (32 * 32, 2)
        assert surf_data.z_values.shape == (32 * 32,)
        assert surf_data.z_grid.shape == (32, 32)
        assert np.all(surf_data.z_values >= -1.0) and np.all(surf_data.z_values <= 1.0)


class TestSurfaceSymbolicRegression:
    """Test fitting mathematical closed-form formulas to continuous 2D surface data."""

    def test_harmonic_wave_product_fitting(self) -> None:
        # Create synthetic surface z = sin(3x) * cos(3y)
        res = 48
        lin = np.linspace(-1.0, 1.0, res, dtype=np.float32)
        gy, gx = np.meshgrid(lin, lin, indexing="ij")
        z_true = np.sin(3.0 * gx) * np.cos(3.0 * gy)

        grid_info = CartesianGridInfo(
            has_grid=False,
            origin_x=res / 2.0,
            origin_y=res / 2.0,
            scale_x=res / 2.0,
            scale_y=res / 2.0,
            domain_x=(-1.0, 1.0),
            domain_y=(-1.0, 1.0),
            grid_spacing=None,
        )
        surf_data = ExtractedSurfaceData(
            coords=np.column_stack([gx.ravel(), gy.ravel()]),
            z_values=z_true.ravel(),
            z_grid=z_true,
            x_lin=lin,
            y_lin=lin,
            grid_info=grid_info,
            width=res,
            height=res,
        )

        result = fit_surface_equation(surf_data)
        assert isinstance(result, SurfaceRegressionResult)
        assert "sin" in result.equation and "cos" in result.equation
        assert result.r2_score >= 0.90
        assert result.confidence >= 90.0
        assert result.confidence_grade == "high"

    def test_radial_ripple_fitting(self) -> None:
        res = 48
        lin = np.linspace(-1.0, 1.0, res, dtype=np.float32)
        gy, gx = np.meshgrid(lin, lin, indexing="ij")
        r = np.sqrt(gx**2 + gy**2)
        z_true = np.sin(5.0 * r)

        grid_info = CartesianGridInfo(
            has_grid=False,
            origin_x=res / 2.0,
            origin_y=res / 2.0,
            scale_x=res / 2.0,
            scale_y=res / 2.0,
            domain_x=(-1.0, 1.0),
            domain_y=(-1.0, 1.0),
            grid_spacing=None,
        )
        surf_data = ExtractedSurfaceData(
            coords=np.column_stack([gx.ravel(), gy.ravel()]),
            z_values=z_true.ravel(),
            z_grid=z_true,
            x_lin=lin,
            y_lin=lin,
            grid_info=grid_info,
            width=res,
            height=res,
        )

        result = fit_surface_equation(surf_data)
        assert "sqrt" in result.equation
        assert result.r2_score >= 0.90
        assert result.confidence >= 90.0
        assert result.method == "radial_concentric_wave"

    def test_quadric_saddle_fitting(self) -> None:
        res = 48
        lin = np.linspace(-1.0, 1.0, res, dtype=np.float32)
        gy, gx = np.meshgrid(lin, lin, indexing="ij")
        z_true = gx**2 - gy**2

        grid_info = CartesianGridInfo(
            has_grid=False,
            origin_x=res / 2.0,
            origin_y=res / 2.0,
            scale_x=res / 2.0,
            scale_y=res / 2.0,
            domain_x=(-1.0, 1.0),
            domain_y=(-1.0, 1.0),
            grid_spacing=None,
        )
        surf_data = ExtractedSurfaceData(
            coords=np.column_stack([gx.ravel(), gy.ravel()]),
            z_values=z_true.ravel(),
            z_grid=z_true,
            x_lin=lin,
            y_lin=lin,
            grid_info=grid_info,
            width=res,
            height=res,
        )

        result = fit_surface_equation(surf_data)
        assert ("x" in result.equation) and ("y" in result.equation)
        assert result.r2_score >= 0.95
        assert result.confidence >= 90.0


class TestConfidenceScorer:
    """Test accuracy score calculation, uncertainty detection, and warning thresholds."""

    def test_watermarked_image_yields_100_percent_confidence(self) -> None:
        scorer = ConfidenceScorer()
        report = scorer.evaluate(
            equation="sin(x)",
            latex=r"\sin(x)",
            is_watermarked=True,
        )
        assert report.overall_score == 100.0
        assert report.grade == "high"
        assert report.is_reliable is True
        assert report.warning_message is None
        assert len(report.uncertain_tokens) == 0

    def test_low_confidence_triggers_warning(self) -> None:
        scorer = ConfidenceScorer()
        report = scorer.evaluate(
            equation="sin(x * 3.0)",
            latex=r"\sin(3x)",
            raw_confidence=50.0,
            r2_score=0.50,
            rmse=0.35,
            is_watermarked=False,
        )
        assert report.overall_score < 80.0
        assert report.grade == "low"
        assert report.is_reliable is False
        assert report.warning_message is not None
        assert "Forward Mode" in report.warning_message


class TestEngineEndToEnd:
    """End-to-end integration tests for the MathRecognitionEngine."""

    def test_roundtrip_equation_lossless(self) -> None:
        original_eq = "sin(x * y) + cos(x / (y + 1.0))"
        original_ltx = r"\sin(x y) + \cos\left(\frac{x}{y + 1}\right)"

        img = Image.new("RGB", (256, 256), color=(10, 20, 30))
        watermarked = embed_forward_watermark(img, equation=original_eq, latex=original_ltx)

        buf = io.BytesIO()
        watermarked.save(buf, format="PNG", pnginfo=getattr(watermarked, "_pnginfo", None))
        image_bytes = buf.getvalue()

        result = recognize_math_equation(image_bytes)

        assert isinstance(result, MathRecognitionResult)
        assert result.equation == original_eq
        assert result.latex == original_ltx
        assert result.confidence == 100.0
        assert result.is_roundtrip_lossless is True
        assert result.method == "lossless_watermark"
        assert result.processing_time_ms < 50.0

    def test_unwatermarked_plot_surface_recognition(self) -> None:
        # Generate an unwatermarked 2D scalar plot
        res = 128
        lin = np.linspace(-1.0, 1.0, res, dtype=np.float32)
        gy, gx = np.meshgrid(lin, lin, indexing="ij")
        z_true = np.sin(3.0 * gx) * np.cos(3.0 * gy)

        elev = np.clip(z_true * 0.5 + 0.5, 0.0, 1.0)
        void = np.array([0.02, 0.03, 0.05])
        cyan = np.array([0.02, 0.71, 0.83])
        emerald = np.array([0.06, 0.72, 0.51])
        amber = np.array([0.96, 0.62, 0.04])

        def smoothstep(e0, e1, v):
            t = np.clip((v - e0) / (e1 - e0), 0.0, 1.0)
            return t * t * (3.0 - 2.0 * t)

        col = void + (cyan - void) * smoothstep(0.1, 0.5, elev)[:, :, None]
        col = col + (emerald - col) * smoothstep(0.5, 0.8, elev)[:, :, None]
        col = col + (amber - col) * smoothstep(0.8, 0.98, elev)[:, :, None]
        img_arr = (np.clip(col, 0.0, 1.0) * 255.0).astype(np.uint8)

        pil_img = Image.fromarray(img_arr, mode="RGB")
        buf = io.BytesIO()
        pil_img.save(buf, format="PNG")

        result = recognize_math_equation(buf.getvalue())
        assert isinstance(result, MathRecognitionResult)
        assert result.is_roundtrip_lossless is False
        assert "sin" in result.equation and "cos" in result.equation
        assert result.confidence >= 80.0
        assert result.method == "harmonic_wave_product"
