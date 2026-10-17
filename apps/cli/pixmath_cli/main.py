"""PixMath CLI — interactive command-line interface.

Provides ``pixmath render``, ``pixmath extract``, and ``pixmath info``
commands for local equation rendering and future image-to-equation
extraction.  Uses Typer for argument parsing and Rich for pretty
terminal output.
"""

from __future__ import annotations

import platform
import sys
import time
from pathlib import Path
from typing import Optional

import numpy as np
import typer
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

if sys.platform == "win32":
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

console = Console(legacy_windows=False)

app = typer.Typer(
    name="pixmath",
    help="PixMath — turn math equations into images (and back).",
    add_completion=False,
    rich_markup_mode="rich",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_moderngl() -> bool:
    """Return ``True`` if ModernGL + a headless context are available."""
    try:
        import moderngl  # noqa: F401

        return True
    except ImportError:
        return False


def _check_cuda() -> bool:
    """Return ``True`` if a CUDA-capable PyTorch backend is available."""
    try:
        import torch

        return torch.cuda.is_available()
    except ImportError:
        return False


def _cpu_eval(equation: str, width: int, height: int, t: float) -> np.ndarray:
    """Evaluate *equation* on a CPU numpy grid as a fallback renderer.

    The equation may reference ``x``, ``y`` (normalised to [-1, 1]),
    ``t`` (time), and any function from ``numpy`` (aliased as ``np``).

    Returns:
        RGBA uint8 ndarray of shape ``(height, width, 4)``.
    """
    xs = np.linspace(-1.0, 1.0, width, dtype=np.float32)
    ys = np.linspace(-1.0, 1.0, height, dtype=np.float32)
    x, y = np.meshgrid(xs, ys)  # noqa: F841 — used inside eval

    # Import shared math-core noise
    from pixmath_core.noise.simplex import simplex_noise_2d

    # Build a restricted namespace for eval.
    ns: dict[str, object] = {
        "x": x,
        "y": y,
        "t": np.float32(t),
        "np": np,
        "sin": np.sin,
        "cos": np.cos,
        "tan": np.tan,
        "asin": np.arcsin,
        "acos": np.arccos,
        "atan": np.arctan,
        "atan2": np.arctan2,
        "abs": np.abs,
        "sqrt": np.sqrt,
        "exp": np.exp,
        "log": np.log,
        "log2": np.log2,
        "log10": np.log10,
        "pi": np.pi,
        "e": np.e,
        "tau": 2.0 * np.pi,
        "sign": np.sign,
        "floor": np.floor,
        "ceil": np.ceil,
        "mod": np.mod,
        "min": np.minimum,
        "max": np.maximum,
        "fract": lambda v: v - np.floor(v),
        "clamp": lambda v, lo, hi: np.clip(v, lo, hi),
        "mix": lambda a, b, f: a * (1.0 - f) + b * f,
        "step": lambda edge, val: np.where(val < edge, 0.0, 1.0),
        "smoothstep": lambda e0, e1, val: np.clip(
            (val - e0) / (e1 - e0 + 1e-10), 0.0, 1.0
        ),
        "length": lambda *args: np.sqrt(sum(a**2 for a in args)),
        "noise": lambda nx, ny: simplex_noise_2d(nx, ny),
    }

    try:
        result = eval(equation, {"__builtins__": {}}, ns)  # noqa: S307
    except Exception as exc:
        console.print(f"[red]Evaluation error:[/red] {exc}")
        raise typer.Exit(code=1) from exc

    # Normalise scalar / 1-channel result to [0, 1] float.
    arr = np.asarray(result, dtype=np.float32)
    if arr.ndim == 0:
        arr = np.full((height, width), float(arr), dtype=np.float32)

    # Clamp to [0, 1].
    arr = np.clip(arr, 0.0, 1.0)

    # Build RGBA.
    if arr.ndim == 2:
        rgba = np.stack([arr, arr, arr, np.ones_like(arr)], axis=-1)
    elif arr.ndim == 3 and arr.shape[-1] == 3:
        ones = np.ones((*arr.shape[:2], 1), dtype=np.float32)
        rgba = np.concatenate([arr, ones], axis=-1)
    elif arr.ndim == 3 and arr.shape[-1] == 4:
        rgba = arr
    else:
        console.print("[red]Equation must produce a 2-D scalar or HxWx3/4 array.[/red]")
        raise typer.Exit(code=1)

    return (rgba * 255.0).astype(np.uint8)


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------

@app.command()
def render(
    eq: str = typer.Option(..., "--eq", help="PixMath equation string."),
    width: int = typer.Option(512, "--width", "-w", help="Output width in pixels."),
    height: int = typer.Option(512, "--height", "-h", help="Output height in pixels."),
    out: Path = typer.Option(
        Path("output.png"), "--out", "-o", help="Output file path."
    ),
    time_val: float = typer.Option(0.0, "--time", "-t", help="Time parameter (t)."),
) -> None:
    """Render a PixMath equation to an image file."""
    from PIL import Image

    console.print(
        Panel(
            f"[bold cyan]Equation:[/bold cyan] {eq}\n"
            f"[bold cyan]Size:[/bold cyan] {width}×{height}\n"
            f"[bold cyan]Time:[/bold cyan] {time_val}\n"
            f"[bold cyan]Output:[/bold cyan] {out}",
            title="[bold]PixMath Render[/bold]",
            border_style="blue",
        )
    )

    # --- Validate (placeholder: basic syntax check) ----------------------
    try:
        compile(eq, "<equation>", "eval")
    except SyntaxError as exc:
        console.print(f"[red]Invalid equation syntax:[/red] {exc.msg}")
        raise typer.Exit(code=1) from exc

    # --- Render ----------------------------------------------------------
    use_gpu = _check_moderngl()
    backend_label = "ModernGL (GPU)" if use_gpu else "NumPy (CPU)"

    with Progress(
        SpinnerColumn(),
        TextColumn("[progress.description]{task.description}"),
        console=console,
    ) as progress:
        task = progress.add_task(f"Rendering via {backend_label}…", total=None)

        t_start = time.perf_counter()

        if use_gpu:
            try:
                # Attempt GPU path — import locally to avoid hard dep.
                from services.forward_worker.app.transpiler.ast_to_glsl import (  # type: ignore[import-untyped]
                    transpile,
                )
                from services.forward_worker.app.egl_renderer.headless_gl import (  # type: ignore[import-untyped]
                    HeadlessRenderer,
                )

                glsl_src = transpile(eq)
                renderer = HeadlessRenderer(width, height)
                pixels = renderer.render(glsl_src, t=time_val)
            except Exception as exc:
                console.print(
                    f"[yellow]GPU render failed ({exc}), falling back to CPU.[/yellow]"
                )
                pixels = _cpu_eval(eq, width, height, time_val)
        else:
            pixels = _cpu_eval(eq, width, height, time_val)

        elapsed = time.perf_counter() - t_start
        progress.update(task, completed=1, total=1)

    # --- Save ------------------------------------------------------------
    out.parent.mkdir(parents=True, exist_ok=True)
    img = Image.fromarray(pixels, mode="RGBA")
    img.save(str(out))

    # --- Stats -----------------------------------------------------------
    stats_table = Table(title="Render Statistics", show_header=False)
    stats_table.add_column("Key", style="bold")
    stats_table.add_column("Value")
    stats_table.add_row("Backend", backend_label)
    stats_table.add_row("Resolution", f"{width}×{height}")
    stats_table.add_row("Time", f"{elapsed:.3f} s")
    stats_table.add_row("Output", str(out.resolve()))
    console.print(stats_table)

    console.print("[bold green]✓ Render complete![/bold green]")


@app.command()
def extract(
    image: Path = typer.Option(
        ..., "--image", "-i", help="Input image file path.", exists=True
    ),
    out: Path = typer.Option(
        Path("equation.txt"),
        "--out",
        "-o",
        help="Output equation file path.",
    ),
) -> None:
    """Extract a mathematical equation from an image.

    .. note::

        This feature is planned for Phase 2 and is not yet implemented.
    """
    console.print(
        Panel(
            "[bold yellow]🚧  Coming in Phase 2[/bold yellow]\n\n"
            "Reverse extraction (image → equation) will use SIREN/KAN\n"
            "neural networks combined with PySR symbolic regression.",
            title="[bold]PixMath Extract[/bold]",
            border_style="yellow",
        )
    )


@app.command()
def info() -> None:
    """Display PixMath version, Python info, and available backends."""
    backends_table = Table(title="Available Backends", show_header=True)
    backends_table.add_column("Backend", style="bold")
    backends_table.add_column("Status")

    moderngl_ok = _check_moderngl()
    cuda_ok = _check_cuda()

    backends_table.add_row(
        "ModernGL (headless GPU)",
        "[green]available[/green]" if moderngl_ok else "[red]not installed[/red]",
    )
    backends_table.add_row(
        "CUDA (PyTorch)",
        "[green]available[/green]" if cuda_ok else "[dim]not available[/dim]",
    )

    info_panel = Panel(
        f"[bold cyan]Version:[/bold cyan]  {__version__}\n"
        f"[bold cyan]Python:[/bold cyan]   {sys.version}\n"
        f"[bold cyan]Platform:[/bold cyan] {platform.platform()}",
        title="[bold]PixMath Info[/bold]",
        border_style="blue",
    )
    console.print(info_panel)
    console.print(backends_table)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """CLI entry point (called by ``pixmath`` console script)."""
    app()


if __name__ == "__main__":
    main()
