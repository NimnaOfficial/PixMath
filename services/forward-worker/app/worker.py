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
) -> Path:
    """Execute the full forward pipeline for a single job.

    Parameters:
        job:       Parsed job dict (must contain ``equation``).
        renderer:  An initialised :class:`HeadlessRenderer`.
        settings:  Worker configuration.

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
    job_id: str = job.get("id", uuid.uuid4().hex[:12])

    log.info("processing_job", job_id=job_id, equation=equation)

    # 1. Validate
    tree = validate(equation)

    # 2. Transpile
    glsl_source = transpile(tree)
    log.debug("transpiled_glsl", job_id=job_id, glsl_length=len(glsl_source))

    # 3. Render (run in executor to avoid blocking the event loop)
    loop = asyncio.get_running_loop()
    image = await asyncio.wait_for(
        loop.run_in_executor(
            None,
            renderer.render,
            glsl_source,
            width,
            height,
            time_val,
        ),
        timeout=settings.render_timeout,
    )

    # 4. Save
    output_path = Path(settings.output_dir) / f"{job_id}.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(str(output_path))
    log.info("render_complete", job_id=job_id, output=str(output_path))

    return output_path


# ---------------------------------------------------------------------------
# RabbitMQ consumer
# ---------------------------------------------------------------------------

async def _on_message(
    message: aio_pika.abc.AbstractIncomingMessage,
    renderer: HeadlessRenderer,
    settings: ForwardWorkerSettings,
) -> None:
    """Handle a single incoming RabbitMQ message."""
    async with message.process(requeue=False):
        try:
            job = _parse_job(message.body)
            await _process_job(job, renderer, settings)
        except ASTSecurityError as exc:
            log.warning("ast_security_violation", detail=exc.detail)
        except ShaderCompilationError as exc:
            log.error("shader_compilation_failed", info_log=exc.info_log)
        except asyncio.TimeoutError:
            log.error("render_timeout", timeout=settings.render_timeout)
        except ValueError as exc:
            log.warning("invalid_job_message", error=str(exc))
        except Exception:
            log.exception("unexpected_error_processing_job")


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
                    await _on_message(message, renderer, settings)
                    if shutdown_event.is_set():
                        break

    except asyncio.CancelledError:
        log.info("worker_cancelled")
    except Exception:
        log.exception("fatal_worker_error")
        sys.exit(1)
    finally:
        renderer.close()
        log.info("worker_shutdown_complete")


if __name__ == "__main__":
    asyncio.run(main())
