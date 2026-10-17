"""Pareto frontier selector sub-package.

Re-exports
----------
ParetoSelector : class
    Computes the Pareto frontier and locates the elbow.
find_pareto_elbow : callable
    Convenience function returning just the elbow index.
"""

from __future__ import annotations

from app.pareto.selector import ParetoSelector, find_pareto_elbow

__all__ = ["ParetoSelector", "find_pareto_elbow"]
