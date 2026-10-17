"""WebSocket pub/sub handler for the PixMath API Gateway.

Provides a ``/ws/jobs/{job_id}`` endpoint that subscribes to a Redis
Pub/Sub channel and streams JSON progress messages to the connected
WebSocket client in real time.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any

import redis.asyncio as aioredis
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logger = logging.getLogger(__name__)

router = APIRouter(tags=["websocket"])


# ---------------------------------------------------------------------------
# Redis Pub/Sub manager
# ---------------------------------------------------------------------------

class RedisPubSubManager:
    """Thin wrapper around a Redis Pub/Sub connection.

    Manages subscription lifecycle for a single channel and exposes
    an async iterator of parsed JSON messages.

    Args:
        redis_client: An ``redis.asyncio`` client instance.
    """

    def __init__(self, redis_client: aioredis.Redis) -> None:
        self._redis = redis_client
        self._pubsub: aioredis.client.PubSub | None = None
        self._channel: str | None = None

    async def subscribe(self, channel: str) -> None:
        """Subscribe to *channel*.

        Args:
            channel: Redis channel name (e.g. ``job:<id>:progress``).
        """
        self._pubsub = self._redis.pubsub()
        self._channel = channel
        await self._pubsub.subscribe(channel)
        logger.info("RedisPubSubManager: subscribed to %s", channel)

    async def listen(self) -> Any:  # noqa: ANN401
        """Yield parsed JSON messages from the subscribed channel.

        Skips non-``message`` frames and silently drops unparseable
        payloads so that the WebSocket loop never crashes on bad data.

        Yields:
            Parsed JSON dict for each valid message.
        """
        if self._pubsub is None:
            raise RuntimeError("Must call subscribe() before listen().")

        async for raw in self._pubsub.listen():
            if raw["type"] != "message":
                continue
            try:
                yield json.loads(raw["data"])
            except (json.JSONDecodeError, TypeError):
                logger.warning(
                    "RedisPubSubManager: failed to decode message on %s",
                    self._channel,
                )
                continue

    async def unsubscribe(self) -> None:
        """Unsubscribe and clean up the Pub/Sub connection."""
        if self._pubsub is not None:
            if self._channel:
                await self._pubsub.unsubscribe(self._channel)
                logger.info(
                    "RedisPubSubManager: unsubscribed from %s",
                    self._channel,
                )
            await self._pubsub.aclose()  # type: ignore[union-attr]
            self._pubsub = None
            self._channel = None


# ---------------------------------------------------------------------------
# WebSocket endpoint
# ---------------------------------------------------------------------------

@router.websocket("/ws/jobs/{job_id}")
async def job_progress_ws(websocket: WebSocket, job_id: str) -> None:
    """Stream real-time job progress over a WebSocket connection.

    1. Accepts the WebSocket handshake.
    2. Subscribes to the ``job:<job_id>:progress`` Redis channel.
    3. Forwards each JSON message to the client.
    4. Terminates when the job reaches a terminal state or the client
       disconnects.

    Args:
        websocket: The incoming WebSocket connection.
        job_id: UUID of the job to track.
    """
    await websocket.accept()
    logger.info("WebSocket accepted for job %s", job_id)

    redis_client: aioredis.Redis = websocket.app.state.redis
    manager = RedisPubSubManager(redis_client)
    channel = f"job:{job_id}:progress"

    try:
        await manager.subscribe(channel)

        # Immediately send current status snapshot so the client does
        # not have to wait for the next progress tick.
        current_raw: str | None = await redis_client.get(f"job:{job_id}:status")
        if current_raw is not None:
            await websocket.send_text(current_raw)

        async for data in manager.listen():
            if websocket.client_state != WebSocketState.CONNECTED:
                break

            await websocket.send_text(json.dumps(data))

            # Stop streaming once the job reaches a terminal state.
            job_status = data.get("status", "")
            if job_status in {"completed", "failed"}:
                logger.info("Job %s reached terminal state: %s", job_id, job_status)
                break

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected for job %s", job_id)
    except asyncio.CancelledError:
        logger.info("WebSocket task cancelled for job %s", job_id)
    except Exception:
        logger.exception("Unexpected error in WebSocket handler for job %s", job_id)
    finally:
        await manager.unsubscribe()

        # Gracefully close if still connected.
        if websocket.client_state == WebSocketState.CONNECTED:
            await websocket.close()
        logger.info("WebSocket handler finished for job %s", job_id)
