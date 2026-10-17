"""
2D Simplex noise generator.

Based on the Simplex Noise algorithm by Ken Perlin (2001).
Pure numpy implementation — no C extensions required.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

# Permutation table (doubled for overflow wrapping)
_PERM = np.array(
    [
        151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225,
        140, 36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148,
        247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32,
        57, 177, 33, 88, 237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175,
        74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83, 111, 229, 122,
        60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54,
        65, 25, 63, 161, 1, 216, 80, 73, 209, 76, 132, 187, 208, 89, 18, 169,
        200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186, 3, 64,
        52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212,
        207, 206, 59, 227, 47, 16, 58, 17, 182, 189, 28, 42, 223, 183, 170, 213,
        119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
        129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104,
        218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12, 191, 179, 162, 241,
        81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
        184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93,
        222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215, 61, 156, 180,
    ],
    dtype=np.int32,
)
_PERM = np.concatenate([_PERM, _PERM])

# Gradient vectors for 2D simplex noise
_GRAD2 = np.array(
    [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]],
    dtype=np.float64,
)

# Skew / unskew constants for 2D
_F2 = 0.5 * (np.sqrt(3.0) - 1.0)
_G2 = (3.0 - np.sqrt(3.0)) / 6.0


def simplex_noise_2d(
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    *,
    seed: int = 0,
) -> NDArray[np.float64]:
    """
    Compute 2D simplex noise for coordinate arrays x, y.

    Returns values in approximately [-1, 1].
    """
    rng = np.random.default_rng(seed)
    perm = _PERM.copy()
    rng.shuffle(perm[:256])
    perm[256:] = perm[:256]

    # Skew input space to determine simplex cell
    s = (x + y) * _F2
    i = np.floor(x + s).astype(np.int32)
    j = np.floor(y + s).astype(np.int32)

    t = (i + j) * _G2
    x0 = x - (i - t)
    y0 = y - (j - t)

    # Determine which simplex we're in
    i1 = np.where(x0 > y0, 1, 0)
    j1 = np.where(x0 > y0, 0, 1)

    x1 = x0 - i1 + _G2
    y1 = y0 - j1 + _G2
    x2 = x0 - 1.0 + 2.0 * _G2
    y2 = y0 - 1.0 + 2.0 * _G2

    # Hash coordinates
    ii = i & 255
    jj = j & 255

    def _grad_dot(
        hash_val: NDArray[np.int32],
        gx: NDArray[np.float64],
        gy: NDArray[np.float64],
    ) -> NDArray[np.float64]:
        g = _GRAD2[hash_val % 8]
        return g[..., 0] * gx + g[..., 1] * gy

    gi0 = perm[ii + perm[jj]]
    gi1 = perm[ii + i1 + perm[jj + j1]]
    gi2 = perm[ii + 1 + perm[jj + 1]]

    # Contribution from three corners
    result = np.zeros_like(x, dtype=np.float64)

    t0 = 0.5 - x0 * x0 - y0 * y0
    mask0 = t0 > 0
    t0 = np.where(mask0, t0, 0.0)
    t0 *= t0
    result += np.where(mask0, t0 * t0 * _grad_dot(gi0, x0, y0), 0.0)

    t1 = 0.5 - x1 * x1 - y1 * y1
    mask1 = t1 > 0
    t1 = np.where(mask1, t1, 0.0)
    t1 *= t1
    result += np.where(mask1, t1 * t1 * _grad_dot(gi1, x1, y1), 0.0)

    t2 = 0.5 - x2 * x2 - y2 * y2
    mask2 = t2 > 0
    t2 = np.where(mask2, t2, 0.0)
    t2 *= t2
    result += np.where(mask2, t2 * t2 * _grad_dot(gi2, x2, y2), 0.0)

    return 70.0 * result


def fbm_simplex_2d(
    x: NDArray[np.float64],
    y: NDArray[np.float64],
    *,
    octaves: int = 4,
    lacunarity: float = 2.0,
    gain: float = 0.5,
    seed: int = 0,
) -> NDArray[np.float64]:
    """Fractal Brownian Motion using simplex noise (layered octaves)."""
    result = np.zeros_like(x, dtype=np.float64)
    amplitude = 1.0
    frequency = 1.0
    for i in range(octaves):
        result += amplitude * simplex_noise_2d(
            x * frequency, y * frequency, seed=seed + i
        )
        amplitude *= gain
        frequency *= lacunarity
    return result
