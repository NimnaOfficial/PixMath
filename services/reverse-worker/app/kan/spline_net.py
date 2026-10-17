"""Kolmogorov-Arnold Network (KAN) with learnable B-spline activations.

This module provides a KAN variant that replaces fixed activation functions
with *learnable* univariate B-spline curves.  The interface mirrors the
companion :mod:`app.siren` module so that either network can be used
interchangeably in the reverse-engineering pipeline.

References
----------
* Liu et al., *KAN: Kolmogorov-Arnold Networks*, 2024.

Typical usage::

    from app.kan import KAN, train_kan
    model = train_kan(image_array, epochs=500, lr=1e-3)
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F  # noqa: N812
from numpy.typing import NDArray
from torch import Tensor

if TYPE_CHECKING:
    pass


# ---------------------------------------------------------------------------
# B-spline activation
# ---------------------------------------------------------------------------


class BSplineActivation(nn.Module):
    """Learnable 1-D B-spline activation function.

    For each *output* feature the activation is parameterised by a set of
    control-point coefficients that are combined via a B-spline basis of
    the chosen ``order``.

    Parameters
    ----------
    num_features:
        Number of features (each gets its own independent spline).
    num_knots:
        Number of interior knot intervals (the actual knot vector has
        ``num_knots + 2 * order`` entries to cover the boundary).
    order:
        B-spline order (``3`` = cubic, the default).
    grid_range:
        Tuple ``(lo, hi)`` defining the active range of the spline grid.
    """

    def __init__(
        self,
        num_features: int,
        num_knots: int = 8,
        order: int = 3,
        grid_range: tuple[float, float] = (-1.0, 1.0),
    ) -> None:
        super().__init__()
        self.order = order
        self.num_features = num_features
        self.num_knots = num_knots

        # Build uniform knot vector ----------------------------------------
        lo, hi = grid_range
        step = (hi - lo) / num_knots
        # Extend knots on both sides by `order` intervals for clamping.
        knots = torch.linspace(
            lo - order * step,
            hi + order * step,
            num_knots + 2 * order + 1,
        )
        self.register_buffer("knots", knots)

        # Learnable control-point coefficients: (num_features, num_bases)
        num_bases = num_knots + order
        self.coeffs = nn.Parameter(
            torch.randn(num_features, num_bases) * 0.1
        )

    # -- B-spline basis evaluation (Cox-de Boor iterative) -----------------

    def _bspline_basis(self, x: Tensor) -> Tensor:
        """Evaluate B-spline bases for each value in *x*.

        Parameters
        ----------
        x:
            Tensor of shape ``(...,)`` — arbitrary leading dimensions.

        Returns
        -------
        Tensor:
            Shape ``(..., num_bases)`` with basis values.
        """
        knots = self.knots  # (K,)
        # Order-0 bases: indicator functions on knot intervals
        # Shape: (..., K-1)
        bases = ((x.unsqueeze(-1) >= knots[:-1]) & (x.unsqueeze(-1) < knots[1:])).float()

        # Iterative elevation to target order
        for p in range(1, self.order + 1):
            # left term
            d_left = knots[p:-(self.order - p) or None] - knots[: -(self.order + 1) + (self.order - p) or None]
            # To avoid constructing awkward slices, compute via explicit
            # index arithmetic.
            k = knots.shape[0]
            n_bases = k - 1 - p  # number of bases at this level
            left_num = x.unsqueeze(-1) - knots[:n_bases]
            left_den = knots[p : p + n_bases] - knots[:n_bases]
            left_den = left_den.clamp(min=1e-8)
            left = left_num / left_den * bases[..., :n_bases]

            right_num = knots[p + 1 : p + 1 + n_bases] - x.unsqueeze(-1)
            right_den = knots[p + 1 : p + 1 + n_bases] - knots[1 : 1 + n_bases]
            right_den = right_den.clamp(min=1e-8)
            right = right_num / right_den * bases[..., 1 : 1 + n_bases]

            bases = left + right

        return bases  # (..., num_bases)

    # -- Forward -----------------------------------------------------------

    def forward(self, x: Tensor) -> Tensor:
        """Apply the learnable spline activation element-wise.

        Parameters
        ----------
        x:
            Input tensor of shape ``(B, num_features)``.

        Returns
        -------
        Tensor:
            Same shape as *x*, after spline transformation.
        """
        # x: (B, F) → bases: (B, F, num_bases) — evaluate per feature
        # We evaluate the basis for each feature independently.
        out_parts: list[Tensor] = []
        for i in range(self.num_features):
            basis = self._bspline_basis(x[:, i])  # (B, num_bases)
            val = (basis * self.coeffs[i]).sum(dim=-1, keepdim=True)  # (B, 1)
            out_parts.append(val)
        return torch.cat(out_parts, dim=-1)  # (B, F)


# ---------------------------------------------------------------------------
# KAN Layer
# ---------------------------------------------------------------------------


class KANLayer(nn.Module):
    """A single KAN layer: linear projection + B-spline activation + residual.

    Parameters
    ----------
    in_features:
        Input dimensionality.
    out_features:
        Output dimensionality.
    num_knots:
        Knot intervals for the spline activations.
    spline_order:
        B-spline order.
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        num_knots: int = 8,
        spline_order: int = 3,
    ) -> None:
        super().__init__()
        self.linear = nn.Linear(in_features, out_features)
        self.activation = BSplineActivation(
            num_features=out_features,
            num_knots=num_knots,
            order=spline_order,
        )
        # Residual shortcut (SiLU base function as in the KAN paper)
        self.residual_weight = nn.Parameter(torch.ones(out_features) * 0.1)

    def forward(self, x: Tensor) -> Tensor:
        """Forward pass with spline activation and SiLU residual."""
        h = self.linear(x)
        spline_out = self.activation(h)
        residual = F.silu(h) * self.residual_weight
        return spline_out + residual


# ---------------------------------------------------------------------------
# Full KAN model
# ---------------------------------------------------------------------------


class KAN(nn.Module):
    """Kolmogorov-Arnold Network for coordinate → RGB mapping.

    Parameters
    ----------
    in_features:
        Number of input dimensions (default ``2`` for *x, y*).
    hidden_features:
        Width of each hidden layer.
    hidden_layers:
        Number of hidden ``KANLayer`` blocks.
    out_features:
        Output dimensions (default ``3`` for RGB).
    num_knots:
        Knot intervals for the B-spline activations.
    spline_order:
        B-spline order.
    """

    def __init__(
        self,
        in_features: int = 2,
        hidden_features: int = 128,
        hidden_layers: int = 3,
        out_features: int = 3,
        num_knots: int = 8,
        spline_order: int = 3,
    ) -> None:
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features

        layers: list[nn.Module] = []

        # Input → first hidden
        layers.append(
            KANLayer(in_features, hidden_features, num_knots, spline_order)
        )

        # Hidden → hidden
        for _ in range(hidden_layers - 1):
            layers.append(
                KANLayer(hidden_features, hidden_features, num_knots, spline_order)
            )

        self.net = nn.Sequential(*layers)

        # Final projection — plain linear + sigmoid
        self.final_linear = nn.Linear(hidden_features, out_features)
        nn.init.xavier_uniform_(self.final_linear.weight)

    def forward(self, coords: Tensor) -> Tensor:
        """Map normalised coordinates to RGB.

        Parameters
        ----------
        coords:
            Shape ``(N, 2)`` with values in ``[-1, 1]``.

        Returns
        -------
        Tensor:
            Predicted colours of shape ``(N, 3)`` in ``[0, 1]``.
        """
        return torch.sigmoid(self.final_linear(self.net(coords)))


# ---------------------------------------------------------------------------
# Coordinate helper (shared logic with SIREN but duplicated for decoupling)
# ---------------------------------------------------------------------------


def _make_coord_grid(height: int, width: int, device: str | torch.device) -> Tensor:
    """Create a normalised ``[-1, 1]`` coordinate grid of shape ``(H*W, 2)``."""
    ys = torch.linspace(-1.0, 1.0, height, device=device)
    xs = torch.linspace(-1.0, 1.0, width, device=device)
    grid_y, grid_x = torch.meshgrid(ys, xs, indexing="ij")
    return torch.stack([grid_x.reshape(-1), grid_y.reshape(-1)], dim=-1)


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def train_kan(
    image: NDArray[np.floating],
    epochs: int = 500,
    lr: float = 1e-3,
    device: str = "cpu",
    *,
    hidden_features: int = 128,
    hidden_layers: int = 3,
    num_knots: int = 8,
    spline_order: int = 3,
    log_every: int = 50,
) -> KAN:
    """Train a KAN to fit a single image.

    Parameters
    ----------
    image:
        NumPy array of shape ``(H, W, 3)`` in ``[0, 1]`` or ``[0, 255]``.
    epochs:
        Training iterations.
    lr:
        Learning rate for AdamW.
    device:
        PyTorch device string.
    hidden_features:
        Hidden layer width.
    hidden_layers:
        Number of hidden KAN layers.
    num_knots:
        B-spline knot intervals.
    spline_order:
        B-spline order.
    log_every:
        Print interval (``0`` to silence).

    Returns
    -------
    KAN:
        Trained model on CPU in eval mode.

    Raises
    ------
    ValueError:
        If *image* shape is not ``(H, W, 3)``.
    """
    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError(f"Expected image of shape (H, W, 3), got {image.shape}")

    img = image.astype(np.float32)
    if img.max() > 1.0:
        img = img / 255.0

    height, width, _ = img.shape
    coords = _make_coord_grid(height, width, device)
    pixels = torch.from_numpy(img.reshape(-1, 3)).to(device)

    model = KAN(
        in_features=2,
        hidden_features=hidden_features,
        hidden_layers=hidden_layers,
        out_features=3,
        num_knots=num_knots,
        spline_order=spline_order,
    ).to(device)

    optimiser = torch.optim.AdamW(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    model.train()
    for epoch in range(1, epochs + 1):
        pred = model(coords)
        loss = loss_fn(pred, pixels)

        optimiser.zero_grad()
        loss.backward()
        optimiser.step()

        if log_every and epoch % log_every == 0:
            psnr = -10.0 * math.log10(loss.item() + 1e-10)
            print(
                f"[KAN] epoch {epoch:>5}/{epochs}  "
                f"loss={loss.item():.6f}  PSNR={psnr:.2f} dB"
            )

    model.eval()
    model.cpu()
    return model
