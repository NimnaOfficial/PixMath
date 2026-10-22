"""PixMath reverse-worker application package.

This service consumes image-reverse-engineering jobs from a RabbitMQ queue,
trains a neural implicit representation (SIREN or KAN), applies PySR
symbolic regression to extract closed-form equations, and publishes the
results back through the message broker.
"""

from __future__ import annotations

from pkgutil import extend_path

__path__ = extend_path(__path__, __name__)

