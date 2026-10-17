"""FastAPI application entry point for the PixMath API Gateway.

Bootstraps the gateway with REST, GraphQL, and WebSocket transports.
Manages connections to RabbitMQ (job queues) and Redis (state / pub-sub)
via an async lifespan context.
"""

from __future__ import annotations

import asyncio
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
    app.state.rmq_connection = None
    app.state.rmq_channel = None
    app.state.redis = None

    # --- startup ---------------------------------------------------------
    try:
        logger.info("Connecting to RabbitMQ at %s", settings.rabbitmq_url)
        app.state.rmq_connection = await asyncio.wait_for(
            aio_pika.connect_robust(settings.rabbitmq_url),
            timeout=3.0,
        )
        app.state.rmq_channel = await app.state.rmq_connection.channel()
        logger.info("RabbitMQ connection established.")
    except Exception as exc:
        logger.warning("RabbitMQ offline (%s). Running in standalone mode.", exc)

    try:
        logger.info("Connecting to Redis at %s", settings.redis_url)
        app.state.redis = aioredis.from_url(
            settings.redis_url,
            decode_responses=True,
        )
        await asyncio.wait_for(app.state.redis.ping(), timeout=3.0)
        logger.info("Redis connection established.")
    except Exception as exc:
        logger.warning("Redis offline (%s). Running in standalone mode.", exc)
        app.state.redis = None

    yield  # ----------- application is running ---------------------------

    # --- shutdown --------------------------------------------------------
    logger.info("Shutting down: closing RabbitMQ & Redis connections…")
    if app.state.rmq_channel:
        try:
            await app.state.rmq_channel.close()
        except Exception:
            pass
    if app.state.rmq_connection:
        try:
            await app.state.rmq_connection.close()
        except Exception:
            pass
    if app.state.redis:
        try:
            await app.state.redis.aclose()
        except Exception:
            pass
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
