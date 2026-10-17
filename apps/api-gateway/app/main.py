"""FastAPI application entry point for the PixMath API Gateway.

Bootstraps the gateway with REST, GraphQL, and WebSocket transports.
Manages connections to RabbitMQ (job queues) and Redis (state / pub-sub)
via an async lifespan context.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from typing import AsyncIterator

import aio_pika
import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
from strawberry.fastapi import GraphQLRouter

from app.graphql.schema import schema
from app.rest.upload import router as upload_router
from app.ws.pubsub import router as ws_router

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class GatewaySettings(BaseSettings):
    """Configuration for the API gateway, loaded from env / ``.env`` file."""

    host: str = "0.0.0.0"
    port: int = 8000
    cors_origins: list[str] = ["*"]
    rabbitmq_url: str = "amqp://guest:guest@localhost:5672/"
    redis_url: str = "redis://localhost:6379/0"

    model_config = {"env_prefix": "PIXMATH_"}


settings = GatewaySettings()


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown resource management
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Connect to RabbitMQ and Redis on startup; close on shutdown."""

    # --- startup ---------------------------------------------------------
    logger.info("Connecting to RabbitMQ at %s", settings.rabbitmq_url)
    app.state.rmq_connection = await aio_pika.connect_robust(
        settings.rabbitmq_url,
    )
    app.state.rmq_channel = await app.state.rmq_connection.channel()
    logger.info("RabbitMQ connection established.")

    logger.info("Connecting to Redis at %s", settings.redis_url)
    app.state.redis = aioredis.from_url(
        settings.redis_url,
        decode_responses=True,
    )
    # Verify connectivity with a PING.
    await app.state.redis.ping()
    logger.info("Redis connection established.")

    yield  # ----------- application is running ---------------------------

    # --- shutdown --------------------------------------------------------
    logger.info("Shutting down: closing RabbitMQ & Redis connections…")
    await app.state.rmq_channel.close()
    await app.state.rmq_connection.close()
    await app.state.redis.aclose()  # type: ignore[union-attr]
    logger.info("Shutdown complete.")


# ---------------------------------------------------------------------------
# Application factory
# ---------------------------------------------------------------------------

def create_app() -> FastAPI:
    """Build and return the configured :class:`FastAPI` application."""

    application = FastAPI(
        title="PixMath API",
        version="0.1.0",
        lifespan=lifespan,
    )

    # -- CORS -------------------------------------------------------------
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # -- GraphQL ----------------------------------------------------------
    graphql_app: GraphQLRouter = GraphQLRouter(  # type: ignore[type-arg]
        schema,
        path="/graphql",
    )
    application.include_router(graphql_app, prefix="/graphql")

    # -- REST & WebSocket -------------------------------------------------
    application.include_router(upload_router)
    application.include_router(ws_router)

    # -- Health check -----------------------------------------------------
    @application.get("/health", tags=["ops"])
    async def health_check() -> dict[str, str]:
        """Lightweight liveness probe."""
        return {"status": "ok"}

    return application


app: FastAPI = create_app()
"""Module-level app instance used by uvicorn / gunicorn."""
