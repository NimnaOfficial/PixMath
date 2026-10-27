"""DLX Monitor — dead-letter exchange watcher for the PixMath pipeline.

Connects to the RabbitMQ dead-letter exchange, logs diagnostic details
about failed jobs via ``structlog``, and optionally re-queues messages
with an exponentially bounded retry policy (max 3 attempts).
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from typing import Any

import aio_pika
import structlog
from aio_pika.abc import (
    AbstractChannel,
    AbstractIncomingMessage,
    AbstractQueue,
)
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings

# ---------------------------------------------------------------------------
# structlog configuration
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log: structlog.stdlib.BoundLogger = structlog.get_logger("dlx-monitor")  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class DLXMonitorSettings(BaseSettings):
    """Configuration for the DLX monitor, loaded from environment variables."""

    rabbitmq_url: str = Field(
        default="amqp://pixmath:pixmath@localhost:5672/",
        validation_alias=AliasChoices("RABBITMQ_URL", "DLX_RABBITMQ_URL"),
    )
    dlx_exchange: str = Field(
        default="pixmath.dlx",
        validation_alias=AliasChoices("RABBITMQ_DLX_EXCHANGE", "DLX_EXCHANGE"),
    )
    dlx_queue: str = Field(
        default="pixmath.dlx.queue",
        validation_alias=AliasChoices("RABBITMQ_DLX_QUEUE", "DLX_QUEUE"),
    )
    max_retries: int = 3
    retry_enabled: bool = True

    model_config = {"env_file": ".env", "extra": "ignore"}


# ---------------------------------------------------------------------------
# Message handler
# ---------------------------------------------------------------------------

async def _handle_dead_letter(
    message: AbstractIncomingMessage,
    settings: DLXMonitorSettings,
    channel: AbstractChannel,
) -> None:
    """Process a single dead-lettered message.

    Logs the failure details and optionally re-queues the message to its
    original queue if retries remain.

    Args:
        message: The dead-lettered AMQP message.
        settings: Monitor configuration.
        channel: Active RabbitMQ channel (used for re-publishing).
    """
    async with message.process(requeue=False):
        # ----- Parse payload ---------------------------------------------
        try:
            payload: dict[str, Any] = json.loads(message.body.decode())
        except (json.JSONDecodeError, UnicodeDecodeError):
            payload = {"_raw": message.body.hex()}

        job_id: str = payload.get("job_id", message.message_id or "unknown")

        # ----- Extract x-death headers ----------------------------------
        headers = message.headers or {}
        x_death: list[dict[str, Any]] = headers.get("x-death", [])

        original_queue: str = "unknown"
        death_reason: str = "unknown"
        if x_death:
            first_death = x_death[0] if isinstance(x_death[0], dict) else {}
            original_queue = str(first_death.get("queue", "unknown"))
            death_reason = str(first_death.get("reason", "unknown"))

        retry_count: int = int(headers.get("x-retry-count", 0))

        # ----- Log -------------------------------------------------------
        log.error(
            "dead_letter_received",
            job_id=job_id,
            original_queue=original_queue,
            death_reason=death_reason,
            retry_count=retry_count,
            timestamp=datetime.now(timezone.utc).isoformat(),
            payload_keys=list(payload.keys()),
        )

        # ----- Optional retry -------------------------------------------
        if settings.retry_enabled and retry_count < settings.max_retries:
            new_retry_count = retry_count + 1
            log.info(
                "requeue_attempt",
                job_id=job_id,
                retry=new_retry_count,
                max_retries=settings.max_retries,
                target_queue=original_queue,
            )

            retry_message = aio_pika.Message(
                body=message.body,
                content_type=message.content_type or "application/json",
                message_id=message.message_id,
                headers={
                    **headers,
                    "x-retry-count": new_retry_count,
                },
                delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
            )

            await channel.default_exchange.publish(
                retry_message,
                routing_key=original_queue,
            )

            log.info(
                "requeued_successfully",
                job_id=job_id,
                retry=new_retry_count,
                target_queue=original_queue,
            )
        else:
            if retry_count >= settings.max_retries:
                log.warning(
                    "max_retries_exceeded",
                    job_id=job_id,
                    retry_count=retry_count,
                    max_retries=settings.max_retries,
                )
            else:
                log.info(
                    "retry_disabled_dropping",
                    job_id=job_id,
                )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    """Connect to RabbitMQ DLX and consume dead-lettered messages.

    This function runs indefinitely until interrupted.
    """
    settings = DLXMonitorSettings()

    log.info(
        "dlx_monitor_starting",
        rabbitmq_url=settings.rabbitmq_url,
        dlx_exchange=settings.dlx_exchange,
        dlx_queue=settings.dlx_queue,
        retry_enabled=settings.retry_enabled,
        max_retries=settings.max_retries,
    )

    while True:
        try:
            connection = await aio_pika.connect_robust(settings.rabbitmq_url)
            log.info("rabbitmq_connected")

            async with connection:
                channel: AbstractChannel = await connection.channel()
                await channel.set_qos(prefetch_count=10)

                # Declare the DLX exchange and queue.
                dlx_exchange = await channel.declare_exchange(
                    settings.dlx_exchange,
                    aio_pika.ExchangeType.FANOUT,
                    durable=True,
                )

                dlx_queue: AbstractQueue = await channel.declare_queue(
                    settings.dlx_queue,
                    durable=True,
                )
                await dlx_queue.bind(dlx_exchange)

                log.info(
                    "dlx_queue_bound",
                    exchange=settings.dlx_exchange,
                    queue=settings.dlx_queue,
                )

                # Consume messages.
                async with dlx_queue.iterator() as queue_iter:
                    log.info("consuming_dead_letters")
                    async for message in queue_iter:
                        try:
                            await _handle_dead_letter(message, settings, channel)
                        except Exception:
                            log.exception(
                                "handler_error",
                                message_id=message.message_id,
                            )
        except asyncio.CancelledError:
            break
        except Exception as exc:
            log.warning("rabbitmq_offline_standalone", error=str(exc))
            try:
                await asyncio.sleep(3.0)
            except asyncio.CancelledError:
                break


# ---------------------------------------------------------------------------
# Script entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        log.info("dlx_monitor_stopped_by_user")
        sys.exit(0)
