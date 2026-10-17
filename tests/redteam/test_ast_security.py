"""
Red-team security tests for the AST validator.

These tests verify that malicious, crafted, or resource-exhaustion
expressions are correctly rejected by the SecurityASTValidator.
"""

from __future__ import annotations

import pytest


class TestASTInjectionAttacks:
    """Test that code injection via eval/exec-style payloads is blocked."""

    @pytest.mark.redteam
    def test_rejects_import_statement(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("__import__('os').system('rm -rf /')")

    @pytest.mark.redteam
    def test_rejects_exec_call(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("exec('print(1)')")

    @pytest.mark.redteam
    def test_rejects_eval_call(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("eval('1+1')")

    @pytest.mark.redteam
    def test_rejects_dunder_access(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("x.__class__.__bases__[0]")

    @pytest.mark.redteam
    def test_rejects_attribute_access(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("x.real")

    @pytest.mark.redteam
    def test_rejects_lambda(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("(lambda: 1)()")

    @pytest.mark.redteam
    def test_rejects_comprehension(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("[x for x in range(10)]")

    @pytest.mark.redteam
    def test_rejects_unknown_variable(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("os + x")

    @pytest.mark.redteam
    def test_rejects_unknown_function(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        with pytest.raises(ASTSecurityError):
            validate("open('file.txt')")


class TestResourceExhaustionAttacks:
    """Test that expressions designed to exhaust CPU/memory are blocked."""

    @pytest.mark.redteam
    def test_rejects_deep_nesting(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        # Create expression with depth > 32
        expr = "x"
        for _ in range(50):
            expr = f"sin({expr})"
        with pytest.raises(ASTSecurityError):
            validate(expr)

    @pytest.mark.redteam
    def test_rejects_excessive_nodes(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        # Create expression with > 2000 nodes
        expr = "+".join(["x"] * 2500)
        with pytest.raises(ASTSecurityError):
            validate(expr)

    @pytest.mark.redteam
    def test_rejects_exponential_tower(self) -> None:
        from app.sandbox.ast_validator import ASTSecurityError, validate

        # 2^(2^(2^(2^(2^(2^x))))) — deep nesting
        expr = "x"
        for _ in range(40):
            expr = f"2**({expr})"
        with pytest.raises(ASTSecurityError):
            validate(expr)


class TestValidExpressions:
    """Test that legitimate mathematical expressions are accepted."""

    @pytest.mark.redteam
    def test_accepts_simple_addition(self) -> None:
        from app.sandbox.ast_validator import validate

        result = validate("x + y")
        assert result is not None

    @pytest.mark.redteam
    def test_accepts_trig_composition(self) -> None:
        from app.sandbox.ast_validator import validate

        result = validate("sin(x * pi) + cos(y * e)")
        assert result is not None

    @pytest.mark.redteam
    def test_accepts_complex_art_equation(self) -> None:
        from app.sandbox.ast_validator import validate

        expr = "sin(x * 10.0) * cos(y * 10.0) + sin(sqrt(x**2 + y**2) * 5.0) * 0.5"
        result = validate(expr)
        assert result is not None

    @pytest.mark.redteam
    def test_accepts_time_variable(self) -> None:
        from app.sandbox.ast_validator import validate

        result = validate("sin(x + t) * cos(y - t)")
        assert result is not None

    @pytest.mark.redteam
    def test_accepts_clamp_and_smoothstep(self) -> None:
        from app.sandbox.ast_validator import validate

        result = validate("clamp(smoothstep(0.0, 1.0, x), 0.0, 1.0)")
        assert result is not None

    @pytest.mark.redteam
    def test_accepts_noise(self) -> None:
        from app.sandbox.ast_validator import validate

        result = validate("noise(x, y) * 0.5 + 0.5")
        assert result is not None
