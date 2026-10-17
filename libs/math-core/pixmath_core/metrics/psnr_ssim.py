"""
Image quality metrics for comparing rendered output vs. target images.

Metrics:
    psnr    Peak Signal-to-Noise Ratio (dB)
    ssim    Structural Similarity Index (simplified)
    dssim   Structural Dissimilarity (loss-friendly: 0 = identical, 1 = maximally different)
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray


def psnr(
    img_a: NDArray[np.float64],
    img_b: NDArray[np.float64],
    max_val: float = 1.0,
) -> float:
    """
    Peak Signal-to-Noise Ratio between two images.

    Args:
        img_a: Reference image, float values in [0, max_val].
        img_b: Distorted image, same shape as img_a.
        max_val: Maximum pixel value (1.0 for normalized, 255.0 for uint8).

    Returns:
        PSNR in decibels. Higher is better. Returns inf if images are identical.
    """
    mse = np.mean((img_a.astype(np.float64) - img_b.astype(np.float64)) ** 2)
    if mse == 0:
        return float("inf")
    return float(10.0 * np.log10((max_val**2) / mse))


def _gaussian_kernel_1d(size: int, sigma: float) -> NDArray[np.float64]:
    """Create a 1D Gaussian kernel."""
    coords = np.arange(size, dtype=np.float64) - (size - 1) / 2.0
    kernel = np.exp(-(coords**2) / (2 * sigma**2))
    return kernel / kernel.sum()


def _apply_gaussian(
    img: NDArray[np.float64],
    kernel_size: int = 11,
    sigma: float = 1.5,
) -> NDArray[np.float64]:
    """Apply separable Gaussian blur (numpy-only, no scipy dependency)."""
    kernel = _gaussian_kernel_1d(kernel_size, sigma)
    pad = kernel_size // 2

    # Pad and convolve along rows then columns
    padded = np.pad(img, pad, mode="reflect")
    # Row convolution
    result = np.zeros_like(padded)
    for k in range(kernel_size):
        result[:, pad : padded.shape[1] - pad] += (
            kernel[k] * padded[:, k : padded.shape[1] - kernel_size + k + 1]
        )
    # Column convolution
    temp = result[pad:-pad, :]
    padded2 = np.pad(temp, ((pad, pad), (0, 0)), mode="reflect")
    result2 = np.zeros_like(padded2)
    for k in range(kernel_size):
        result2[pad : padded2.shape[0] - pad, :] += (
            kernel[k] * padded2[k : padded2.shape[0] - kernel_size + k + 1, :]
        )
    return result2[pad:-pad, :]


def ssim(
    img_a: NDArray[np.float64],
    img_b: NDArray[np.float64],
    max_val: float = 1.0,
    kernel_size: int = 11,
    sigma: float = 1.5,
    k1: float = 0.01,
    k2: float = 0.03,
) -> float:
    """
    Structural Similarity Index (simplified, per-channel mean).

    Returns a value in [-1, 1] where 1 = identical.
    """
    c1 = (k1 * max_val) ** 2
    c2 = (k2 * max_val) ** 2

    a = img_a.astype(np.float64)
    b = img_b.astype(np.float64)

    # If multi-channel, compute per-channel and average
    if a.ndim == 3:
        scores = []
        for ch in range(a.shape[2]):
            scores.append(
                ssim(a[:, :, ch], b[:, :, ch], max_val, kernel_size, sigma, k1, k2)
            )
        return float(np.mean(scores))

    mu_a = _apply_gaussian(a, kernel_size, sigma)
    mu_b = _apply_gaussian(b, kernel_size, sigma)

    mu_a_sq = mu_a * mu_a
    mu_b_sq = mu_b * mu_b
    mu_ab = mu_a * mu_b

    sigma_a_sq = _apply_gaussian(a * a, kernel_size, sigma) - mu_a_sq
    sigma_b_sq = _apply_gaussian(b * b, kernel_size, sigma) - mu_b_sq
    sigma_ab = _apply_gaussian(a * b, kernel_size, sigma) - mu_ab

    numerator = (2 * mu_ab + c1) * (2 * sigma_ab + c2)
    denominator = (mu_a_sq + mu_b_sq + c1) * (sigma_a_sq + sigma_b_sq + c2)

    ssim_map = numerator / denominator
    return float(np.mean(ssim_map))


def dssim(
    img_a: NDArray[np.float64],
    img_b: NDArray[np.float64],
    max_val: float = 1.0,
) -> float:
    """
    Structural Dissimilarity (loss-friendly).

    D-SSIM = (1 - SSIM) / 2, range [0, 1] where 0 = identical.
    Used as the perceptual component of the reverse engine's composite loss.
    """
    return (1.0 - ssim(img_a, img_b, max_val)) / 2.0
