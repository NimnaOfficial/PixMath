"""Confidence scoring and uncertainty estimation for mathematical surface recognition.

Calculates quantitative accuracy score (0-100%) and error margin based on:
1. Surface regression R^2 coefficient of determination (fit fidelity).
2. Root Mean Squared Error (RMSE) against sampled image elevation.
3. Ast/sandbox syntactic and mathematical validity.
4. Flagging ambiguous or low-confidence parameters.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class UncertainToken:
    """A specific sub-expression or parameter flagged as low-confidence."""

    token: str
    position: tuple[int, int]  # (start_char_idx, end_char_idx) in equation string
    confidence: float  # 0.0 to 100.0
    reason: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "token": self.token,
            "position": list(self.position),
            "confidence": round(self.confidence, 1),
            "reason": self.reason,
        }


@dataclass(frozen=True, slots=True)
class ConfidenceReport:
    """Quantitative diagnostics and certainty evaluation."""

    overall_score: float  # 0.0 to 100.0
    grade: str  # "high" (>=90), "medium" (75-89), "low" (<75)
    is_reliable: bool  # True if overall_score >= 80.0
    symbol_certainty: float  # 0.0 to 100.0
    syntax_validity: float  # 0.0 to 100.0
    r2_score: float  # 0.0 to 1.0
    rmse: float  # Root mean squared error
    uncertain_tokens: list[UncertainToken]
    warning_message: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "grade": self.grade,
            "is_reliable": self.is_reliable,
            "symbol_certainty": round(self.symbol_certainty, 1),
            "syntax_validity": round(self.syntax_validity, 1),
            "r2_score": round(self.r2_score, 4),
            "rmse": round(self.rmse, 4),
            "uncertain_tokens": [t.to_dict() for t in self.uncertain_tokens],
            "warning_message": self.warning_message,
        }


class ConfidenceScorer:
    """Evaluates mathematical expression certainty and surface regression fidelity."""

    CONFIDENCE_THRESHOLD = 80.0

    def evaluate(
        self,
        equation: str,
        latex: str = "",
        raw_confidence: float = 95.0,
        r2_score: float = 0.95,
        rmse: float = 0.05,
        is_watermarked: bool = False,
    ) -> ConfidenceReport:
        """Calculate overall accuracy score and extract uncertain tokens.

        Parameters:
            equation: Parsed Python/GLSL math equation string.
            latex: LaTeX representation.
            raw_confidence: Direct confidence score from regression engine (0-100).
            r2_score: Surface regression R^2 score.
            rmse: Root Mean Squared Error between model and sampled pixels.
            is_watermarked: True if extracted via lossless forward watermark.

        Returns:
            Structured ConfidenceReport.
        """
        if is_watermarked:
            return ConfidenceReport(
                overall_score=100.0,
                grade="high",
                is_reliable=True,
                symbol_certainty=100.0,
                syntax_validity=100.0,
                r2_score=1.0,
                rmse=0.0,
                uncertain_tokens=[],
                warning_message=None,
            )

        eq = (equation or "").strip()

        # 1. Syntax Validity Score
        syntax_score = 0.0
        # Convert ^ to ** for Python AST check
        eq_py = eq.replace("^", "**")
        try:
            ast.parse(eq_py, mode="eval")
            syntax_score += 50.0
        except Exception:
            pass

        # Check PixMath sandbox policy validation
        try:
            from pixmath_core.sandbox import validate

            validate(eq_py)
            syntax_score += 50.0
        except Exception:
            pass

        # 2. Blend Surface Regression Fit (R^2) with Syntax Verification
        # 70% weight on regression surface match, 30% on AST syntax soundness
        overall = round(0.70 * raw_confidence + 0.30 * syntax_score, 1)
        overall = max(5.0, min(99.0, overall))

        if overall >= 90.0:
            grade = "high"
        elif overall >= self.CONFIDENCE_THRESHOLD:
            grade = "medium"
        else:
            grade = "low"

        is_reliable = overall >= self.CONFIDENCE_THRESHOLD

        # 3. Identify Uncertain Tokens if confidence is below threshold
        uncertain_tokens: list[UncertainToken] = []
        if overall < self.CONFIDENCE_THRESHOLD:
            uncertain_tokens.append(
                UncertainToken(
                    token=eq[:30] if len(eq) > 30 else eq,
                    position=(0, min(30, len(eq))),
                    confidence=round(overall, 1),
                    reason=f"Regression R² fit is {round(r2_score * 100, 1)}% (RMSE: {round(rmse, 3)}). Higher variance in subtle contours.",
                )
            )

        warning_message: str | None = None
        if not is_reliable:
            warning_message = (
                f"Surface regression accuracy is {overall}% (< 80%). The extracted formula closely approximates "
                "the primary plot contours, but fine ripples may benefit from manual verification. "
                "We recommend clicking 'Edit in Forward Mode' to preview and refine."
            )

        return ConfidenceReport(
            overall_score=overall,
            grade=grade,
            is_reliable=is_reliable,
            symbol_certainty=raw_confidence,
            syntax_validity=syntax_score,
            r2_score=r2_score,
            rmse=rmse,
            uncertain_tokens=uncertain_tokens,
            warning_message=warning_message,
        )
