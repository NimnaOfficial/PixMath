"""Pareto frontier selector with discrete-curvature elbow detection.

Given a set of (complexity, loss) pairs from a symbolic-regression Pareto
front, this module identifies the *elbow* — the point of maximum curvature
on the Pareto frontier — which represents the best complexity/accuracy
trade-off.

Typical usage::

    from app.pareto import ParetoSelector, find_pareto_elbow
    idx = find_pareto_elbow(complexities, losses)
"""

from __future__ import annotations

import dataclasses
import math


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------


@dataclasses.dataclass(frozen=True, slots=True)
class ParetoResult:
    """Result of a Pareto-elbow analysis.

    Attributes
    ----------
    frontier_indices:
        Indices (into the original list) of points on the Pareto frontier,
        sorted by ascending complexity.
    elbow_index:
        Index (into the original list) of the elbow point.
    elbow_complexity:
        Complexity value at the elbow.
    elbow_loss:
        Loss value at the elbow.
    """

    frontier_indices: list[int]
    elbow_index: int
    elbow_complexity: float
    elbow_loss: float


# ---------------------------------------------------------------------------
# Pareto Selector
# ---------------------------------------------------------------------------


class ParetoSelector:
    """Compute the Pareto frontier and locate the elbow.

    Parameters
    ----------
    points:
        A sequence of ``(complexity, loss)`` tuples.  Both objectives are
        *minimised* — a point dominates another if it is ≤ on both axes and
        strictly < on at least one.
    """

    def __init__(self, points: list[tuple[float, float]]) -> None:
        if not points:
            raise ValueError("At least one (complexity, loss) point is required.")
        self.points = list(points)

    # -- Pareto frontier ----------------------------------------------------

    def _compute_frontier(self) -> list[int]:
        """Return indices of Pareto-optimal points sorted by complexity.

        A point is Pareto-optimal if no other point has both lower-or-equal
        complexity **and** lower-or-equal loss (with at least one strict).
        """
        n = len(self.points)
        dominated = [False] * n

        for i in range(n):
            if dominated[i]:
                continue
            ci, li = self.points[i]
            for j in range(n):
                if i == j or dominated[j]:
                    continue
                cj, lj = self.points[j]
                # j dominates i?
                if cj <= ci and lj <= li and (cj < ci or lj < li):
                    dominated[i] = True
                    break

        frontier = [i for i in range(n) if not dominated[i]]
        # Sort by ascending complexity
        frontier.sort(key=lambda idx: self.points[idx][0])
        return frontier

    # -- Elbow via discrete curvature --------------------------------------

    @staticmethod
    def _discrete_curvature(
        p0: tuple[float, float],
        p1: tuple[float, float],
        p2: tuple[float, float],
    ) -> float:
        """Compute the discrete (Menger) curvature at *p1* given neighbours.

        The Menger curvature is ``4 * area(triangle) / (|a| * |b| * |c|)``
        where *a, b, c* are the side lengths.  A higher value means a
        sharper bend.
        """
        # Side vectors
        ax, ay = p1[0] - p0[0], p1[1] - p0[1]
        bx, by = p2[0] - p1[0], p2[1] - p1[1]
        cx, cy = p2[0] - p0[0], p2[1] - p0[1]

        # Twice the signed area of the triangle
        cross = abs(ax * by - ay * bx)
        a_len = math.hypot(ax, ay)
        b_len = math.hypot(bx, by)
        c_len = math.hypot(cx, cy)

        denom = a_len * b_len * c_len
        if denom < 1e-15:
            return 0.0
        return (4.0 * cross) / denom  # unsigned curvature

    def _find_elbow(self, frontier: list[int]) -> int:
        """Return the frontier index with the highest discrete curvature.

        If the frontier has ≤ 2 points, the point with the lowest loss is
        returned.
        """
        if len(frontier) <= 2:
            # Pick the one with the lowest loss
            return min(frontier, key=lambda idx: self.points[idx][1])

        # Normalise coordinates so that curvature is scale-invariant --------
        complexities = [self.points[i][0] for i in frontier]
        losses = [self.points[i][1] for i in frontier]

        c_min, c_max = min(complexities), max(complexities)
        l_min, l_max = min(losses), max(losses)
        c_range = c_max - c_min if c_max > c_min else 1.0
        l_range = l_max - l_min if l_max > l_min else 1.0

        normalised = [
            ((c - c_min) / c_range, (l - l_min) / l_range)
            for c, l in zip(complexities, losses, strict=True)
        ]

        # Compute curvature at each interior point -------------------------
        best_curv = -1.0
        best_idx = frontier[0]
        for k in range(1, len(frontier) - 1):
            curv = self._discrete_curvature(
                normalised[k - 1], normalised[k], normalised[k + 1]
            )
            if curv > best_curv:
                best_curv = curv
                best_idx = frontier[k]

        return best_idx

    # -- Public API ---------------------------------------------------------

    def select(self) -> ParetoResult:
        """Compute the Pareto frontier and locate the elbow point.

        Returns
        -------
        ParetoResult
        """
        frontier = self._compute_frontier()
        elbow_idx = self._find_elbow(frontier)
        c, l = self.points[elbow_idx]
        return ParetoResult(
            frontier_indices=frontier,
            elbow_index=elbow_idx,
            elbow_complexity=c,
            elbow_loss=l,
        )


# ---------------------------------------------------------------------------
# Convenience function
# ---------------------------------------------------------------------------


def find_pareto_elbow(
    complexities: list[float],
    losses: list[float],
) -> int:
    """Find the elbow index on the Pareto frontier.

    Parameters
    ----------
    complexities:
        Complexity values for each candidate equation.
    losses:
        Corresponding loss values.

    Returns
    -------
    int:
        Index (into the original lists) of the Pareto-optimal elbow point.

    Raises
    ------
    ValueError:
        If the input lists are empty or of different lengths.
    """
    if len(complexities) != len(losses):
        raise ValueError(
            f"Lengths differ: complexities={len(complexities)}, "
            f"losses={len(losses)}"
        )
    points = list(zip(complexities, losses, strict=True))
    selector = ParetoSelector(points)
    result = selector.select()
    return result.elbow_index
