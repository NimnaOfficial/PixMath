"""PixMath AST Sandbox – security-critical expression validation.

Public API:
    validate(expr_string)  – parse *and* security-validate a math expression.
    ASTSecurityError       – raised when an expression violates security policy.
    ValidationResult       – structured result containing metrics and diagnostics.
"""
from __future__ import annotations

from .ast_validator import ASTSecurityError, ValidationResult, validate

__all__ = ["ASTSecurityError", "ValidationResult", "validate"]
