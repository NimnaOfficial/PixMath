"""PixMath Recognition Module — Computer Vision & Symbolic Surface Regression."""

from __future__ import annotations

from .confidence import ConfidenceReport, ConfidenceScorer, UncertainToken
from .engine import MathRecognitionEngine, MathRecognitionResult, recognize_math_equation
from .surface_extractor import (
    CartesianGridInfo,
    ExtractedSurfaceData,
    detect_cartesian_grid,
    extract_surface_points,
    map_color_to_z,
)
from .surface_regressor import (
    SurfaceRegressionResult,
    SurfaceRegressor,
    fit_surface_equation,
)
from .watermark import embed_forward_watermark, extract_forward_watermark

__all__ = [
    "CartesianGridInfo",
    "ConfidenceReport",
    "ConfidenceScorer",
    "ExtractedSurfaceData",
    "MathRecognitionEngine",
    "MathRecognitionResult",
    "SurfaceRegressionResult",
    "SurfaceRegressor",
    "UncertainToken",
    "detect_cartesian_grid",
    "embed_forward_watermark",
    "extract_forward_watermark",
    "extract_surface_points",
    "fit_surface_equation",
    "map_color_to_z",
    "recognize_math_equation",
]
