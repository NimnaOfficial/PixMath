"""
Unit tests for Reverse Worker, Pareto elbow selection, AST sandbox, and Settings.
"""

from __future__ import annotations

import numpy as np
import pytest

from app.pareto.selector import find_pareto_elbow, ParetoSelector
from pixmath_core.sandbox import validate, ASTSecurityError
from pixmath_cli.main import _cpu_eval


class TestParetoSelector:
    """Test discrete-curvature Pareto elbow selection."""

    def test_single_point(self) -> None:
        idx = find_pareto_elbow([5.0], [0.1])
        assert idx == 0

    def test_two_points(self) -> None:
        # Should pick the one with lower loss
        idx = find_pareto_elbow([2.0, 5.0], [0.5, 0.1])
        assert idx == 1

    def test_standard_convex_elbow(self) -> None:
        # A classic L-shaped frontier where (3.0, 0.15) is the elbow
        complexities = [1.0, 2.0, 3.0, 10.0, 20.0]
        losses = [1.0, 0.5, 0.15, 0.14, 0.13]
        idx = find_pareto_elbow(complexities, losses)
        assert idx in (2, 3)

    def test_nested_channel_list(self) -> None:
        complexities = [[1.0, 5.0, 10.0], [1.0, 4.0, 9.0]]
        losses = [[1.0, 0.2, 0.1], [0.9, 0.3, 0.1]]
        idx = find_pareto_elbow(complexities, losses)
        assert idx in (0, 1, 2)

    def test_empty_list_returns_zero(self) -> None:
        assert find_pareto_elbow([], []) == 0


class TestASTSandboxCore:
    """Test the shared pixmath_core AST sandbox validator."""

    def test_valid_expressions(self) -> None:
        exprs = [
            "sin(x) * cos(y)",
            "noise(x, y) * 0.5 + 0.5",
            "noise(x) + sin(t)",
            "clamp(smoothstep(0.0, 1.0, x), 0.0, 1.0)",
            "x**2 + y**2 - 1.0",
            "atan2(y, x) / pi",
        ]
        for e in exprs:
            tree = validate(e)
            assert tree is not None

    def test_rejects_unsafe_expressions(self) -> None:
        unsafe = [
            "__import__('os').system('ls')",
            "open('/etc/passwd')",
            "[x for x in (1, 2, 3)]",
            "eval('1+1')",
        ]
        for u in unsafe:
            with pytest.raises(ASTSecurityError):
                validate(u)


class TestCpuEval:
    """Test CLI CPU fallback renderer."""

    def test_eval_simple(self) -> None:
        img = _cpu_eval("sin(x * pi) + cos(y * pi)", width=16, height=16, t=0.0)
        assert img.shape == (16, 16, 4)
        assert img.dtype == np.uint8

    def test_eval_noise_1d_and_2d(self) -> None:
        img1 = _cpu_eval("noise(x)", width=16, height=16, t=0.0)
        assert img1.shape == (16, 16, 4)

        img2 = _cpu_eval("noise(x, y)", width=16, height=16, t=0.0)
        assert img2.shape == (16, 16, 4)
