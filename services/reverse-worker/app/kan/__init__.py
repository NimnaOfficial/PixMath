"""KAN sub-package — Kolmogorov-Arnold Network with B-spline activations.

Re-exports
----------
KAN : nn.Module
    The KAN network class.
train_kan : callable
    Training helper that fits a KAN to an image array.
"""

from __future__ import annotations

from app.kan.spline_net import KAN, train_kan

__all__ = ["KAN", "train_kan"]
