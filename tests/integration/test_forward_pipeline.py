"""
Integration tests for the end-to-end forward pipeline.

Tests the full flow: equation string → AST validation → GLSL transpilation.
"""

from __future__ import annotations

import pytest


class TestForwardPipeline:
    """Test the forward engine pipeline end-to-end."""

    @pytest.mark.integration
    def test_simple_equation_to_glsl(self) -> None:
        """A simple equation should produce valid GLSL shader source."""
        from app.sandbox.ast_validator import validate
        from app.transpiler.ast_to_glsl import transpile

        ast_node = validate("sin(x * 3.14159) * cos(y * 3.14159)")
        glsl_source = transpile(ast_node)

        assert "#version 330 core" in glsl_source
        assert "sin" in glsl_source
        assert "cos" in glsl_source
        assert "gl_FragColor" in glsl_source or "fragColor" in glsl_source

    @pytest.mark.integration
    def test_complex_equation_to_glsl(self) -> None:
        """A complex equation should transpile successfully."""
        from app.sandbox.ast_validator import validate
        from app.transpiler.ast_to_glsl import transpile

        expr = "clamp(sin(x * 10.0) * cos(y * 10.0) + sqrt(x**2 + y**2) * 0.3, 0.0, 1.0)"
        ast_node = validate(expr)
        glsl_source = transpile(ast_node)

        assert "safe_sqrt" in glsl_source or "sqrt" in glsl_source
        assert "clamp" in glsl_source

    @pytest.mark.integration
    def test_time_varying_equation(self) -> None:
        """Time-dependent equations should include u_time uniform."""
        from app.sandbox.ast_validator import validate
        from app.transpiler.ast_to_glsl import transpile

        ast_node = validate("sin(x + t) * cos(y - t)")
        glsl_source = transpile(ast_node)

        assert "u_time" in glsl_source
