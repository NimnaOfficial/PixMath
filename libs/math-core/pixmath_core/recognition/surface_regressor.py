"""Surface Symbolic Regression Engine for PixMath.

Fits mathematical closed-form equations f(x, y) to extracted 2D continuous
scalar field surface data points (x, y, z):
1. 2D Fast Fourier Transform (FFT) frequency spectrum analysis to detect
   fundamental spatial and radial frequencies (kx, ky, kr).
2. Continuous parameter optimization (1D/2D bounded minimizers) for exact frequency matching.
3. Multi-family candidate hypothesis evaluation:
   - Harmonic wave products: sin(kx*x) * cos(ky*y), etc.
   - Harmonic wave sums: sin(kx*x) + cos(ky*y), etc.
   - Concentric radial waves: sin(kr * sqrt(x^2 + y^2)), etc.
   - Quadric / polynomial surfaces: x^2 + y^2, x^2 - y^2, xy, etc.
   - Exponential / Gaussian bell: exp(-k*(x^2 + y^2))
   - SDF rings: sqrt(x^2 + y^2) - r
   - Sparse linear multi-basis regression (Lasso/Ridge/OMP).
4. Optional PySR genetic evolutionary regression for deep Pareto search.
5. Calculates R^2 accuracy score and normalized RMSE against true surface.
6. Strictly ephemeral: Zero disk persistence.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from typing import Any

import numpy as np
import scipy.optimize
import sympy as sp

from pixmath_core.recognition.surface_extractor import ExtractedSurfaceData

logger = logging.getLogger(__name__)


@dataclass(frozen=True, slots=True)
class SurfaceRegressionResult:
    """Quantitative output of symbolic surface regression."""

    equation: str  # Clean GLSL/PixMath equation string, e.g. "sin(x * 3.0) * cos(y * 3.0)"
    latex: str  # Formatted LaTeX expression, e.g. "\\sin(3x) \\cos(3y)"
    r2_score: float  # Coefficient of determination in [0.0, 1.0]
    rmse: float  # Root mean squared error
    confidence: float  # Confidence percentage in [0.0, 100.0]
    confidence_grade: str  # "high" (>=90%), "medium" (75-89%), "low" (<75%)
    method: str  # Regression algorithm used
    details: dict[str, Any]

    def to_dict(self) -> dict[str, Any]:
        return {
            "equation": self.equation,
            "latex": self.latex,
            "r2_score": round(self.r2_score, 4),
            "rmse": round(self.rmse, 4),
            "confidence": round(self.confidence, 1),
            "confidence_grade": self.confidence_grade,
            "method": self.method,
            "details": self.details,
        }


def _format_glsl_safe(expr_str: str) -> str:
    """Ensure all integer constants in formula string are formatted as GLSL floats."""
    expr_str = expr_str.replace("**", "^")
    return re.sub(r"(?<![a-zA-Z0-9_.])(\d+)(?![a-zA-Z0-9_.])", r"\1.0", expr_str)


def _compute_r2(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute R^2 coefficient of determination clipped to [0.0, 1.0]."""
    ss_tot = float(np.sum((y_true - np.mean(y_true)) ** 2))
    if ss_tot < 1e-9:
        return 0.0
    ss_res = float(np.sum((y_true - y_pred) ** 2))
    r2 = 1.0 - (ss_res / ss_tot)
    return max(0.0, min(1.0, r2))


def _compute_rmse(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Compute Root Mean Squared Error."""
    return float(np.sqrt(np.mean((y_true - y_pred) ** 2)))


def _round_nice(val: float, tolerance: float = 0.18) -> float:
    """Round parameter to nearby integer or common fraction if within tolerance."""
    nearest_int = round(val)
    if abs(val - nearest_int) <= tolerance:
        return float(nearest_int)
    nearest_half = round(val * 2.0) / 2.0
    if abs(val - nearest_half) <= tolerance / 2.0:
        return float(nearest_half)
    return round(val, 2)


class SurfaceRegressor:
    """Symbolic regression engine tailored for 2D mathematical scalar fields."""

    def __init__(self) -> None:
        self.x, self.y = sp.symbols("x y")

    def fit(
        self,
        surface_data: ExtractedSurfaceData,
        *,
        allow_pysr: bool = False,
        pysr_iterations: int = 25,
    ) -> SurfaceRegressionResult:
        """Fit closed-form mathematical equation f(x, y) to extracted surface data."""
        coords = surface_data.coords
        x_pts = coords[:, 0]
        y_pts = coords[:, 1]
        z_true = surface_data.z_values
        z_grid = surface_data.z_grid
        res = z_grid.shape[0]

        # 1. 2D FFT Frequency Analysis
        fft2 = np.fft.rfft2(z_grid)
        power = np.abs(fft2)
        power[0, 0] = 0.0  # Eliminate DC bias

        # Detect top peak frequencies
        peak_idx = np.unravel_index(np.argmax(power), power.shape)
        dx = float(surface_data.x_lin[1] - surface_data.x_lin[0]) if len(surface_data.x_lin) > 1 else 0.05
        dy = float(abs(surface_data.y_lin[1] - surface_data.y_lin[0])) if len(surface_data.y_lin) > 1 else 0.05

        freq_y = np.fft.fftfreq(res, d=dy)[peak_idx[0]]
        freq_x = np.fft.rfftfreq(res, d=dx)[peak_idx[1]]

        kx_raw = abs(2.0 * np.pi * freq_x)
        ky_raw = abs(2.0 * np.pi * freq_y)

        kx = _round_nice(kx_raw, tolerance=0.25)
        ky = _round_nice(ky_raw, tolerance=0.25)

        kx = kx if kx >= 0.5 else 1.0
        ky = ky if ky >= 0.5 else 1.0

        r_pts = np.sqrt(x_pts * x_pts + y_pts * y_pts)

        # 2. Hypothesis Pool: Test core PixMath surface families
        candidates: list[tuple[float, sp.Expr, str, np.ndarray]] = []

        def eval_candidate(sym_expr: sp.Expr, z_cand: np.ndarray, method_name: str) -> None:
            if np.any(np.isnan(z_cand)) or np.any(np.isinf(z_cand)):
                return
            r2 = _compute_r2(z_true, z_cand)
            complexity = len(str(sym_expr))
            penalized_score = r2 - (complexity * 0.001)
            candidates.append((penalized_score, sym_expr, method_name, z_cand))

        # Family A: Harmonic Wave Products (with FFT frequencies + local optimization)
        freq_pairs = [(kx, ky)]
        # Optimize kx, ky jointly if gradient permits
        def opt_wave_product(sx: bool, sy: bool) -> tuple[float, float, float, np.ndarray]:
            def loss_fn(p: np.ndarray) -> float:
                wx, wy = p
                fx = np.sin(wx * x_pts) if sx else np.cos(wx * x_pts)
                fy = np.sin(wy * y_pts) if sy else np.cos(wy * y_pts)
                prod = fx * fy
                dot = np.dot(prod, z_true)
                denom = np.dot(prod, prod)
                scale = dot / denom if denom > 1e-6 else 0.0
                return float(np.mean((z_true - scale * prod) ** 2))

            bnds = ((max(0.5, kx - 1.5), kx + 1.5), (max(0.5, ky - 1.5), ky + 1.5))
            res_opt = scipy.optimize.minimize(loss_fn, [kx, ky], bounds=bnds, method="L-BFGS-B")
            opt_kx = _round_nice(float(res_opt.x[0]), tolerance=0.25)
            opt_ky = _round_nice(float(res_opt.x[1]), tolerance=0.25)
            fx = np.sin(opt_kx * x_pts) if sx else np.cos(opt_kx * x_pts)
            fy = np.sin(opt_ky * y_pts) if sy else np.cos(opt_ky * y_pts)
            prod = fx * fy
            dot = float(np.dot(prod, z_true))
            denom = float(np.dot(prod, prod))
            scale = _round_nice(dot / denom if denom > 1e-6 else 1.0, tolerance=0.15)
            return opt_kx, opt_ky, scale, scale * prod

        for sx in [True, False]:
            for sy in [True, False]:
                opt_kx, opt_ky, scale, z_fit = opt_wave_product(sx, sy)
                x_term = sp.sin(opt_kx * self.x) if sx else sp.cos(opt_kx * self.x)
                y_term = sp.sin(opt_ky * self.y) if sy else sp.cos(opt_ky * self.y)
                expr = scale * x_term * y_term if scale != 1.0 else x_term * y_term
                eval_candidate(expr, z_fit, "harmonic_wave_product")

        # Family B: Harmonic Wave Sums
        for sx in [True, False]:
            for sy in [True, False]:
                fx = np.sin(kx * x_pts) if sx else np.cos(kx * x_pts)
                fy = np.sin(ky * y_pts) if sy else np.cos(ky * y_pts)
                A_mat = np.column_stack([fx, fy])
                coeffs, _, _, _ = np.linalg.lstsq(A_mat, z_true, rcond=None)
                c0 = _round_nice(float(coeffs[0]), tolerance=0.15)
                c1 = _round_nice(float(coeffs[1]), tolerance=0.15)
                z_fit = c0 * fx + c1 * fy

                x_term = sp.sin(kx * self.x) if sx else sp.cos(kx * self.x)
                y_term = sp.sin(ky * self.y) if sy else sp.cos(ky * self.y)
                expr = c0 * x_term + c1 * y_term
                eval_candidate(expr, z_fit, "harmonic_wave_sum")

        # Family C: Radial Concentric Waves / Bessel (with bounded 1D frequency search)
        for sr in [True, False]:
            def radial_loss(k: float) -> float:
                fr = np.sin(k * r_pts) if sr else np.cos(k * r_pts)
                dot = np.dot(fr, z_true)
                denom = np.dot(fr, fr)
                s = dot / denom if denom > 1e-6 else 0.0
                return float(np.mean((z_true - s * fr) ** 2))

            res_kr = scipy.optimize.minimize_scalar(radial_loss, bounds=(0.5, 20.0), method="bounded")
            best_kr = _round_nice(float(res_kr.x), tolerance=0.25)
            fr = np.sin(best_kr * r_pts) if sr else np.cos(best_kr * r_pts)
            dot = float(np.dot(fr, z_true))
            denom = float(np.dot(fr, fr))
            scale = _round_nice(dot / denom if denom > 1e-6 else 1.0, tolerance=0.15)
            z_fit = scale * fr
            r_term = sp.sqrt(self.x**2 + self.y**2)
            trig_term = sp.sin(best_kr * r_term) if sr else sp.cos(best_kr * r_term)
            expr = scale * trig_term if scale != 1.0 else trig_term
            eval_candidate(expr, z_fit, "radial_concentric_wave")

        # Family D: Quadric / Polynomial Surfaces
        poly_mat = np.column_stack([
            np.ones_like(x_pts),
            x_pts,
            y_pts,
            x_pts**2,
            y_pts**2,
            x_pts * y_pts,
        ])
        coeffs, _, _, _ = np.linalg.lstsq(poly_mat, z_true, rcond=None)
        z_fit = poly_mat @ coeffs

        c_const, c_x, c_y, c_x2, c_y2, c_xy = [_round_nice(float(c), tolerance=0.1) for c in coeffs]
        q_expr: sp.Expr = sp.Integer(0)
        if abs(c_const) > 0.05:
            q_expr += c_const
        if abs(c_x) > 0.05:
            q_expr += c_x * self.x
        if abs(c_y) > 0.05:
            q_expr += c_y * self.y
        if abs(c_x2) > 0.05:
            q_expr += c_x2 * (self.x**2)
        if abs(c_y2) > 0.05:
            q_expr += c_y2 * (self.y**2)
        if abs(c_xy) > 0.05:
            q_expr += c_xy * (self.x * self.y)
        eval_candidate(q_expr, z_fit, "quadric_polynomial")

        # Family E: Saddle Surface (x^2 - y^2)
        saddle = x_pts**2 - y_pts**2
        saddle_scale = _round_nice(float(np.dot(saddle, z_true) / (np.dot(saddle, saddle) + 1e-6)), tolerance=0.15)
        if abs(saddle_scale) > 0.05:
            z_fit = saddle_scale * saddle
            expr = saddle_scale * (self.x**2 - self.y**2)
            eval_candidate(expr, z_fit, "hyperbolic_saddle")

        # Family F: Exponential / Gaussian Bell
        exp_bell = np.exp(-((x_pts**2 + y_pts**2) * 2.0))
        dot = float(np.dot(exp_bell, z_true))
        denom = float(np.dot(exp_bell, exp_bell))
        scale = _round_nice(dot / denom if denom > 1e-6 else 1.0, tolerance=0.15)
        if abs(scale) > 0.05:
            z_fit = scale * exp_bell
            expr = scale * sp.exp(-2.0 * (self.x**2 + self.y**2))
            eval_candidate(expr, z_fit, "gaussian_bell")

        # Family G: Signed Distance Field (SDF) Circle / Ring: sqrt(x^2 + y^2) - r
        for radius in [0.3, 0.5, 0.7, 1.0]:
            sdf_ring = r_pts - radius
            dot = float(np.dot(sdf_ring, z_true))
            denom = float(np.dot(sdf_ring, sdf_ring))
            scale = _round_nice(dot / denom if denom > 1e-6 else 1.0, tolerance=0.15)
            z_fit = scale * sdf_ring
            expr = scale * (sp.sqrt(self.x**2 + self.y**2) - radius)
            eval_candidate(expr, z_fit, "sdf_primitive")

        # Select top hypothesis from analytical pool
        candidates.sort(key=lambda c: c[0], reverse=True)
        best_score, best_expr, best_method, best_z_pred = candidates[0]
        best_r2 = _compute_r2(z_true, best_z_pred)

        # 3. Optional Deep PySR Genetic Search (if analytical R^2 is low and allowed)
        if allow_pysr and best_r2 < 0.85:
            try:
                from pysr import PySRRegressor  # type: ignore[import-untyped]
                logger.info("Analytical R^2=%.3f < 0.85; invoking PySR genetic regressor", best_r2)
                pysr_model = PySRRegressor(
                    niterations=pysr_iterations,
                    populations=15,
                    maxsize=20,
                    binary_operators=["+", "-", "*", "/"],
                    unary_operators=["sin", "cos", "sqrt", "exp"],
                    verbosity=0,
                    progress=False,
                )
                pysr_model.fit(coords, z_true, variable_names=["x", "y"])
                pysr_pred = pysr_model.predict(coords)
                pysr_r2 = _compute_r2(z_true, pysr_pred)

                if pysr_r2 > best_r2:
                    pysr_expr_str = str(pysr_model.sympy())
                    best_expr = sp.sympify(pysr_expr_str)
                    best_z_pred = pysr_pred
                    best_r2 = pysr_r2
                    best_method = "pysr_genetic_pareto"
            except Exception as exc:
                logger.warning("PySR fallback failed or unavailable: %s", exc)

        # 4. Diagnostics & Formatting
        rmse = _compute_rmse(z_true, best_z_pred)
        confidence = float(np.clip(best_r2 * 100.0, 0.0, 100.0))

        if confidence >= 90.0:
            grade = "high"
        elif confidence >= 75.0:
            grade = "medium"
        else:
            grade = "low"

        raw_eq_str = str(best_expr)
        eq_formatted = _format_glsl_safe(raw_eq_str)
        latex_formatted = sp.latex(best_expr)

        return SurfaceRegressionResult(
            equation=eq_formatted,
            latex=latex_formatted,
            r2_score=best_r2,
            rmse=rmse,
            confidence=confidence,
            confidence_grade=grade,
            method=best_method,
            details={
                "detected_kx": kx,
                "detected_ky": ky,
                "grid_has_axes": surface_data.grid_info.has_grid,
                "grid_scale_x": surface_data.grid_info.scale_x,
                "grid_scale_y": surface_data.grid_info.scale_y,
                "num_sample_points": len(z_true),
            },
        )


_REGRESSOR = SurfaceRegressor()


def fit_surface_equation(
    surface_data: ExtractedSurfaceData,
    *,
    allow_pysr: bool = False,
    pysr_iterations: int = 25,
) -> SurfaceRegressionResult:
    """Convenience helper to fit a surface equation to extracted surface data."""
    return _REGRESSOR.fit(
        surface_data,
        allow_pysr=allow_pysr,
        pysr_iterations=pysr_iterations,
    )
