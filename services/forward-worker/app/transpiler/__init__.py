"""PixMath AST-to-GLSL Transpiler.

Public API:
    transpile(expr_ast)  – convert a validated Python AST to a complete GLSL fragment shader.
    GLSLTranspiler       – the AST node-visitor that performs code generation.
"""
from __future__ import annotations

from .ast_to_glsl import GLSLTranspiler, transpile

__all__ = ["GLSLTranspiler", "transpile"]
