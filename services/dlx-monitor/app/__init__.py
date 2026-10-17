"""PixMath DLX Monitor service.

Watches the RabbitMQ dead-letter exchange for failed jobs, logs
diagnostic information via structlog, and optionally re-queues
messages with a bounded retry policy.
"""

from __future__ import annotations
