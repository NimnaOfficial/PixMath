"""Confidence scoring and uncertainty estimation for mathematical recognition.

Calculates quantitative accuracy score (0-100%) and identifies specific
uncertain tokens or ambiguous sub-expressions that may require manual
verification in Forward Mode.
"""

from __future__ import annotations

import ast
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True, slots=True)
class UncertainToken:
    """A specific sub-expression or token flagged as ambiguous."""

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
    grade: str  # "high" (>=90), "medium" (80-89), "low" (<80)
    is_reliable: bool  # True if overall_score >= 80.0
    symbol_certainty: float  # 0.0 to 100.0
    syntax_validity: float  # 0.0 to 100.0
    uncertain_tokens: list[UncertainToken]
    warning_message: str | None

    def to_dict(self) -> dict[str, Any]:
        return {
            "overall_score": self.overall_score,
            "grade": self.grade,
            "is_reliable": self.is_reliable,
            "symbol_certainty": round(self.symbol_certainty, 1),
            "syntax_validity": round(self.syntax_validity, 1),
            "uncertain_tokens": [t.to_dict() for t in self.uncertain_tokens],
            "warning_message": self.warning_message,
        }


class ConfidenceScorer:
    """Evaluates mathematical expression certainty and flags ambiguous sub-expressions."""

    CONFIDENCE_THRESHOLD = 80.0

    def evaluate(
        self,
        equation: str,
        latex: str = "",
        raw_confidence: float = 95.0,
        is_watermarked: bool = False,
    ) -> ConfidenceReport:
        """Calculate overall accuracy score and extract uncertain tokens.

        Parameters:
            equation: Parsed Python math equation string.
            latex: LaTeX representation.
            raw_confidence: Direct confidence score from the OCR provider (0-100).
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
                uncertain_tokens=[],
                warning_message=None,
            )

        eq = (equation or "").strip()

        # 1. Syntax Validity Score
        syntax_score = 0.0
        # Check standard Python AST parsing
        try:
            ast.parse(eq, mode="eval")
            syntax_score += 50.0
        except Exception:
            pass

        # Check PixMath sandbox policy validation
        try:
            from pixmath_core.sandbox import validate

            validate(eq)
            syntax_score += 50.0
        except Exception:
            pass

        # 2. Blend OCR Provider Confidence with Syntax Verification
        overall = round(0.60 * raw_confidence + 0.40 * syntax_score, 1)
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
            # Flag suspicious fragments
            if "??" in eq or "error" in eq.lower():
                uncertain_tokens.append(
                    UncertainToken(
                        token="??",
                        position=(0, len(eq)),
                        confidence=round(overall, 1),
                        reason="Unresolved OCR token or syntax irregularity",
                    )
                )

        warning_message: str | None = None
        if not is_reliable:
            warning_message = (
                f"Confidence is {overall}% (< 80%). Some mathematical symbols or exponents may need "
                "manual verification. We recommend opening 'Edit in Forward Mode' to verify the formula."
            )

        return ConfidenceReport(
            overall_score=overall,
            grade=grade,
            is_reliable=is_reliable,
            symbol_certainty=raw_confidence,
            syntax_validity=syntax_score,
            uncertain_tokens=uncertain_tokens,
            warning_message=warning_message,
        )
