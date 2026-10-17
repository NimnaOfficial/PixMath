"""
Unit tests for pixmath-core library.

Tests cover SDF primitives, Simplex noise, and PSNR/SSIM metrics.
"""

from __future__ import annotations

import numpy as np
import pytest

from pixmath_core.metrics import dssim, psnr, ssim
from pixmath_core.noise import fbm_simplex_2d, simplex_noise_2d
from pixmath_core.sdf import sd_box, sd_circle, sd_torus, smooth_min


class TestSDFPrimitives:
    """Test Signed Distance Function primitives."""

    def test_circle_center_is_negative(self) -> None:
        """Point at center of unit circle should be inside (negative distance)."""
        x = np.array([0.0])
        y = np.array([0.0])
        d = sd_circle(x, y, cx=0.0, cy=0.0, r=1.0)
        assert d[0] < 0

    def test_circle_boundary_is_zero(self) -> None:
        """Point on boundary should have distance ≈ 0."""
        x = np.array([1.0])
        y = np.array([0.0])
        d = sd_circle(x, y, cx=0.0, cy=0.0, r=1.0)
        assert abs(d[0]) < 1e-10

    def test_circle_outside_is_positive(self) -> None:
        """Point outside the circle should have positive distance."""
        x = np.array([2.0])
        y = np.array([0.0])
        d = sd_circle(x, y, cx=0.0, cy=0.0, r=1.0)
        assert d[0] > 0

    def test_box_center_is_negative(self) -> None:
        x = np.array([0.0])
        y = np.array([0.0])
        d = sd_box(x, y, cx=0.0, cy=0.0, half_w=1.0, half_h=1.0)
        assert d[0] < 0

    def test_box_corner_is_zero(self) -> None:
        x = np.array([1.0])
        y = np.array([0.0])
        d = sd_box(x, y, cx=0.0, cy=0.0, half_w=1.0, half_h=1.0)
        assert abs(d[0]) < 1e-10

    def test_torus_ring_center_is_negative(self) -> None:
        """Point on the major radius ring should be inside the torus."""
        x = np.array([1.0])
        y = np.array([0.0])
        d = sd_torus(x, y, cx=0.0, cy=0.0, r_major=1.0, r_minor=0.3)
        assert d[0] < 0

    def test_smooth_min_union(self) -> None:
        """Smooth min of two circles should be less than min of individual distances."""
        x = np.linspace(-2, 2, 100)
        y = np.zeros(100)
        d1 = sd_circle(x, y, cx=-0.5, cy=0.0, r=0.8)
        d2 = sd_circle(x, y, cx=0.5, cy=0.0, r=0.8)
        d_smooth = smooth_min(d1, d2, k=0.3)
        d_hard = np.minimum(d1, d2)
        # Smooth min should be <= hard min everywhere (blending region)
        assert np.all(d_smooth <= d_hard + 1e-10)

    def test_vectorized_output_shape(self) -> None:
        """SDF functions should preserve input array shapes."""
        x = np.random.randn(100, 100)
        y = np.random.randn(100, 100)
        d = sd_circle(x, y)
        assert d.shape == (100, 100)


class TestSimplexNoise:
    """Test Simplex noise generation."""

    def test_output_range(self) -> None:
        """Simplex noise should be approximately in [-1, 1]."""
        x = np.linspace(-10, 10, 1000)
        y = np.linspace(-10, 10, 1000)
        xx, yy = np.meshgrid(x, y)
        noise = simplex_noise_2d(xx, yy, seed=42)
        assert noise.min() >= -1.5  # Allow some tolerance
        assert noise.max() <= 1.5

    def test_deterministic_with_seed(self) -> None:
        """Same seed should produce identical results."""
        x = np.linspace(0, 5, 100)
        y = np.linspace(0, 5, 100)
        n1 = simplex_noise_2d(x, y, seed=42)
        n2 = simplex_noise_2d(x, y, seed=42)
        np.testing.assert_array_equal(n1, n2)

    def test_different_seeds_differ(self) -> None:
        """Different seeds should produce different results."""
        x = np.linspace(0, 5, 100)
        y = np.linspace(0, 5, 100)
        n1 = simplex_noise_2d(x, y, seed=1)
        n2 = simplex_noise_2d(x, y, seed=2)
        assert not np.allclose(n1, n2)

    def test_fbm_output_shape(self) -> None:
        x = np.random.randn(50, 50)
        y = np.random.randn(50, 50)
        result = fbm_simplex_2d(x, y, octaves=4, seed=42)
        assert result.shape == (50, 50)


class TestMetrics:
    """Test PSNR and SSIM metrics."""

    def test_psnr_identical_images(self) -> None:
        """Identical images should have infinite PSNR."""
        img = np.random.rand(64, 64)
        assert psnr(img, img) == float("inf")

    def test_psnr_different_images(self) -> None:
        """Different images should have finite positive PSNR."""
        img_a = np.random.rand(64, 64)
        img_b = np.random.rand(64, 64)
        score = psnr(img_a, img_b)
        assert 0 < score < 100

    def test_ssim_identical_images(self) -> None:
        """Identical images should have SSIM = 1."""
        img = np.random.rand(64, 64)
        score = ssim(img, img)
        assert abs(score - 1.0) < 0.01

    def test_dssim_identical_images(self) -> None:
        """Identical images should have D-SSIM ≈ 0."""
        img = np.random.rand(64, 64)
        score = dssim(img, img)
        assert score < 0.01

    def test_dssim_range(self) -> None:
        """D-SSIM should be in [0, 1]."""
        img_a = np.random.rand(64, 64)
        img_b = np.random.rand(64, 64)
        score = dssim(img_a, img_b)
        assert 0 <= score <= 1
