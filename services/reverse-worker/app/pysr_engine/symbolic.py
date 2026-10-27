"""PySR symbolic-regression engine for extracting equations from neural networks.

This module bridges the trained implicit neural representation (SIREN or KAN)
with the PySR symbolic-regression library.  It samples the trained network on
a coordinate grid, then fits closed-form expressions to each colour channel
independently, returning the Pareto front of complexity-vs-accuracy trade-offs.

Typical usage::

    from app.pysr_engine import SymbolicExtractor, run_symbolic_regression
    result = run_symbolic_regression(trained_model, resolution=64)
    print(result.best_equation)
"""

from __future__ import annotations

import dataclasses
import logging
from typing import Any

import numpy as np
import torch
import torch.nn as nn
from numpy.typing import NDArray

logger = logging.getLogger(__name__)

# PySR is heavy — import lazily at call-site to reduce startup cost.


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True, slots=True)
class PySRResult:
    """Container for symbolic-regression output.

    Attributes
    ----------
    equations:
        Per-channel list of equation strings from the Pareto front.
        ``equations[c]`` is a list of candidate expressions for channel *c*.
    complexities:
        Per-channel list of complexity values matching *equations*.
    losses:
        Per-channel list of loss values matching *equations*.
    best_equation:
        Best single equation string (from the elbow or simplest adequate
        fit) for each channel, joined by ``" ; "``.
    best_latex:
        LaTeX representation of *best_equation* for each channel,
        joined by ``" ; "``.
    """

    equations: list[list[str]]
    complexities: list[list[float]]
    losses: list[list[float]]
    best_equation: str
    best_latex: str


# ---------------------------------------------------------------------------
# Coordinate grid helper
# ---------------------------------------------------------------------------


def _make_coord_grid(resolution: int) -> NDArray[np.float32]:
    """Return a ``(resolution**2, 2)`` array of normalised ``[-1, 1]`` coords.

    Aligns with SIREN / KAN coordinate conventions:
    Column 0 is horizontal x (column index), Column 1 is vertical y (row index).
    """
    lin = np.linspace(-1.0, 1.0, resolution, dtype=np.float32)
    gy, gx = np.meshgrid(lin, lin, indexing="ij")
    return np.stack([gx.ravel(), gy.ravel()], axis=-1)


# ---------------------------------------------------------------------------
# Symbolic Extractor
# ---------------------------------------------------------------------------


class SymbolicExtractor:
    """Extract symbolic expressions from a trained coordinate-based network.

    Parameters
    ----------
    model:
        A trained ``nn.Module`` that maps ``(N, 2)`` → ``(N, 3)``.
    resolution:
        Side length of the square sampling grid.  A resolution of 64 yields
        4 096 data points which is usually enough for PySR.
    """

    def __init__(self, model: nn.Module, resolution: int = 64) -> None:
        self.model = model
        self.resolution = resolution
        self._coords: NDArray[np.float32] | None = None
        self._targets: NDArray[np.float32] | None = None

    # -- Data preparation ---------------------------------------------------

    def _sample(self) -> tuple[NDArray[np.float32], NDArray[np.float32]]:
        """Sample the model on a coordinate grid.

        Returns
        -------
        coords:
            ``(N, 2)`` input coordinates.
        targets:
            ``(N, 3)`` predicted RGB values from the model.
        """
        if self._coords is not None and self._targets is not None:
            return self._coords, self._targets

        coords = _make_coord_grid(self.resolution)
        coords_tensor = torch.from_numpy(coords)

        self.model.eval()
        with torch.no_grad():
            preds = self.model(coords_tensor).cpu().numpy().astype(np.float32)

        self._coords = coords
        self._targets = preds
        return coords, preds

    # -- Regression ---------------------------------------------------------

    def run(
        self,
        *,
        niterations: int = 40,
        populations: int = 30,
        maxsize: int = 25,
        binary_operators: list[str] | None = None,
        unary_operators: list[str] | None = None,
        extra_pysr_kwargs: dict[str, Any] | None = None,
    ) -> PySRResult:
        """Run PySR on each colour channel independently.

        Parameters
        ----------
        niterations:
            Number of PySR evolutionary iterations.
        populations:
            Number of independent populations.
        maxsize:
            Maximum expression-tree size.
        binary_operators:
            Binary operators to search over (default:
            ``["+", "-", "*", "/"]``).
        unary_operators:
            Unary operators to search over (default:
            ``["sin", "cos", "exp", "sqrt", "abs"]``).
        extra_pysr_kwargs:
            Additional keyword arguments forwarded to
            :class:`pysr.PySRRegressor`.

        Returns
        -------
        PySRResult:
            Aggregated results across all three channels.
        """
        # Lazy import to avoid loading Julia until actually needed.
        from pysr import PySRRegressor  # type: ignore[import-untyped]

        if binary_operators is None:
            binary_operators = ["+", "-", "*", "/"]
        if unary_operators is None:
            unary_operators = ["sin", "cos", "exp", "sqrt", "abs"]

        coords, targets = self._sample()

        all_equations: list[list[str]] = []
        all_complexities: list[list[float]] = []
        all_losses: list[list[float]] = []
        best_eqs: list[str] = []
        best_latexs: list[str] = []

        channel_names = ("R", "G", "B")

        for ch_idx, ch_name in enumerate(channel_names):
            logger.info("Running PySR for channel %s …", ch_name)

            y_channel = targets[:, ch_idx]

            pysr_kwargs: dict[str, Any] = {
                "niterations": niterations,
                "populations": populations,
                "maxsize": maxsize,
                "binary_operators": binary_operators,
                "unary_operators": unary_operators,
                "variable_names": ["x", "y"],
                "progress": True,
                "verbosity": 0,
            }
            if extra_pysr_kwargs:
                pysr_kwargs.update(extra_pysr_kwargs)

            regressor = PySRRegressor(**pysr_kwargs)
            regressor.fit(coords, y_channel)

            # Extract Pareto front from the fitted model --------------------
            eqs_df = regressor.equations_  # pandas DataFrame
            eq_strs: list[str] = eqs_df["equation"].tolist()
            complexities: list[float] = eqs_df["complexity"].tolist()
            losses: list[float] = eqs_df["loss"].tolist()

            all_equations.append(eq_strs)
            all_complexities.append(complexities)
            all_losses.append(losses)

            # PySR's best is the model-selected row
            best_idx = int(eqs_df["loss"].idxmin())
            best_eqs.append(eq_strs[best_idx])

            # Try to get LaTeX; fall back to raw string
            try:
                best_latexs.append(regressor.latex())
            except Exception:  # noqa: BLE001
                best_latexs.append(eq_strs[best_idx])

            logger.info(
                "Channel %s best: %s (loss=%.6f)",
                ch_name,
                eq_strs[best_idx],
                losses[best_idx],
            )

        return PySRResult(
            equations=all_equations,
            complexities=all_complexities,
            losses=all_losses,
            best_equation=" ; ".join(best_eqs),
            best_latex=" ; ".join(best_latexs),
        )


# ---------------------------------------------------------------------------
# Convenience wrapper
# ---------------------------------------------------------------------------


def run_symbolic_regression(
    model: nn.Module,
    resolution: int = 64,
    **pysr_kwargs: Any,
) -> PySRResult:
    """One-shot helper: sample *model* and run PySR.

    Parameters
    ----------
    model:
        Trained coordinate → RGB network.
    resolution:
        Sampling grid side length.
    **pysr_kwargs:
        Forwarded to :meth:`SymbolicExtractor.run`.

    Returns
    -------
    PySRResult
    """
    extractor = SymbolicExtractor(model, resolution=resolution)
    return extractor.run(**pysr_kwargs)
