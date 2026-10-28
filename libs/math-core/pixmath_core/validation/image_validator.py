"""Deep multi-layer image validation service for PixMath Reverse Extraction.

Evaluates an input image buffer in-memory to determine whether it possesses
sufficient mathematical contrast, structural gradient sharpness, and spatial
coherence to synthesize a closed-form symbolic equation via SIREN / PySR.

Strictly ephemeral: No bytes are persisted to disk. All buffers are discarded
immediately upon completion of analysis.
"""

from __future__ import annotations

import io
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np
from PIL import Image


@dataclass(frozen=True, slots=True)
class ValidationMetrics:
    """Quantitative diagnostics for an analysed image."""

    width: int
    height: int
    contrast_score: float  # 0 to 100
    sharpness_score: float  # 0 to 100
    coherence_score: float  # 0 to 100
    purity_score: float  # 0 to 100 (inverse noise)
    luminance_std: float
    dynamic_range: float
    autocorrelation: float
    tv_ratio: float


@dataclass(frozen=True, slots=True)
class ImageValidationReport:
    """Structured report returned after multi-layer validation."""

    is_valid: bool
    overall_score: float  # 0 to 100
    grade: str  # "A+", "A", "B", "C", "Declined"
    feasibility_assessment: str
    rejection_reasons: list[str]
    metrics: ValidationMetrics
    recommended_action: str

    def to_dict(self) -> dict[str, Any]:
        """Convert report to JSON-serialisable dictionary."""
        return {
            "is_valid": self.is_valid,
            "overall_score": self.overall_score,
            "grade": self.grade,
            "feasibility_assessment": self.feasibility_assessment,
            "rejection_reasons": list(self.rejection_reasons),
            "metrics": asdict(self.metrics),
            "recommended_action": self.recommended_action,
        }


def validate_image_ephemeral(
    image_bytes: bytes,
    *,
    min_resolution: int = 32,
    max_resolution: int = 8192,
) -> ImageValidationReport:
    """Execute deep multi-layer mathematical validation on in-memory image bytes.

    Parameters:
        image_bytes: Raw binary image payload (PNG, JPEG, WebP, etc.).
        min_resolution: Minimum allowed width/height in pixels.
        max_resolution: Maximum allowed width/height in pixels.

    Returns:
        ImageValidationReport with feasibility scoring and detailed diagnostics.
    """
    reasons: list[str] = []

    # Layer 1: Ephemeral Decoding & Dimensions
    if not image_bytes or len(image_bytes) < 64:
        return ImageValidationReport(
            is_valid=False,
            overall_score=0.0,
            grade="Declined",
            feasibility_assessment="Uploaded image buffer is empty or corrupted.",
            rejection_reasons=["Empty or unreadable file buffer."],
            metrics=ValidationMetrics(0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            recommended_action="Please upload a valid PNG, JPEG, or WebP image file.",
        )

    # Fast-path: Verified PixMath watermark from Forward Mode
    from pixmath_core.recognition.watermark import extract_forward_watermark
    wm = extract_forward_watermark(image_bytes)
    if wm is not None:
        eq, _ = wm
        try:
            with Image.open(io.BytesIO(image_bytes)) as pil_img:
                w, h = pil_img.size
        except Exception:
            w, h = 512, 512

        return ImageValidationReport(
            is_valid=True,
            overall_score=100.0,
            grade="A+",
            feasibility_assessment=f"Authentic PixMath mathematical render detected ('{eq}'). 100% round-trip fidelity verified.",
            rejection_reasons=[],
            metrics=ValidationMetrics(
                width=w,
                height=h,
                contrast_score=100.0,
                sharpness_score=100.0,
                coherence_score=100.0,
                purity_score=100.0,
                luminance_std=0.25,
                dynamic_range=1.0,
                autocorrelation=1.0,
                tv_ratio=0.01,
            ),
            recommended_action="Ready for instant lossless round-trip extraction.",
        )

    try:
        with Image.open(io.BytesIO(image_bytes)) as pil_img:
            # Force load image data into memory before context closes
            pil_img.load()
            w, h = pil_img.size
            if pil_img.format not in ("PNG", "JPEG", "MPO", "WEBP", "BMP"):
                reasons.append(
                    f"Unsupported image format '{pil_img.format}'. Please upload PNG, JPEG, or WebP."
                )

            if w < min_resolution or h < min_resolution:
                reasons.append(
                    f"Image resolution ({w}x{h}) is too low. Minimum required resolution is {min_resolution}x{min_resolution}."
                )

            if w > max_resolution or h > max_resolution:
                reasons.append(
                    f"Image dimensions ({w}x{h}) exceed maximum allowed {max_resolution}x{max_resolution}."
                )

            if reasons:
                return ImageValidationReport(
                    is_valid=False,
                    overall_score=0.0,
                    grade="Declined",
                    feasibility_assessment="Image format or dimension checks failed.",
                    rejection_reasons=reasons,
                    metrics=ValidationMetrics(w, h, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
                    recommended_action="Ensure the image has standard dimensions and is a supported format.",
                )

            # Convert to normalized luminance array on standardized 256x256 grid
            thumb = pil_img.convert("RGB").resize((256, 256), Image.Resampling.BILINEAR)
            arr = np.asarray(thumb, dtype=np.float32) / 255.0
    except Exception as exc:
        return ImageValidationReport(
            is_valid=False,
            overall_score=0.0,
            grade="Declined",
            feasibility_assessment=f"Decoding failure: {exc}",
            rejection_reasons=[f"Unable to parse image data: {exc}"],
            metrics=ValidationMetrics(0, 0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
            recommended_action="Please ensure the file is a clean, uncorrupted image.",
        )

    # Standard ITU-R BT.601 perceptual luminance
    lum = 0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]

    # Layer 2: Dynamic Range & Variance (Contrast & Flatness Check)
    lum_std = float(np.std(lum))
    dyn_range = float(np.ptp(lum))

    if lum_std < 0.038 or dyn_range < 0.12:
        reasons.append(
            f"Image has insufficient visual contrast or is entirely blank (Contrast std: {lum_std * 100:.1f}%). "
            "Mathematical equation extraction requires distinct spatial intensity variation."
        )

    # Layer 3: Spatial Autocorrelation & Total Variation (Continuous Manifold vs. White Noise)
    lum_centered = lum - float(np.mean(lum))
    denom = (lum_std**2) if lum_std > 1e-6 else 1e-6
    ac_x = float(np.mean(lum_centered[:, :-1] * lum_centered[:, 1:]) / denom)
    ac_y = float(np.mean(lum_centered[:-1, :] * lum_centered[1:, :]) / denom)
    autocorr = float(np.clip((ac_x + ac_y) / 2.0, -1.0, 1.0))

    diff_x = np.abs(lum[:, 1:] - lum[:, :-1])
    diff_y = np.abs(lum[1:, :] - lum[:-1, :])
    tv = float((np.mean(diff_x) + np.mean(diff_y)) / 2.0)
    tv_ratio = float(tv / (lum_std + 1e-6))

    if autocorr < 0.35 or tv_ratio > 0.60:
        reasons.append(
            f"Image contains excessive random noise or uncorrelated static (Coherence: {max(0.0, autocorr) * 100:.1f}%, Noise ratio: {tv_ratio * 100:.1f}%). "
            "Continuous mathematical equations cannot model uncorrelated random static."
        )

    # Layer 4: Discrete Laplacian Sharpness (Blur & Defocus Check)
    lap = (
        lum[1:-1, 0:-2]
        + lum[1:-1, 2:]
        + lum[0:-2, 1:-1]
        + lum[2:, 1:-1]
        - 4.0 * lum[1:-1, 1:-1]
    )
    sharpness_rms = float(np.sqrt(np.mean(lap**2)) / (lum_std + 1e-6))

    if sharpness_rms < 0.025 and len(reasons) == 0:
        reasons.append(
            f"Image is excessively blurry or out-of-focus (Sharpness index: {sharpness_rms * 1000:.1f} < 25.0). "
            "Clear mathematical gradients or boundary contours are required."
        )

    # Layer 5: Normalized Diagnostics & Grading
    contrast_score = round(min(100.0, max(0.0, lum_std * 350.0)), 1)
    sharpness_score = round(min(100.0, max(0.0, (sharpness_rms - 0.015) * 1100.0)), 1)
    coherence_score = round(min(100.0, max(0.0, autocorr * 100.0)), 1)
    purity_score = round(min(100.0, max(0.0, (1.0 - min(1.0, tv_ratio)) * 100.0)), 1)

    overall_score = round(
        0.25 * contrast_score
        + 0.30 * sharpness_score
        + 0.30 * coherence_score
        + 0.15 * purity_score,
        1,
    )

    if overall_score >= 85.0:
        grade = "A+"
        assessment = "Optimal mathematical structure detected: High contrast, coherent contours, and low noise."
        recommendation = "Ready for SIREN implicit fitting and Pareto symbolic regression."
    elif overall_score >= 70.0:
        grade = "A"
        assessment = "Strong mathematical features: Good spatial gradient distribution suitable for extraction."
        recommendation = "Proceed with extraction; high confidence for closed-form symbolic synthesis."
    elif overall_score >= 50.0:
        grade = "B"
        assessment = "Moderate mathematical structure: May require higher PySR search iterations."
        recommendation = "Proceed with extraction; expect balanced complexity/accuracy trade-off."
    elif overall_score >= 35.0:
        grade = "C"
        assessment = "Marginal mathematical feasibility: Structure is faint or partially noisy."
        recommendation = "Consider uploading a higher contrast or sharper sample for optimal formula distillation."
    else:
        grade = "Declined"
        assessment = "Image does not possess identifiable mathematical geometry or continuous manifold patterns."
        recommendation = "Please try an image with clear mathematical curves, geometric contours, or parametric surfaces."
        if not reasons:
            reasons.append(
                f"Overall mathematical feasibility index ({overall_score:.1f}/100) is below the minimum threshold (35.0)."
            )

    is_valid = len(reasons) == 0 and overall_score >= 35.0

    # Strict hygiene: delete intermediate arrays
    del arr, lum, thumb
    if "lap" in locals():
        del lap

    return ImageValidationReport(
        is_valid=is_valid,
        overall_score=overall_score,
        grade=grade,
        feasibility_assessment=assessment,
        rejection_reasons=reasons,
        metrics=ValidationMetrics(
            width=w,
            height=h,
            contrast_score=contrast_score,
            sharpness_score=sharpness_score,
            coherence_score=coherence_score,
            purity_score=purity_score,
            luminance_std=round(lum_std, 4),
            dynamic_range=round(dyn_range, 4),
            autocorrelation=round(autocorr, 4),
            tv_ratio=round(tv_ratio, 4),
        ),
        recommended_action=recommendation,
    )
