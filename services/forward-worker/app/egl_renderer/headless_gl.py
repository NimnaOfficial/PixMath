"""Headless ModernGL renderer for PixMath GLSL fragment shaders.

This module creates a standalone ModernGL context (preferring EGL on Linux,
falling back to the default standalone backend on Windows) and renders
user-generated fragment shaders into :class:`PIL.Image.Image` objects.

Typical usage::

    from app.egl_renderer import HeadlessRenderer

    with HeadlessRenderer() as renderer:
        img = renderer.render(glsl_source, width=512, height=512, time=0.0)
        img.save("output.png")

Design decisions
~~~~~~~~~~~~~~~~
* The renderer owns a **single** OpenGL context that is reused across
  multiple :meth:`render` calls for efficiency.
* A simple fullscreen-quad vertex shader is built in; only the fragment
  shader varies per expression.
* Shader compilation errors are caught and re-raised as
  :class:`ShaderCompilationError` with the driver's info-log included.
"""
from __future__ import annotations

import platform
import struct
import sys
from typing import Final

import moderngl
from PIL import Image

# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------


class ShaderCompilationError(Exception):
    """Raised when a GLSL shader fails to compile or link.

    Attributes:
        info_log: The raw info-log string from the OpenGL driver.
    """

    def __init__(self, message: str, *, info_log: str = "") -> None:
        self.info_log: str = info_log
        super().__init__(message)


# ---------------------------------------------------------------------------
# Built-in fullscreen-quad vertex shader
# ---------------------------------------------------------------------------

_VERTEX_SHADER: Final[str] = """\
#version 330 core

in vec2 in_position;

void main() {
    gl_Position = vec4(in_position, 0.0, 1.0);
}
"""

#: Fullscreen quad vertices (two triangles covering clip space).
_QUAD_VERTICES: Final[bytes] = struct.pack(
    "12f",
    # Triangle 1
    -1.0, -1.0,
     1.0, -1.0,
    -1.0,  1.0,
    # Triangle 2
    -1.0,  1.0,
     1.0, -1.0,
     1.0,  1.0,
)


# ---------------------------------------------------------------------------
# Renderer
# ---------------------------------------------------------------------------


class HeadlessRenderer:
    """Context-managed headless GPU renderer.

    Parameters:
        backend: ModernGL backend to use.  Defaults to ``"egl"`` on Linux
            and ``None`` (standalone) on Windows/macOS.
    """

    def __init__(self, *, backend: str | None = None) -> None:
        if backend is None:
            backend = "egl" if platform.system() == "Linux" else None  # type: ignore[assignment]
        self._backend: str | None = backend
        self._ctx: moderngl.Context | None = None

    # -- context manager -----------------------------------------------------

    def __enter__(self) -> HeadlessRenderer:
        self._ctx = self._create_context()
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: object,
    ) -> None:
        self.close()

    # -- lifecycle -----------------------------------------------------------

    def _create_context(self) -> moderngl.Context:
        """Create a standalone ModernGL context.

        Tries the requested backend first; falls back to the default
        standalone context if that fails.
        """
        try:
            if self._backend:
                return moderngl.create_standalone_context(backend=self._backend)
            return moderngl.create_standalone_context()
        except Exception:
            # Fallback: let ModernGL pick the best available backend.
            return moderngl.create_standalone_context()

    def close(self) -> None:
        """Release the OpenGL context and associated resources."""
        if self._ctx is not None:
            self._ctx.release()
            self._ctx = None

    # -- public API ----------------------------------------------------------

    def render(
        self,
        glsl_source: str,
        width: int = 512,
        height: int = 512,
        time: float = 0.0,
    ) -> Image.Image:
        """Compile *glsl_source* and render it into a PIL Image.

        Parameters:
            glsl_source: Complete GLSL fragment shader source (``#version …``).
            width:       Output image width in pixels.
            height:      Output image height in pixels.
            time:        Value passed to the ``u_time`` uniform.

        Returns:
            An RGBA :class:`PIL.Image.Image`.

        Raises:
            ShaderCompilationError: If the shader fails to compile or link.
            RuntimeError: If the renderer context has not been initialised.
        """
        if self._ctx is None:
            raise RuntimeError(
                "HeadlessRenderer context is not initialised.  "
                "Use it as a context manager: `with HeadlessRenderer() as r:`"
            )

        ctx = self._ctx

        # --- compile program ------------------------------------------------
        try:
            program = ctx.program(
                vertex_shader=_VERTEX_SHADER,
                fragment_shader=glsl_source,
            )
        except Exception as exc:
            raise ShaderCompilationError(
                f"GLSL compilation/link failed: {exc}",
                info_log=str(exc),
            ) from exc

        # --- create framebuffer ---------------------------------------------
        color_attachment = ctx.texture((width, height), 4)  # RGBA
        fbo = ctx.framebuffer(color_attachments=[color_attachment])

        # --- create VAO -----------------------------------------------------
        vbo = ctx.buffer(_QUAD_VERTICES)
        vao = ctx.vertex_array(program, [(vbo, "2f", "in_position")])

        # --- set uniforms ---------------------------------------------------
        if "u_time" in program:
            program["u_time"].value = time  # type: ignore[union-attr]
        if "u_resolution" in program:
            program["u_resolution"].value = (float(width), float(height))  # type: ignore[union-attr]

        # --- render ---------------------------------------------------------
        fbo.use()
        ctx.clear(0.0, 0.0, 0.0, 1.0)
        vao.render(moderngl.TRIANGLES)

        # --- read pixels ----------------------------------------------------
        raw = fbo.read(components=4)
        image = Image.frombytes("RGBA", (width, height), raw)
        # OpenGL origin is bottom-left; flip vertically for normal image coords.
        image = image.transpose(Image.Transpose.FLIP_TOP_BOTTOM)

        # --- cleanup GPU objects for this render ----------------------------
        vao.release()
        vbo.release()
        fbo.release()
        color_attachment.release()
        program.release()

        return image
