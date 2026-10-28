"""Unified Math Surface Recognition Engine for PixMath.

Bridges uploaded 2D mathematical scalar field plots ephemerally to closed-form equations:
1. Fast-path lossless round-trip recovery (PNG metadata & LSB watermark, 0-1 ms).
2. Computer Vision Data Extraction: Grid/axis detection and color-to-Z elevation sampling.
3. Analytical & Symbolic Surface Regression: Fits harmonic, radial, quadric, and genetic equations.
4. Quantitative Confidence & R^2 Error Margin Scoring with AST security verification.
5. Strictly ephemeral memory management with zero disk persistence.
"""

from __future__ import annotations

import concurrent.futures
import gc
import os
import time
from dataclasses import dataclass
from typing import Any

from pixmath_core.recognition.confidence import ConfidenceReport, ConfidenceScorer
from pixmath_core.recognition.surface_extractor import extract_surface_points
from pixmath_core.recognition.surface_regressor import fit_surface_equation
from pixmath_core.recognition.watermark import extract_forward_watermark


@dataclass(frozen=True, slots=True)
class MathRecognitionResult:
    """Final structured result returned by the Math Recognition Engine."""

    equation: str
    latex: str
    confidence: float  # 0.0 to 100.0
    confidence_grade: str  # "high", "medium", "low"
    is_roundtrip_lossless: bool
    method: str  # "lossless_watermark", "harmonic_wave_product", "quadric_polynomial", etc.
    uncertain_tokens: list[dict[str, Any]]
    confidence_report: dict[str, Any]
    processing_time_ms: float

    def to_dict(self) -> dict[str, Any]:
        return {
            "equation": self.equation,
            "latex": self.latex,
            "confidence": self.confidence,
            "confidence_grade": self.confidence_grade,
            "is_roundtrip_lossless": self.is_roundtrip_lossless,
            "method": self.method,
            "uncertain_tokens": self.uncertain_tokens,
            "confidence_report": self.confidence_report,
            "processing_time_ms": self.processing_time_ms,
        }


# Global thread pool scaling to CPU cores for non-blocking execution
_NUM_WORKERS = max(2, min(8, (os.cpu_count() or 4)))
_GLOBAL_EXECUTOR = concurrent.futures.ThreadPoolExecutor(
    max_workers=_NUM_WORKERS,
    thread_name_prefix="pixmath-reg",
)


class MathRecognitionEngine:
    """Production-grade mathematical recognition engine using computer vision & symbolic regression."""

    def __init__(self) -> None:
        self.scorer = ConfidenceScorer()

    def recognize(
        self,
        image_bytes: bytes,
        *,
        sample_resolution: int = 48,
        allow_pysr: bool = False,
        executor: concurrent.futures.Executor | None = None,
    ) -> MathRecognitionResult:
        """Process image bytes and recognize mathematical equation ephemerally.

        Parameters:
            image_bytes: Raw binary image payload.
            sample_resolution: Grid side length for sampling points (default 48).
            allow_pysr: Whether to fall back to PySR if analytical fit R^2 < 0.85.
            executor: Optional concurrent executor for background processing.

        Returns:
            MathRecognitionResult.
        """
        t0 = time.perf_counter()

        # Step 1: Lossless Round-Trip Fast-Path (0-1 ms)
        # Check PNG text metadata and LSB watermark for authentic PixMath renders
        watermark_hit = extract_forward_watermark(image_bytes)
        if watermark_hit is not None:
            eq, ltx = watermark_hit
            report = self.scorer.evaluate(
                equation=eq,
                latex=ltx,
                raw_confidence=100.0,
                r2_score=1.0,
                rmse=0.0,
                is_watermarked=True,
            )
            elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
            return MathRecognitionResult(
                equation=eq,
                latex=ltx,
                confidence=100.0,
                confidence_grade="high",
                is_roundtrip_lossless=True,
                method="lossless_watermark",
                uncertain_tokens=[],
                confidence_report=report.to_dict(),
                processing_time_ms=elapsed_ms,
            )

        # Step 2: Computer Vision Data Extraction Layer (Ephemeral In-Memory)
        def _extract_and_fit() -> tuple[Any, Any]:
            surf_data = extract_surface_points(image_bytes, sample_resolution=sample_resolution)
            fit_res = fit_surface_equation(surf_data, allow_pysr=allow_pysr)
            return surf_data, fit_res

        active_executor = executor or _GLOBAL_EXECUTOR
        future = active_executor.submit(_extract_and_fit)
        _, fit_res = future.result()

        # Step 3: Confidence Evaluation & AST Security Validation
        report = self.scorer.evaluate(
            equation=fit_res.equation,
            latex=fit_res.latex,
            raw_confidence=fit_res.confidence,
            r2_score=fit_res.r2_score,
            rmse=fit_res.rmse,
            is_watermarked=False,
        )

        elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)

        # Ephemeral hygiene: Clean image buffer references
        del image_bytes
        gc.collect()

        return MathRecognitionResult(
            equation=fit_res.equation,
            latex=fit_res.latex,
            confidence=report.overall_score,
            confidence_grade=report.grade,
            is_roundtrip_lossless=False,
            method=fit_res.method,
            uncertain_tokens=[t.to_dict() for t in report.uncertain_tokens],
            confidence_report=report.to_dict(),
            processing_time_ms=elapsed_ms,
        )


# Global singleton instance
_ENGINE = MathRecognitionEngine()


def recognize_math_equation(
    image_bytes: bytes,
    *,
    sample_resolution: int = 48,
    allow_pysr: bool = False,
    executor: concurrent.futures.Executor | None = None,
) -> MathRecognitionResult:
    """Convenience function to recognize a mathematical equation from image bytes."""
    return _ENGINE.recognize(
        image_bytes,
        sample_resolution=sample_resolution,
        allow_pysr=allow_pysr,
        executor=executor,
    )
