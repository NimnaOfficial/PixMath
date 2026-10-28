"""PixMath Recognition Module — Proven Math OCR Engine & Round-Trip Watermark."""

from __future__ import annotations

from .confidence import ConfidenceReport, ConfidenceScorer, UncertainToken
from .engine import MathRecognitionEngine, MathRecognitionResult, recognize_math_equation
from .ocr_bridge import (
    LatexOCRLocalClient,
    MathOCRExecutionResult,
    MathpixOCRClient,
    latex_to_equation,
    route_to_math_ocr,
)
from .watermark import embed_forward_watermark, extract_forward_watermark

__all__ = [
    "ConfidenceReport",
    "ConfidenceScorer",
    "LatexOCRLocalClient",
    "MathOCRExecutionResult",
    "MathRecognitionEngine",
    "MathRecognitionResult",
    "MathpixOCRClient",
    "UncertainToken",
    "embed_forward_watermark",
    "extract_forward_watermark",
    "latex_to_equation",
    "recognize_math_equation",
    "route_to_math_ocr",
]
