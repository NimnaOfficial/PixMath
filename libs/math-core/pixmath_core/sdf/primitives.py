"""
2D Signed Distance Function (SDF) primitives.

All functions operate on numpy arrays and return signed distance values:
    negative = inside the shape
    zero     = on the boundary
    positive = outside the shape
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray


def sd_circle(
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    cx: float = 0.0,
    cy: float = 0.0,
    r: float = 1.0,
) -> NDArray[np.float64]:
    """Signed distance to a circle centered at (cx, cy) with radius r."""
    return np.sqrt((x - cx) ** 2 + (y - cy) ** 2) - r


def sd_box(
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    cx: float = 0.0,
    cy: float = 0.0,
    half_w: float = 1.0,
    half_h: float = 1.0,
) -> NDArray[np.float64]:
    """Signed distance to an axis-aligned box centered at (cx, cy)."""
    dx = np.abs(x - cx) - half_w
    dy = np.abs(y - cy) - half_h
    outside = np.sqrt(np.maximum(dx, 0.0) ** 2 + np.maximum(dy, 0.0) ** 2)
    inside = np.minimum(np.maximum(dx, dy), 0.0)
    return outside + inside


def sd_torus(
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    cx: float = 0.0,
    cy: float = 0.0,
    r_major: float = 1.0,
    r_minor: float = 0.3,
) -> NDArray[np.float64]:
    """Signed distance to a 2D torus (annulus) centered at (cx, cy)."""
    dist_to_center = np.sqrt((x - cx) ** 2 + (y - cy) ** 2)
    return np.abs(dist_to_center - r_major) - r_minor


def smooth_min(
    d1: NDArray[np.float64],
    d2: NDArray[np.float64],
    k: float = 0.1,
) -> NDArray[np.float64]:
    """Polynomial smooth minimum (smooth union of two SDF fields)."""
    h = np.clip(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0)
    return d2 * (1.0 - h) + d1 * h - k * h * (1.0 - h)


def smooth_subtract(
    d1: NDArray[np.float64],
    d2: NDArray[np.float64],
    k: float = 0.1,
) -> NDArray[np.float64]:
    """Smooth subtraction: d1 minus d2."""
    return -smooth_min(-d1, d2, k)


def smooth_intersect(
    d1: NDArray[np.float64],
    d2: NDArray[np.float64],
    k: float = 0.1,
) -> NDArray[np.float64]:
    """Smooth intersection of two SDF fields."""
    return -smooth_min(-d1, -d2, k)
