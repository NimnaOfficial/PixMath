"""SIREN (Sinusoidal Representation Network) for image fitting.

Implements the architecture from *Implicit Neural Representations with
Periodic Activation Functions* (Sitzmann et al., NeurIPS 2020).  A SIREN
maps 2-D pixel coordinates to RGB colour values using sine non-linearities
with carefully chosen frequency factors (``omega_0``) and weight
initialisation.

Typical usage::

    from app.siren import SIREN, train_siren
    model = train_siren(image_array, epochs=500, lr=1e-4, omega_0=30.0)
"""

from __future__ import annotations

import math
from typing import TYPE_CHECKING

import numpy as np
import torch
import torch.nn as nn
from numpy.typing import NDArray
from torch import Tensor

if TYPE_CHECKING:
    pass


# ---------------------------------------------------------------------------
# Layer
# ---------------------------------------------------------------------------


class SineLayer(nn.Module):
    """Single linear layer followed by a sine activation.

    Parameters
    ----------
    in_features:
        Number of input features.
    out_features:
        Number of output features.
    omega_0:
        Frequency multiplier applied before the sine.  Controls the
        bandwidth of the represented signal.
    is_first:
        If ``True`` the layer uses the first-layer initialisation
        scheme (uniform in ``[-1/n, 1/n]``).  Otherwise the hidden-layer
        scheme is used.
    """

    def __init__(
        self,
        in_features: int,
        out_features: int,
        omega_0: float = 30.0,
        is_first: bool = False,
    ) -> None:
        super().__init__()
        self.omega_0 = omega_0
        self.is_first = is_first
        self.in_features = in_features

        self.linear = nn.Linear(in_features, out_features)
        self._init_weights()

    # -- Initialisation per the SIREN paper --------------------------------

    def _init_weights(self) -> None:
        """Initialise weights according to the SIREN paper.

        * **First layer** – uniform in ``[-1/n, 1/n]`` where *n* is the
          number of input features.
        * **Hidden layers** – uniform in
          ``[-sqrt(6/n) / omega_0, sqrt(6/n) / omega_0]``.
        """
        with torch.no_grad():
            if self.is_first:
                bound = 1.0 / self.in_features
            else:
                bound = math.sqrt(6.0 / self.in_features) / self.omega_0
            self.linear.weight.uniform_(-bound, bound)

    # -- Forward ------------------------------------------------------------

    def forward(self, x: Tensor) -> Tensor:
        """Apply ``sin(omega_0 * Wx + b)``."""
        return torch.sin(self.omega_0 * self.linear(x))

    def __repr__(self) -> str:  # pragma: no cover
        return (
            f"{self.__class__.__name__}("
            f"in={self.in_features}, out={self.linear.out_features}, "
            f"ω₀={self.omega_0}, first={self.is_first})"
        )


# ---------------------------------------------------------------------------
# Full SIREN model
# ---------------------------------------------------------------------------


class SIREN(nn.Module):
    """Sinusoidal Representation Network.

    Parameters
    ----------
    in_features:
        Dimensionality of the input coordinates (default ``2`` for *x, y*).
    hidden_features:
        Width of each hidden layer.
    hidden_layers:
        Number of hidden ``SineLayer`` blocks.
    out_features:
        Dimensionality of the output signal (default ``3`` for RGB).
    first_omega_0:
        Frequency factor for the first ``SineLayer``.
    hidden_omega_0:
        Frequency factor for every subsequent ``SineLayer``.
    """

    def __init__(
        self,
        in_features: int = 2,
        hidden_features: int = 256,
        hidden_layers: int = 3,
        out_features: int = 3,
        first_omega_0: float = 30.0,
        hidden_omega_0: float = 30.0,
    ) -> None:
        super().__init__()

        self.in_features = in_features
        self.out_features = out_features

        layers: list[nn.Module] = []

        # First layer ----------------------------------------------------------
        layers.append(
            SineLayer(
                in_features,
                hidden_features,
                omega_0=first_omega_0,
                is_first=True,
            )
        )

        # Hidden layers --------------------------------------------------------
        for _ in range(hidden_layers):
            layers.append(
                SineLayer(
                    hidden_features,
                    hidden_features,
                    omega_0=hidden_omega_0,
                    is_first=False,
                )
            )

        self.net = nn.Sequential(*layers)

        # Final linear projection (no sine) ------------------------------------
        self.final_linear = nn.Linear(hidden_features, out_features)
        with torch.no_grad():
            bound = math.sqrt(6.0 / hidden_features) / hidden_omega_0
            self.final_linear.weight.uniform_(-bound, bound)

    # -- Forward ---------------------------------------------------------------

    def forward(self, coords: Tensor) -> Tensor:
        """Map coordinates to colour values.

        Parameters
        ----------
        coords:
            Tensor of shape ``(N, 2)`` with normalised *x, y* coordinates
            in ``[-1, 1]``.

        Returns
        -------
        Tensor:
            Predicted colour values of shape ``(N, 3)`` (RGB in ``[0, 1]``
            after sigmoid).
        """
        return torch.sigmoid(self.final_linear(self.net(coords)))


# ---------------------------------------------------------------------------
# Coordinate grid helper
# ---------------------------------------------------------------------------


def _make_coord_grid(height: int, width: int, device: str | torch.device) -> Tensor:
    """Create a normalised ``[-1, 1]`` coordinate grid.

    Returns a tensor of shape ``(H*W, 2)`` where each row is ``(x, y)``.
    """
    ys = torch.linspace(-1.0, 1.0, height, device=device)
    xs = torch.linspace(-1.0, 1.0, width, device=device)
    grid_y, grid_x = torch.meshgrid(ys, xs, indexing="ij")
    coords = torch.stack([grid_x.reshape(-1), grid_y.reshape(-1)], dim=-1)
    return coords


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------


def train_siren(
    image: NDArray[np.floating],
    epochs: int = 500,
    lr: float = 1e-4,
    omega_0: float = 30.0,
    device: str = "cpu",
    *,
    hidden_features: int = 256,
    hidden_layers: int = 3,
    log_every: int = 50,
) -> SIREN:
    """Train a SIREN to fit a single image.

    Parameters
    ----------
    image:
        Input image as a NumPy array of shape ``(H, W, 3)`` with values in
        ``[0, 1]`` (float) **or** ``[0, 255]`` (uint8).
    epochs:
        Number of training iterations.
    lr:
        Learning rate for the Adam optimiser.
    omega_0:
        Frequency factor used for both the first and hidden layers.
    device:
        PyTorch device string (e.g. ``"cpu"`` or ``"cuda"``).
    hidden_features:
        Width of each hidden layer.
    hidden_layers:
        Number of hidden sine layers.
    log_every:
        Print loss every *n* epochs.  Set to ``0`` to silence.

    Returns
    -------
    SIREN:
        The trained network (moved to CPU, in eval mode).

    Raises
    ------
    ValueError:
        If *image* does not have 3 colour channels.
    """
    if image.ndim != 3 or image.shape[2] != 3:
        raise ValueError(
            f"Expected image of shape (H, W, 3), got {image.shape}"
        )

    # Normalise to [0, 1] float32 ------------------------------------------
    img = image.astype(np.float32)
    if img.max() > 1.0:
        img = img / 255.0

    height, width, _ = img.shape

    # Prepare tensors -------------------------------------------------------
    coords = _make_coord_grid(height, width, device)
    pixels = torch.from_numpy(img.reshape(-1, 3)).to(device)

    # Build model -----------------------------------------------------------
    model = SIREN(
        in_features=2,
        hidden_features=hidden_features,
        hidden_layers=hidden_layers,
        out_features=3,
        first_omega_0=omega_0,
        hidden_omega_0=omega_0,
    ).to(device)

    optimiser = torch.optim.Adam(model.parameters(), lr=lr)
    loss_fn = nn.MSELoss()

    # Training loop ---------------------------------------------------------
    model.train()
    for epoch in range(1, epochs + 1):
        pred = model(coords)
        loss = loss_fn(pred, pixels)

        optimiser.zero_grad()
        loss.backward()
        optimiser.step()

        if log_every and epoch % log_every == 0:
            psnr = -10.0 * math.log10(loss.item() + 1e-10)
            print(f"[SIREN] epoch {epoch:>5}/{epochs}  loss={loss.item():.6f}  PSNR={psnr:.2f} dB")

    # Return on CPU in eval mode -------------------------------------------
    model.eval()
    model.cpu()
    return model
