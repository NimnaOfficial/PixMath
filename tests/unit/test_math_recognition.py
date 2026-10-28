"""Unit tests for proven Math OCR integration, LaTeX translation, and lossless watermarking."""

import io
import pytest
from PIL import Image, ImageDraw

from pixmath_core.recognition import (
    ConfidenceReport,
    ConfidenceScorer,
    LatexOCRLocalClient,
    MathOCRExecutionResult,
    MathRecognitionEngine,
    MathRecognitionResult,
    MathpixOCRClient,
    embed_forward_watermark,
    extract_forward_watermark,
    latex_to_equation,
    recognize_math_equation,
    route_to_math_ocr,
)


class TestForwardWatermarking:
    """Test lossless round-trip watermarking (PNG metadata + LSB steganography)."""

    def test_png_metadata_and_lsb_roundtrip(self) -> None:
        eq = "sin(x) * cos(y) + sqrt(x^2 + y^2)"
        ltx = r"\sin(x) \cos(y) + \sqrt{x^2 + y^2}"

        # Create dummy image
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


class TestLatexToEquation:
    """Test conversion from mathematical LaTeX into PixMath Python expressions."""

    def test_fractions_and_powers(self) -> None:
        ltx = r"\frac{x^2 + 1}{y - 3}"
        eq = latex_to_equation(ltx)
        assert "/" in eq
        assert "x" in eq and "y" in eq
        assert "**" in eq

    def test_trigonometric_and_radicals(self) -> None:
        ltx = r"\sin(x) \cos(y) + \sqrt{x^2 + y^2}"
        eq = latex_to_equation(ltx)
        assert "sin(x)" in eq
        assert "cos(y)" in eq
        assert "sqrt(" in eq

    def test_implicit_multiplication(self) -> None:
        ltx = r"2x + 3y"
        eq = latex_to_equation(ltx)
        assert "2*x" in eq
        assert "3*y" in eq

    def test_parentheses_balancing(self) -> None:
        ltx = r"((x + 1) * (y - 1"
        eq = latex_to_equation(ltx)
        assert eq.count("(") == eq.count(")")


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
            equation="invalid +++ ??",
            latex="?",
            raw_confidence=40.0,
            is_watermarked=False,
        )
        assert report.overall_score < 80.0
        assert report.grade == "low"
        assert report.is_reliable is False
        assert report.warning_message is not None
        assert "Forward Mode" in report.warning_message


class TestProvenMathOCRClients:
    """Test clean data handoff to Mathpix API and local LaTeX-OCR clients."""

    def test_mathpix_client_availability(self) -> None:
        client = MathpixOCRClient(app_id="test_id", app_key="test_key")
        assert client.is_available is True

        empty_client = MathpixOCRClient(app_id="", app_key="")
        assert empty_client.is_available is False

    def test_route_to_math_ocr_fallback(self) -> None:
        # Create a clean formula image
        img = Image.new("RGB", (200, 80), color="white")
        draw = ImageDraw.Draw(img)
        draw.text((20, 20), "x + y", fill="black")

        buf = io.BytesIO()
        img.save(buf, format="PNG")
        res = route_to_math_ocr(buf.getvalue())

        assert isinstance(res, MathOCRExecutionResult)
        assert res.confidence > 0.0
        assert isinstance(res.equation, str)


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
