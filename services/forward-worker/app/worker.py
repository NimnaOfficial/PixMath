"""PixMath Forward Worker – RabbitMQ consumer that renders math expressions.

Pipeline per message::

    1. Deserialise job JSON from the ``forward_jobs`` queue.
    2. Validate the equation string via the AST sandbox.
    3. Transpile the validated AST to a GLSL fragment shader.
    4. Render the shader headlessly with ModernGL.
    5. Write the resulting image to the configured output path.
    6. ACK the message (or NACK on failure).

Configuration is driven by :class:`ForwardWorkerSettings` (pydantic-settings),
which reads from environment variables or a ``.env`` file.

Entry point::

    python -m app.worker
"""
from __future__ import annotations

import asyncio
import json
import signal
import sys
import uuid
from pathlib import Path
from typing import Any, Final

import aio_pika
import structlog
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings

from app.egl_renderer import HeadlessRenderer
from app.egl_renderer.headless_gl import ShaderCompilationError
from app.sandbox import ASTSecurityError, validate
from app.transpiler import transpile

# ---------------------------------------------------------------------------
# Structured logging
# ---------------------------------------------------------------------------

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(0),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
    cache_logger_on_first_use=True,
)

log: structlog.stdlib.BoundLogger = structlog.get_logger()  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------

class ForwardWorkerSettings(BaseSettings):
    """Configuration for the forward rendering worker.

    Values are read from environment variables or from a ``.env`` file
    in the working directory.
    """

    model_config = {"env_file": ".env", "extra": "ignore"}

    rabbitmq_url: str = Field(
        default="amqp://pixmath:pixmath@localhost:5672/",
        validation_alias=AliasChoices("RABBITMQ_URL", "FW_RABBITMQ_URL"),
        description="AMQP connection URL for RabbitMQ.",
    )
    redis_url: str = Field(
        default="redis://localhost:6379/0",
        validation_alias=AliasChoices("REDIS_URL", "PIXMATH_REDIS_URL", "FW_REDIS_URL"),
        description="Redis connection URL for state updates.",
    )
    queue_name: str = Field(
        default="forward_jobs",
        validation_alias=AliasChoices("RABBITMQ_FORWARD_QUEUE", "FW_QUEUE_NAME"),
        description="Queue name to consume rendering jobs from.",
    )
    render_timeout: float = Field(
        default=30.0,
        validation_alias=AliasChoices("FORWARD_RENDER_TIMEOUT_SEC", "FW_RENDER_TIMEOUT"),
        description="Maximum seconds allowed for a single render job.",
    )
    output_dir: str = Field(
        default="./output",
        description="Directory to write rendered images to.",
    )
    render_width: int = Field(default=512, description="Default render width.")
    render_height: int = Field(default=512, description="Default render height.")
    prefetch_count: int = Field(default=1, description="RabbitMQ QoS prefetch count.")


# ---------------------------------------------------------------------------
# Job processing
# ---------------------------------------------------------------------------

_REQUIRED_JOB_KEYS: Final[frozenset[str]] = frozenset({"equation"})


def _parse_job(body: bytes) -> dict[str, Any]:
    """Deserialise and minimally validate a job message.

    Returns:
        A dict with at least the ``equation`` key.

    Raises:
        ValueError: If the body is not valid JSON or is missing required keys.
    """
    try:
        data: dict[str, Any] = json.loads(body)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ValueError(f"Invalid JSON in job message: {exc}") from exc

    missing = _REQUIRED_JOB_KEYS - data.keys()
    if missing:
        raise ValueError(f"Job message missing required keys: {missing}")

    return data


async def _process_job(
    job: dict[str, Any],
    renderer: HeadlessRenderer,
    settings: ForwardWorkerSettings,
    redis_client: Any = None,
) -> Path:
    """Execute the full forward pipeline for a single job.

    Parameters:
        job:          Parsed job dict (must contain ``equation``).
        renderer:     An initialised :class:`HeadlessRenderer`.
        settings:     Worker configuration.
        redis_client: Optional async Redis client for state tracking.

    Returns:
        Path to the rendered image file.

    Raises:
        ASTSecurityError: On invalid / unsafe expressions.
        ShaderCompilationError: On GLSL compilation failure.
        asyncio.TimeoutError: If rendering exceeds the configured timeout.
    """
    equation: str = job["equation"]
    width: int = job.get("width", settings.render_width)
    height: int = job.get("height", settings.render_height)
    time_val: float = float(job.get("time", 0.0))
    job_id: str = str(job.get("job_id") or job.get("id") or uuid.uuid4().hex[:12])

    log.info("processing_job", job_id=job_id, equation=equation)

    # Persist in-progress state to Redis
    if redis_client:
        try:
            await redis_client.set(
                f"job:{job_id}:status",
                json.dumps({
                    "status": "processing",
                    "progress": 0.2,
                    "submitted_at": job.get("submitted_at"),
                }),
                ex=86400,
            )
        except Exception as exc:
            log.warning("failed_updating_redis_status", job_id=job_id, error=str(exc))

    # 1. Validate
    tree = validate(equation)

    # 2. Transpile
    glsl_source = transpile(tree)
    log.debug("transpiled_glsl", job_id=job_id, glsl_length=len(glsl_source))

    # 3. Render (ModernGL OpenGL context is bound to the current thread)
    image = renderer.render(
        glsl_source,
        width=width,
        height=height,
        time=time_val,
    )

    # 4. Save with lossless round-trip watermark & metadata
    from pixmath_core.recognition import embed_forward_watermark
    image = embed_forward_watermark(image, equation=equation, latex=job.get("latex", equation))
    output_path = Path(settings.output_dir) / f"{job_id}.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(output_path), pnginfo=getattr(image, "_pnginfo", None))
    log.info("render_complete", job_id=job_id, output=str(output_path))

    # Persist completed state and result to Redis
    if redis_client:
        try:
            await redis_client.set(
                f"job:{job_id}:status",
                json.dumps({
                    "status": "completed",
                    "progress": 1.0,
                }),
                ex=86400,
            )
            await redis_client.set(
                f"job:{job_id}:result",
                json.dumps({
                    "download_url": f"/api/v1/jobs/{job_id}/download",
                    "equation": equation,
                    "metadata": {
                        "width": width,
                        "height": height,
                        "time": time_val,
                        "format": job.get("format", "png"),
                        "path": str(output_path.resolve()),
                    },
                }),
                ex=86400,
            )
        except Exception as exc:
            log.warning("failed_updating_redis_result", job_id=job_id, error=str(exc))

    return output_path


# ---------------------------------------------------------------------------
# RabbitMQ consumer
# ---------------------------------------------------------------------------

async def _on_message(
    message: aio_pika.abc.AbstractIncomingMessage,
    renderer: HeadlessRenderer,
    settings: ForwardWorkerSettings,
    redis_client: Any = None,
) -> None:
    """Handle a single incoming RabbitMQ message."""
    job_id: str | None = None
    async with message.process(requeue=False):
        try:
            job = _parse_job(message.body)
            job_id = str(job.get("job_id") or job.get("id") or "")
            await _process_job(job, renderer, settings, redis_client=redis_client)
        except ASTSecurityError as exc:
            log.warning("ast_security_violation", detail=exc.detail)
            if redis_client and job_id:
                await redis_client.set(
                    f"job:{job_id}:status",
                    json.dumps({"status": "failed", "progress": 0.0, "error": f"AST Security Violation: {exc.detail}"}),
                    ex=86400,
                )
        except ShaderCompilationError as exc:
            log.error("shader_compilation_failed", info_log=exc.info_log)
            if redis_client and job_id:
                await redis_client.set(
                    f"job:{job_id}:status",
                    json.dumps({"status": "failed", "progress": 0.0, "error": f"Shader compilation failed: {exc.info_log}"}),
                    ex=86400,
                )
        except asyncio.TimeoutError:
            log.error("render_timeout", timeout=settings.render_timeout)
            if redis_client and job_id:
                await redis_client.set(
                    f"job:{job_id}:status",
                    json.dumps({"status": "failed", "progress": 0.0, "error": "Render timed out"}),
                    ex=86400,
                )
        except ValueError as exc:
            log.warning("invalid_job_message", error=str(exc))
        except Exception as exc:
            log.exception("unexpected_error_processing_job")
            if redis_client and job_id:
                await redis_client.set(
                    f"job:{job_id}:status",
                    json.dumps({"status": "failed", "progress": 0.0, "error": str(exc)}),
                    ex=86400,
                )


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

async def main() -> None:
    """Start the forward worker: connect to RabbitMQ and consume jobs."""
    settings = ForwardWorkerSettings()
    log.info(
        "starting_forward_worker",
        queue=settings.queue_name,
        rabbitmq_url=settings.rabbitmq_url.split("@")[-1],  # redact credentials
    )

    # Ensure output directory exists.
    Path(settings.output_dir).mkdir(parents=True, exist_ok=True)

    # Connect to Redis for state persistence
    redis_client = None
    try:
        import redis.asyncio as aioredis
        redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)
        await asyncio.wait_for(redis_client.ping(), timeout=3.0)
        log.info("redis_connected", redis_url=settings.redis_url)
    except Exception as exc:
        log.warning("redis_offline", error=str(exc))
        redis_client = None

    # Graceful shutdown handling.
    shutdown_event = asyncio.Event()

    def _signal_handler() -> None:
        log.info("shutdown_signal_received")
        shutdown_event.set()

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _signal_handler)
        except NotImplementedError:
            # Windows doesn't support add_signal_handler for SIGTERM.
            pass

    # Initialise renderer.
    renderer = HeadlessRenderer()
    renderer.__enter__()

    try:
        while not shutdown_event.is_set():
            try:
                connection = await aio_pika.connect_robust(settings.rabbitmq_url)
                async with connection:
                    channel = await connection.channel()
                    await channel.set_qos(prefetch_count=settings.prefetch_count)

                    queue = await channel.declare_queue(
                        settings.queue_name,
                        durable=True,
                    )

                    log.info("listening", queue=settings.queue_name)

                    async with queue.iterator() as queue_iter:
                        async for message in queue_iter:
                            await _on_message(message, renderer, settings, redis_client=redis_client)
                            if shutdown_event.is_set():
                                break
                if shutdown_event.is_set():
                    break
            except asyncio.CancelledError:
                log.info("worker_cancelled")
                break
            except Exception as exc:
                log.warning("rabbitmq_connecting_or_standalone", error=str(exc))
                try:
                    await asyncio.wait_for(shutdown_event.wait(), timeout=3.0)
                except asyncio.TimeoutError:
                    pass

    finally:
        renderer.close()
        if redis_client:
            try:
                await redis_client.aclose()
            except Exception:
                pass
        log.info("worker_shutdown_complete")


if __name__ == "__main__":
    asyncio.run(main())
