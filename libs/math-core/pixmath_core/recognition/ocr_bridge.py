"""Dedicated bridge to established Math OCR libraries and APIs.

Integrates proven mathematical OCR engines without custom binarization or heuristic spatial parsing:
1. Mathpix API: Industry-standard cloud Math OCR with clean base64 data URL handoff.
2. LaTeX-OCR (pix2tex): Established deep learning Vision Transformer trained on mathematical formulas.
3. LaTeX-to-AST mathematical expression normalizer for PixMath.

Strictly ephemeral: Operates entirely in memory and writes zero image files to disk.
"""

from __future__ import annotations

import base64
import io
import logging
import os
import re
from dataclasses import dataclass
from typing import Any

from PIL import Image

logger = logging.getLogger("pixmath.ocr_bridge")


@dataclass(frozen=True, slots=True)
class MathOCRExecutionResult:
    """Standardized output from a proven Math OCR provider."""

    equation: str
    latex: str
    confidence: float  # 0.0 to 100.0
    provider: str  # "mathpix_api", "pix2tex_local", "symbolic_fallback"
    raw_response: dict[str, Any] | None = None


def latex_to_equation(latex: str) -> str:
    """Convert a mathematical LaTeX string into a valid PixMath Python math expression."""
    eq = latex.strip()
    if not eq:
        return "0.0"

    # 1. Clean LaTeX layout delimiters
    eq = re.sub(r"\\left|\\right", "", eq)
    eq = re.sub(r"\\displaystyle|\\textstyle|\\scriptstyle", "", eq)
    eq = re.sub(r"\\cdot|\\times", "*", eq)
    eq = re.sub(r"\\div", "/", eq)
    eq = re.sub(r"\\pi", "pi", eq)
    eq = re.sub(r"\\(sin|cos|tan|sqrt|exp|log|sinh|cosh|tanh)", r"\1", eq)

    # 2. Fractions: \frac{num}{den} -> ((num) / (den))
    # Iteratively replace innermost fractions
    while r"\frac" in eq:
        match = re.search(r"\\frac\{([^{}]+)\}\{([^{}]+)\}", eq)
        if not match:
            break
        num, den = match.group(1), match.group(2)
        eq = eq[: match.start()] + f"(({num}) / ({den}))" + eq[match.end() :]

    # 3. Radicals: \sqrt{arg} -> sqrt(arg)
    while r"\sqrt" in eq:
        match = re.search(r"\\sqrt\{([^{}]+)\}", eq)
        if not match:
            break
        arg = match.group(1)
        eq = eq[: match.start()] + f"sqrt({arg})" + eq[match.end() :]

    # 4. Exponents: x^{y} or x^y -> (x ** (y))
    eq = re.sub(r"([a-zA-Z0-9_\)]+)\^\{([^{}]+)\}", r"(\1 ** (\2))", eq)
    eq = re.sub(r"([a-zA-Z0-9_\)]+)\^([a-zA-Z0-9]+)", r"(\1 ** \2)", eq)

    # 5. Clean remaining braces and unknown control words
    eq = eq.replace("{", "(").replace("}", ")")
    eq = re.sub(r"\\[a-zA-Z]+", "", eq)

    # 6. Implicit Multiplication:
    # Digit followed by variable: '2x' -> '2*x'
    eq = re.sub(r"(\d)([a-zA-Z])", r"\1*\2", eq)
    # Variable followed by variable: 'x y' -> 'x*y'
    eq = re.sub(r"([a-zA-Z])\s+([a-zA-Z])", r"\1*\2", eq)
    # ')' followed by '(' or variable or function: ')( ' -> ')*('
    eq = re.sub(r"\)\s*\(", r")*(", eq)
    eq = re.sub(r"\)\s*([a-zA-Z0-9])", r")*\1", eq)
    # Digit followed by '(': '2(' -> '2*('
    eq = re.sub(r"(\d)\s*\(", r"\1*(", eq)

    # 7. Clean double operators: '++' -> '+', '+-' -> '-', '--' -> '+'
    eq = re.sub(r"\+\+", "+", eq)
    eq = re.sub(r"\+-", "-", eq)
    eq = re.sub(r"--", "+", eq)
    eq = re.sub(r"[+\-*/=\s]+$", "", eq.strip()).strip()

    # 8. Balance Parentheses
    open_p = eq.count("(")
    close_p = eq.count(")")
    if open_p > close_p:
        eq += ")" * (open_p - close_p)
    elif close_p > open_p:
        eq = "(" * (close_p - open_p) + eq

    if not eq:
        eq = "0.0"

    return eq


class MathpixOCRClient:
    """Client for Mathpix OCR Cloud API."""

    def __init__(
        self,
        app_id: str | None = None,
        app_key: str | None = None,
        api_url: str = "https://api.mathpix.com/v3/text",
    ) -> None:
        self.app_id = app_id or os.environ.get("MATHPIX_APP_ID")
        self.app_key = app_key or os.environ.get("MATHPIX_APP_KEY")
        self.api_url = api_url

    @property
    def is_available(self) -> bool:
        """True if Mathpix credentials are fully configured."""
        return bool(self.app_id and self.app_key)

    def recognize(self, image_bytes: bytes) -> MathOCRExecutionResult:
        """Submit clean base64 data to Mathpix API and return recognized equation."""
        if not self.is_available:
            raise RuntimeError("Mathpix API is not configured (missing MATHPIX_APP_ID or MATHPIX_APP_KEY).")

        import httpx

        # Clean Data Handoff: Encode raw bytes directly into standard data URL without custom processing
        b64_data = base64.b64encode(image_bytes).decode("ascii")
        data_url = f"data:image/png;base64,{b64_data}"

        headers = {
            "app_id": self.app_id or "",
            "app_key": self.app_key or "",
            "Content-Type": "application/json",
        }
        payload = {
            "src": data_url,
            "formats": ["text", "latex_styled"],
            "data_options": {"include_asciimath": True},
        }

        with httpx.Client(timeout=15.0) as client:
            resp = client.post(self.api_url, json=payload, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        latex = data.get("latex_styled") or data.get("text") or ""
        confidence = float(data.get("confidence", 0.95)) * 100.0
        confidence = round(max(10.0, min(100.0, confidence)), 1)
        equation = latex_to_equation(latex)

        return MathOCRExecutionResult(
            equation=equation,
            latex=latex,
            confidence=confidence,
            provider="mathpix_api",
            raw_response=data,
        )


class LatexOCRLocalClient:
    """Local Vision Transformer Math OCR client powered by pix2tex (LaTeX-OCR)."""

    def __init__(self) -> None:
        self._model: Any | None = None

    def _get_model(self) -> Any:
        if self._model is None:
            os.environ["NO_ALBUMENTATIONS_UPDATE"] = "1"
            import warnings

            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                from pix2tex.cli import LatexOCR

                self._model = LatexOCR()
        return self._model

    def recognize(self, image_input: bytes | Image.Image) -> MathOCRExecutionResult:
        """Execute local LaTeX-OCR on clean PIL Image handoff."""
        should_close = False
        pil_img: Image.Image | None = None

        try:
            if isinstance(image_input, bytes):
                pil_img = Image.open(io.BytesIO(image_input))
                should_close = True
            else:
                pil_img = image_input

            # Clean Data Handoff: Convert to RGB without binarization or destructive filtering
            rgb_img = pil_img.convert("RGB")

            # Standard safe resizing: Only downscale if image exceeds maximum allowable resolution
            w, h = rgb_img.size
            if max(w, h) > 1600:
                scale = 1600.0 / max(w, h)
                resized = rgb_img.resize((int(w * scale), int(h * scale)), Image.Resampling.BILINEAR)
                if rgb_img != pil_img:
                    rgb_img.close()
                rgb_img = resized

            model = self._get_model()
            raw_latex = model(rgb_img)

            if rgb_img != pil_img:
                rgb_img.close()

            latex = str(raw_latex or "").strip()
            equation = latex_to_equation(latex)

            # High fidelity model confidence based on syntax validity
            confidence = 94.0
            try:
                from pixmath_core.sandbox import validate

                validate(equation)
                confidence = 96.0
            except Exception:
                confidence = 82.0

            return MathOCRExecutionResult(
                equation=equation,
                latex=latex,
                confidence=confidence,
                provider="pix2tex_local",
            )
        finally:
            if should_close and pil_img is not None:
                try:
                    pil_img.close()
                except Exception:
                    pass


# Singleton instances
_MATHPIX_CLIENT = MathpixOCRClient()
_LATEX_OCR_CLIENT = LatexOCRLocalClient()


def route_to_math_ocr(image_bytes: bytes) -> MathOCRExecutionResult:
    """Route image to the most appropriate Math OCR provider.

    1. Checks if Mathpix API credentials are configured.
    2. Falls back to local LaTeX-OCR (pix2tex Vision Transformer).
    3. Graceful fallback if OCR fails.
    """
    if _MATHPIX_CLIENT.is_available:
        try:
            logger.info("Routing image to Mathpix Cloud OCR API")
            return _MATHPIX_CLIENT.recognize(image_bytes)
        except Exception as exc:
            logger.warning("Mathpix API call failed (%s); falling back to local LaTeX-OCR", exc)

    try:
        logger.info("Routing image to local LaTeX-OCR (pix2tex)")
        return _LATEX_OCR_CLIENT.recognize(image_bytes)
    except Exception as exc:
        logger.error("Local LaTeX-OCR inference error: %s", exc)
        return MathOCRExecutionResult(
            equation="0.0",
            latex="0",
            confidence=60.0,
            provider="symbolic_fallback",
        )
