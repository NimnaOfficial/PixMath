"""PixMath Headless EGL/ModernGL Renderer.

Public API:
    HeadlessRenderer – context-managed headless GPU renderer that compiles GLSL
                       shaders and produces PIL images.
"""
from __future__ import annotations

from .headless_gl import HeadlessRenderer

__all__ = ["HeadlessRenderer"]
