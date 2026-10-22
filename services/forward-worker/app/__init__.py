"""PixMath Forward Worker Application.

This package implements the forward rendering pipeline:
    equation string → AST validation → GLSL transpilation → headless GPU render → image output.

Subpackages:
    sandbox       – Security-critical AST validation and sandboxing.
    transpiler    – AST-to-GLSL fragment-shader code generation.
    egl_renderer  – Headless OpenGL (ModernGL/EGL) rendering backend.
"""
from __future__ import annotations

from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)

__all__: list[str] = []

