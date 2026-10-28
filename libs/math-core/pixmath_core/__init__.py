"""
PixMath Core — Shared mathematical primitives.

Submodules:
    sdf         Signed Distance Function primitives (circle, box, torus, smooth-min)
    noise       Simplex / Perlin noise generators
    metrics     Image quality metrics (PSNR, D-SSIM)
    sandbox     AST security validator for math expressions
    validation  Multi-layer image mathematical feasibility validator
    recognition Math-aware image-to-equation recognition and watermark pipeline
"""

from .recognition import (
    ConfidenceReport,
    MathRecognitionEngine,
    MathRecognitionResult,
    embed_forward_watermark,
    extract_forward_watermark,
    recognize_math_equation,
)
from .validation import ImageValidationReport, validate_image_ephemeral

__version__ = "0.1.0"
__all__ = [
    "ConfidenceReport",
    "ImageValidationReport",
    "MathRecognitionEngine",
    "MathRecognitionResult",
    "embed_forward_watermark",
    "extract_forward_watermark",
    "recognize_math_equation",
    "validate_image_ephemeral",
    "__version__",
]
