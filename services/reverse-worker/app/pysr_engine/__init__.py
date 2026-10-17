"""PySR symbolic-regression engine sub-package.

Re-exports
----------
SymbolicExtractor : class
    Samples a trained model and runs PySR per colour channel.
run_symbolic_regression : callable
    One-shot convenience wrapper.
"""

from __future__ import annotations

from app.pysr_engine.symbolic import SymbolicExtractor, run_symbolic_regression

__all__ = ["SymbolicExtractor", "run_symbolic_regression"]
