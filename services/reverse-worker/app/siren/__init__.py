"""SIREN sub-package — Sinusoidal Representation Network.

Re-exports
----------
SIREN : nn.Module
    The SIREN network class.
train_siren : callable
    Training helper that fits a SIREN to an image array.
"""

from __future__ import annotations

from app.siren.network import SIREN, train_siren

__all__ = ["SIREN", "train_siren"]
