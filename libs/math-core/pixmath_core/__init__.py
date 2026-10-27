"""
PixMath Core — Shared mathematical primitives.

Submodules:
    sdf         Signed Distance Function primitives (circle, box, torus, smooth-min)
    noise       Simplex / Perlin noise generators
    metrics     Image quality metrics (PSNR, D-SSIM)
    sandbox     AST security validator for math expressions
    validation  Multi-layer image mathematical feasibility validator
"""

from .validation import ImageValidationReport, validate_image_ephemeral

__version__ = "0.1.0"
__all__ = ["ImageValidationReport", "validate_image_ephemeral", "__version__"]
