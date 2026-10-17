"""Strawberry GraphQL schema for the PixMath API Gateway.

Defines Query, Mutation, and Subscription types that interact with
Redis (state) and RabbitMQ (job dispatch).  The subscription uses
Redis Pub/Sub to stream progress updates to clients over GraphQL
subscriptions (SSE / WebSocket transport).
"""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, AsyncGenerator

import aio_pika
import strawberry
from strawberry.types import Info

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Queue / Redis key constants
# ---------------------------------------------------------------------------

FORWARD_QUEUE = "forward_jobs"
REVERSE_QUEUE = "reverse_jobs"
JOB_TTL_SECONDS: int = 60 * 60 * 24


# ---------------------------------------------------------------------------
# Strawberry types
# ---------------------------------------------------------------------------

@strawberry.type
class Job:
    """Represents a submitted processing job."""

    job_id: str
    status: str
    progress: float
    error: str | None = None


@strawberry.type
class RenderResult:
    """Result of a successfully submitted render request."""

    job_id: str
    status: str
    submitted_at: str


@strawberry.type
class ExtractionResult:
    """Result of a successfully submitted extraction request."""

    job_id: str
    status: str
    submitted_at: str


@strawberry.type
class ProgressUpdate:
    """A single progress tick streamed via subscription."""

    job_id: str
    status: str
    progress: float
    message: str | None = None


@strawberry.type
class EquationRecord:
    """An entry in the user's equation history."""

    job_id: str
    equation: str
    created_at: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _get_redis(info: Info) -> Any:
    """Retrieve the shared Redis client from the request context."""
    return info.context["request"].app.state.redis


async def _get_rmq_channel(info: Info) -> aio_pika.abc.AbstractChannel:
    """Retrieve the shared RabbitMQ channel from the request context."""
    return info.context["request"].app.state.rmq_channel


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

@strawberry.type
class Query:
    """Read-only queries for job state and history."""

    @strawberry.field(description="Get the current status of a job.")
    async def job_status(self, job_id: str, info: Info) -> Job:
        """Fetch job status from Redis."""
        redis = await _get_redis(info)
        raw: str | None = await redis.get(f"job:{job_id}:status")
        if raw is None:
            return Job(job_id=job_id, status="not_found", progress=0.0)

        data: dict[str, Any] = json.loads(raw)
        return Job(
            job_id=job_id,
            status=data.get("status", "unknown"),
            progress=float(data.get("progress", 0.0)),
            error=data.get("error"),
        )

    @strawberry.field(description="Get the result of a completed job.")
    async def job_result(self, job_id: str, info: Info) -> Job:
        """Fetch job result from Redis."""
        redis = await _get_redis(info)
        raw: str | None = await redis.get(f"job:{job_id}:status")
        if raw is None:
            return Job(job_id=job_id, status="not_found", progress=0.0)

        data: dict[str, Any] = json.loads(raw)
        return Job(
            job_id=job_id,
            status=data.get("status", "unknown"),
            progress=float(data.get("progress", 0.0)),
            error=data.get("error"),
        )

    @strawberry.field(description="List recent equations from history.")
    async def equation_history(self, info: Info) -> list[EquationRecord]:
        """Return the most recent equations stored in Redis.

        Equations are stored in a Redis sorted set keyed by
        ``equation_history`` with score = epoch timestamp.
        """
        redis = await _get_redis(info)
        entries: list[tuple[str, float]] = await redis.zrevrange(
            "equation_history",
            0,
            49,
            withscores=True,
        )

        results: list[EquationRecord] = []
        for entry_json, _score in entries:
            try:
                entry: dict[str, Any] = json.loads(entry_json)
                results.append(
                    EquationRecord(
                        job_id=entry.get("job_id", ""),
                        equation=entry.get("equation", ""),
                        created_at=entry.get("created_at", ""),
                    )
                )
            except (json.JSONDecodeError, TypeError):
                continue
        return results


# ---------------------------------------------------------------------------
# Mutation
# ---------------------------------------------------------------------------

@strawberry.type
class Mutation:
    """Write operations — submit render / extraction jobs."""

    @strawberry.mutation(description="Submit a forward-render job.")
    async def render_equation(
        self,
        equation: str,
        width: int,
        height: int,
        info: Info,
    ) -> RenderResult:
        """Publish a render job to the ``forward_jobs`` queue."""
        job_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()

        channel = await _get_rmq_channel(info)
        await channel.declare_queue(FORWARD_QUEUE, durable=True)

        payload: dict[str, Any] = {
            "job_id": job_id,
            "type": "render",
            "equation": equation,
            "width": width,
            "height": height,
            "format": "png",
            "submitted_at": now,
        }

        message = aio_pika.Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            message_id=job_id,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await channel.default_exchange.publish(message, routing_key=FORWARD_QUEUE)

        # Persist initial state.
        redis = await _get_redis(info)
        state = {"status": "queued", "progress": 0.0, "submitted_at": now}
        await redis.set(
            f"job:{job_id}:status",
            json.dumps(state),
            ex=JOB_TTL_SECONDS,
        )

        # Record in history.
        history_entry = json.dumps(
            {"job_id": job_id, "equation": equation, "created_at": now},
        )
        await redis.zadd(
            "equation_history",
            {history_entry: datetime.now(timezone.utc).timestamp()},
        )

        logger.info("GraphQL: render job %s queued.", job_id)
        return RenderResult(job_id=job_id, status="queued", submitted_at=now)

    @strawberry.mutation(description="Submit a reverse-extraction job.")
    async def extract_formula(
        self,
        image_url: str,
        info: Info,
    ) -> ExtractionResult:
        """Publish an extraction job to the ``reverse_jobs`` queue."""
        job_id = uuid.uuid4().hex
        now = datetime.now(timezone.utc).isoformat()

        channel = await _get_rmq_channel(info)
        await channel.declare_queue(REVERSE_QUEUE, durable=True)

        payload: dict[str, Any] = {
            "job_id": job_id,
            "type": "extract",
            "image_url": image_url,
            "submitted_at": now,
        }

        message = aio_pika.Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            message_id=job_id,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await channel.default_exchange.publish(message, routing_key=REVERSE_QUEUE)

        redis = await _get_redis(info)
        state = {"status": "queued", "progress": 0.0, "submitted_at": now}
        await redis.set(
            f"job:{job_id}:status",
            json.dumps(state),
            ex=JOB_TTL_SECONDS,
        )

        logger.info("GraphQL: extraction job %s queued.", job_id)
        return ExtractionResult(job_id=job_id, status="queued", submitted_at=now)


# ---------------------------------------------------------------------------
# Subscription
# ---------------------------------------------------------------------------

@strawberry.type
class Subscription:
    """Real-time subscriptions streamed over WebSocket / SSE."""

    @strawberry.subscription(description="Stream progress updates for a job.")
    async def job_progress(
        self,
        job_id: str,
        info: Info,
    ) -> AsyncGenerator[ProgressUpdate, None]:
        """Subscribe to the Redis Pub/Sub channel for *job_id*.

        Yields :class:`ProgressUpdate` objects as the worker publishes
        progress ticks.  Terminates when the job reaches a terminal
        state (``completed`` or ``failed``).
        """
        redis = await _get_redis(info)
        pubsub = redis.pubsub()
        channel_name = f"job:{job_id}:progress"

        await pubsub.subscribe(channel_name)
        logger.info("Subscribed to Redis channel %s", channel_name)

        try:
            async for raw_message in pubsub.listen():
                if raw_message["type"] != "message":
                    continue

                try:
                    data: dict[str, Any] = json.loads(raw_message["data"])
                except (json.JSONDecodeError, TypeError):
                    continue

                update = ProgressUpdate(
                    job_id=job_id,
                    status=data.get("status", "processing"),
                    progress=float(data.get("progress", 0.0)),
                    message=data.get("message"),
                )
                yield update

                # Stop when the job reaches a terminal state.
                if update.status in {"completed", "failed"}:
                    break
        finally:
            await pubsub.unsubscribe(channel_name)
            await pubsub.aclose()  # type: ignore[union-attr]
            logger.info("Unsubscribed from Redis channel %s", channel_name)


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

schema = strawberry.Schema(
    query=Query,
    mutation=Mutation,
    subscription=Subscription,
)
"""The top-level Strawberry schema exposed by the gateway."""
