"""PixMath API Gateway application package.

This package provides the FastAPI-based API gateway for the PixMath project,
including REST endpoints, GraphQL schema, and WebSocket pub/sub handlers
for real-time job progress tracking.
"""

from __future__ import annotations

from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)
