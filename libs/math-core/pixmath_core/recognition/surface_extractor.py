"""Computer Vision 2D Plot Surface Extractor for PixMath.

Analyzes 2D mathematical scalar fields/color plots ephemerally:
1. Detects Cartesian grid lines and coordinate axes to establish origin (0, 0) and scale.
2. Samples image pixels into continuous (x, y) coordinates.
3. Inverts color/luminance to Z-values (orange = peak +1, black = trough -1, cyan/green = zero).
4. Strictly ephemeral: All buffers exist in-memory with zero disk persistence.
"""

from __future__ import annotations

import io
from dataclasses import dataclass
from typing import Any

import numpy as np
from PIL import Image


@dataclass(frozen=True, slots=True)
class CartesianGridInfo:
    """Detected Cartesian coordinate grid and scale metadata."""

    has_grid: bool
    origin_x: float  # Pixel coordinate of x = 0.0
    origin_y: float  # Pixel coordinate of y = 0.0
    scale_x: float  # Pixels per 1.0 coordinate unit
    scale_y: float  # Pixels per 1.0 coordinate unit
    domain_x: tuple[float, float]  # (min_x, max_x)
    domain_y: tuple[float, float]  # (min_y, max_y)
    grid_spacing: float | None  # Detected grid line step in pixels

    def to_dict(self) -> dict[str, Any]:
        return {
            "has_grid": self.has_grid,
            "origin_x": round(self.origin_x, 1),
            "origin_y": round(self.origin_y, 1),
            "scale_x": round(self.scale_x, 2),
            "scale_y": round(self.scale_y, 2),
            "domain_x": [round(v, 3) for v in self.domain_x],
            "domain_y": [round(v, 3) for v in self.domain_y],
            "grid_spacing": round(self.grid_spacing, 1) if self.grid_spacing else None,
        }


@dataclass(frozen=True, slots=True)
class ExtractedSurfaceData:
    """Continuous coordinate surface points extracted from an image."""

    coords: np.ndarray  # Shape (N, 2), columns are [x, y] in continuous domain
    z_values: np.ndarray  # Shape (N,), continuous values in [-1.0, 1.0]
    z_grid: np.ndarray  # Shape (res, res), 2D matrix of continuous z values
    x_lin: np.ndarray  # 1D array of x coordinates for z_grid
    y_lin: np.ndarray  # 1D array of y coordinates for z_grid
    grid_info: CartesianGridInfo
    width: int
    height: int


# Precomputed PixMath Palette LUT for color inversion
def _build_pixmath_lut(steps: int = 512) -> tuple[np.ndarray, np.ndarray]:
    """Generate PixMath forward shader color ramp lookup table."""
    def _smoothstep(e0: float, e1: float, val: np.ndarray) -> np.ndarray:
        t = np.clip((val - e0) / (e1 - e0), 0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)

    elevations = np.linspace(0.0, 1.0, steps, dtype=np.float32)
    void_col = np.array([0.02, 0.03, 0.05], dtype=np.float32)
    cyan_col = np.array([0.02, 0.71, 0.83], dtype=np.float32)
    emerald_col = np.array([0.06, 0.72, 0.51], dtype=np.float32)
    amber_col = np.array([0.96, 0.62, 0.04], dtype=np.float32)

    col = void_col + (cyan_col - void_col) * _smoothstep(0.1, 0.5, elevations)[:, None]
    col = col + (emerald_col - col) * _smoothstep(0.5, 0.8, elevations)[:, None]
    col = col + (amber_col - col) * _smoothstep(0.8, 0.98, elevations)[:, None]
    return np.clip(col, 0.0, 1.0), elevations


_LUT_RGB, _LUT_ELEV = _build_pixmath_lut(512)


def map_color_to_z(rgb: np.ndarray) -> np.ndarray:
    """Map RGB pixel values to mathematical scalar elevation Z in [-1.0, 1.0].

    Parameters:
        rgb: Array of shape (..., 3) with channel values in [0.0, 1.0].

    Returns:
        Array of shape (...) with continuous Z values in [-1.0, 1.0].
        - Orange / Amber / White: positive peak (+1.0)
        - Cyan / Green / Mid-gray: zero level (0.0)
        - Void / Navy / Black: negative trough (-1.0)
    """
    orig_shape = rgb.shape[:-1]
    flat_rgb = rgb.reshape(-1, 3).astype(np.float32)

    r = flat_rgb[:, 0]
    g = flat_rgb[:, 1]
    b = flat_rgb[:, 2]
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    warmth = r - b  # Strongly positive for orange/amber, negative for cyan/void

    # 1. Palette distance matching against PixMath forward shader colors
    # Chunked nearest-neighbor to stay within minimal memory budget
    chunk_size = 8192
    lut_elevs = np.zeros(len(flat_rgb), dtype=np.float32)

    for i in range(0, len(flat_rgb), chunk_size):
        chunk = flat_rgb[i : i + chunk_size]
        diffs = chunk[:, None, :] - _LUT_RGB[None, :, :]
        dists_sq = np.sum(diffs * diffs, axis=-1)
        best_idx = np.argmin(dists_sq, axis=1)
        min_dists = np.min(dists_sq, axis=1)
        # If closest palette color is very close (< 0.03), use direct palette elevation
        # Otherwise blend with luminance/warmth formula
        is_palette = min_dists < 0.04
        direct_elev = _LUT_ELEV[best_idx]
        lut_elevs[i : i + chunk_size] = np.where(is_palette, direct_elev, -1.0)

    # 2. General color / luminance projection fallback
    # Maps arbitrary heatmaps, grayscale, and plots smoothly
    general_z = np.where(
        warmth > 0.25,
        0.5 + 0.5 * np.clip(warmth / 0.8, 0.0, 1.0),  # Orange/amber peak
        np.where(
            lum < 0.1,
            -1.0 + (lum / 0.1) * 0.3,  # Dark void trough
            # Cyan / green / neutral transition
            np.clip((lum - 0.45) * 1.4 + warmth * 0.35, -0.6, 0.6),
        ),
    )

    # Combine palette inversion with general projection
    has_lut = lut_elevs >= 0.0
    # Map palette elevation to Z [-1, 1] with cyan/green centered near zero
    lut_z = np.where(
        lut_elevs < 0.5,
        -1.0 + (lut_elevs / 0.5) * 1.0,  # 0.0..0.5 -> -1.0..0.0 (black -> cyan)
        np.where(
            lut_elevs < 0.82,
            (lut_elevs - 0.5) / 0.32 * 0.25,  # 0.5..0.82 -> 0.0..0.25 (cyan/green near zero)
            0.25 + ((lut_elevs - 0.82) / 0.18) * 0.75,  # 0.82..1.0 -> 0.25..1.0 (orange peak)
        ),
    )
    final_z = np.where(has_lut, lut_z, general_z)

    # Grayscale / monochromatic safety fallback
    color_spread = np.max(flat_rgb, axis=-1) - np.min(flat_rgb, axis=-1)
    is_grayscale = color_spread < 0.05
    grayscale_z = lum * 2.0 - 1.0
    final_z = np.where(is_grayscale, grayscale_z, final_z)

    return np.clip(final_z, -1.0, 1.0).reshape(orig_shape)


def detect_cartesian_grid(img_gray: np.ndarray) -> CartesianGridInfo:
    """Detect Cartesian grid lines and coordinate axes in a 2D plot.

    Parameters:
        img_gray: Grayscale 2D array of shape (height, width) with values in [0.0, 1.0].

    Returns:
        CartesianGridInfo indicating presence of grid, origin, and scale.
    """
    h, w = img_gray.shape
    center_x = w / 2.0
    center_y = h / 2.0

    # Gradient profile across rows and columns to find linear grid lines
    diff_y = np.abs(img_gray[1:, :] - img_gray[:-1, :]).mean(axis=1)  # (H-1,)
    diff_x = np.abs(img_gray[:, 1:] - img_gray[:, :-1]).mean(axis=0)  # (W-1,)

    mean_dy = float(np.mean(diff_y))
    std_dy = float(np.std(diff_y))
    mean_dx = float(np.mean(diff_x))
    std_dx = float(np.std(diff_x))

    # Peaks exceeding threshold indicate grid lines
    thresh_y = mean_dy + 2.0 * std_dy
    thresh_x = mean_dx + 2.0 * std_dx

    y_peaks = np.where(diff_y > thresh_y)[0]
    x_peaks = np.where(diff_x > thresh_x)[0]

    # Check for consistent grid line spacing
    spacing_x: float | None = None
    spacing_y: float | None = None

    if len(x_peaks) >= 3:
        deltas = np.diff(x_peaks)
        median_delta = float(np.median(deltas))
        if median_delta > 10.0 and np.std(deltas) < median_delta * 0.35:
            spacing_x = median_delta

    if len(y_peaks) >= 3:
        deltas = np.diff(y_peaks)
        median_delta = float(np.median(deltas))
        if median_delta > 10.0 and np.std(deltas) < median_delta * 0.35:
            spacing_y = median_delta

    has_grid = (spacing_x is not None) or (spacing_y is not None)

    # Origin detection: find primary axis closest to center
    if len(x_peaks) > 0:
        closest_x_idx = int(np.argmin(np.abs(x_peaks - center_x)))
        origin_x = float(x_peaks[closest_x_idx])
    else:
        origin_x = center_x

    if len(y_peaks) > 0:
        closest_y_idx = int(np.argmin(np.abs(y_peaks - center_y)))
        origin_y = float(y_peaks[closest_y_idx])
    else:
        origin_y = center_y

    # Calculate scale (pixels per unit)
    # Default scale maps [-1.0, 1.0] across the canvas half-dimension
    default_scale_x = w / 2.0
    default_scale_y = h / 2.0

    scale_x = spacing_x if spacing_x is not None else default_scale_x
    scale_y = spacing_y if spacing_y is not None else default_scale_y

    # Compute domain bounds
    min_x = (0.0 - origin_x) / scale_x
    max_x = (w - origin_x) / scale_x
    # Math coordinate convention: top is positive Y, bottom is negative Y
    max_y = (origin_y - 0.0) / scale_y
    min_y = (origin_y - h) / scale_y

    return CartesianGridInfo(
        has_grid=has_grid,
        origin_x=origin_x,
        origin_y=origin_y,
        scale_x=scale_x,
        scale_y=scale_y,
        domain_x=(min_x, max_x),
        domain_y=(min_y, max_y),
        grid_spacing=spacing_x or spacing_y,
    )


def extract_surface_points(
    image_input: bytes | Image.Image,
    sample_resolution: int = 48,
) -> ExtractedSurfaceData:
    """Ephemerally extract (x, y, z) surface data points from an image.

    Parameters:
        image_input: Raw binary bytes or PIL Image object.
        sample_resolution: Side length of the square sampling grid (e.g. 48 -> 2304 points).

    Returns:
        ExtractedSurfaceData containing coordinate matrix and elevation values.
    """
    if isinstance(image_input, bytes):
        pil_img = Image.open(io.BytesIO(image_input)).convert("RGB")
    else:
        pil_img = image_input.convert("RGB")

    w, h = pil_img.size

    # Convert to normalized float array
    rgb_full = np.asarray(pil_img, dtype=np.float32) / 255.0
    gray_full = 0.299 * rgb_full[:, :, 0] + 0.587 * rgb_full[:, :, 1] + 0.114 * rgb_full[:, :, 2]

    # Detect Cartesian grid
    grid_info = detect_cartesian_grid(gray_full)

    # Subsample uniform grid for fast regression
    res = max(16, min(128, sample_resolution))
    img_sampled = pil_img.resize((res, res), Image.Resampling.BILINEAR)
    rgb_sampled = np.asarray(img_sampled, dtype=np.float32) / 255.0

    # Invert color to continuous Z elevation
    z_grid = map_color_to_z(rgb_sampled)  # Shape (res, res)

    # Construct continuous (x, y) coordinates
    # Match WebGL shader coordinate space:
    # Normalized coords: uv.x in [-aspect, +aspect], uv.y in [-1.0, 1.0]
    aspect = w / float(h) if h > 0 else 1.0
    x_lin = np.linspace(-aspect, aspect, res, dtype=np.float32)
    # Row 0 is top of image (positive Y in math)
    y_lin = np.linspace(1.0, -1.0, res, dtype=np.float32)

    # If an explicit Cartesian grid was detected, adjust to grid domain
    if grid_info.has_grid:
        x_lin = np.linspace(grid_info.domain_x[0], grid_info.domain_x[1], res, dtype=np.float32)
        y_lin = np.linspace(grid_info.domain_y[1], grid_info.domain_y[0], res, dtype=np.float32)

    gx, gy = np.meshgrid(x_lin, y_lin)
    coords = np.column_stack([gx.ravel(), gy.ravel()])
    z_values = z_grid.ravel()

    # Free memory
    del rgb_full, gray_full, img_sampled, rgb_sampled
    if isinstance(image_input, bytes):
        pil_img.close()

    return ExtractedSurfaceData(
        coords=coords,
        z_values=z_values,
        z_grid=z_grid,
        x_lin=x_lin,
        y_lin=y_lin,
        grid_info=grid_info,
        width=w,
        height=h,
    )
