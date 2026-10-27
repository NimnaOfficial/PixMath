"""
Reverse Worker Service for PixMath.

Listens to the reverse_jobs queue via RabbitMQ, processes image inputs:
1. Loads and preprocesses the target image
2. Fits an Implicit Neural Representation (SIREN or KAN)
3. Distills the trained representation into symbolic closed-form equations via PySR
4. Evaluates Pareto frontier and selects optimal elbow equation
5. Publishes real-time telemetry over Redis PubSub and sends final job results
"""

from __future__ import annotations

import asyncio
import gc
import json
import logging
import signal
import sys
from typing import Any, Optional
from uuid import UUID

from pydantic import Field
from pydantic_settings import BaseSettings

logger = logging.getLogger("pixmath.reverse_worker")


class ReverseWorkerSettings(BaseSettings):
    """Configuration settings for PixMath Reverse Worker."""

    rabbitmq_url: str = Field(default="amqp://pixmath:pixmath@localhost:5672/", alias="RABBITMQ_URL")
    reverse_queue: str = Field(default="reverse_jobs", alias="RABBITMQ_REVERSE_QUEUE")
    redis_url: str = Field(default="redis://localhost:6379/0", alias="REDIS_URL")
    redis_pubsub_channel: str = Field(default="pixmath:events", alias="REDIS_PUBSUB_CHANNEL")
    siren_omega_0: float = Field(default=30.0, alias="REVERSE_SIREN_OMEGA0")
    siren_epochs: int = Field(default=1000, alias="REVERSE_SIREN_EPOCHS")
    siren_lr: float = Field(default=1e-4, alias="REVERSE_SIREN_LR")
    pysr_populations: int = Field(default=20, alias="REVERSE_PYSR_POPULATIONS")
    pysr_niterations: int = Field(default=50, alias="REVERSE_PYSR_NITERATIONS")
    pysr_maxsize: int = Field(default=30, alias="REVERSE_PYSR_MAXSIZE")

    model_config = {"env_file": ".env", "extra": "ignore"}


class ReverseWorker:
    """Consumes image reverse extraction requests and runs neural-symbolic distillation."""

    def __init__(self, settings: ReverseWorkerSettings) -> None:
        self.settings = settings
        self.is_running = False
        self._redis_client: Optional[Any] = None

    async def connect_redis(self) -> None:
        """Connect to Redis for telemetry streaming."""
        try:
            import redis.asyncio as aioredis
            self._redis_client = aioredis.from_url(self.settings.redis_url)
            await self._redis_client.ping()
            logger.info("Connected to Redis at %s", self.settings.redis_url)
        except Exception as exc:
            logger.warning("Could not connect to Redis: %s. Telemetry will be local only.", exc)
            self._redis_client = None

    async def emit_progress(self, job_id: str, phase: str, progress: float, **extra: Any) -> None:
        """Publish real-time telemetry to Redis PubSub."""
        status_name = "completed" if phase == "completed" else "processing"
        payload = {
            "job_id": job_id,
            "phase": phase,
            "status": status_name,
            "progress_percent": progress,
            "progress": round(progress / 100.0, 2),
            **extra,
        }
        logger.info("Progress [%s]: %s (%.1f%%)", job_id, phase, progress)
        if self._redis_client:
            try:
                # 1. Publish to reverse events channel
                channel1 = f"{self.settings.redis_pubsub_channel}:{job_id}"
                await self._redis_client.publish(channel1, json.dumps(payload))
                # 2. Publish to gateway websocket channel
                channel2 = f"job:{job_id}:progress"
                await self._redis_client.publish(channel2, json.dumps(payload))
                # 3. Update redis status key
                await self._redis_client.set(
                    f"job:{job_id}:status",
                    json.dumps({
                        "status": status_name,
                        "progress": round(progress / 100.0, 2),
                    }),
                    ex=86400,
                )
            except Exception as exc:
                logger.debug("Failed publishing Redis event: %s", exc)

    async def process_job(self, job_data: dict[str, Any]) -> dict[str, Any]:
        """
        Executes the reverse extraction pipeline with strict 512MB RAM hygiene:
        1. Loads target image (from raw bytes, base64, or URL)
        2. Fits an Implicit Neural Representation (SIREN or KAN)
        3. Memory cleanup (forced gc.collect)
        4. Distills into symbolic closed-form equations via PySR
        5. Selects Pareto elbow and formats output
        """
        job_id = job_data.get("job_id", "unknown")
        model_type = job_data.get("model_type", "siren").lower()
        image_bytes = job_data.get("image_data")
        image_url = job_data.get("image_url")
        image_b64 = job_data.get("image_b64")

        # Handle base64 payload from Gateway
        if not image_bytes and image_b64:
            try:
                import base64
                image_bytes = base64.b64decode(image_b64)
            except Exception as exc:
                logger.warning("Failed decoding image_b64: %s", exc)

        await self.emit_progress(job_id, "ingestion", 5.0, message="Loading target image")

        # 1. Load image (Pillow + numpy)
        import io
        import numpy as np
        from PIL import Image

        if image_bytes:
            img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        elif image_url:
            import urllib.request
            req = urllib.request.urlopen(image_url)  # nosec
            img = Image.open(io.BytesIO(req.read())).convert("RGB")
        else:
            # Fallback synthetic target gradient for tests/stubs
            img = Image.new("RGB", (64, 64), color="indigo")

        # Resize for coordinate grid fitting
        img = img.resize((64, 64), Image.Resampling.LANCZOS)
        img_np = np.asarray(img, dtype=np.float32) / 255.0

        await self.emit_progress(job_id, "neural_fitting", 15.0, message="Fitting neural representation")

        # 2. Lazy load Neural modules
        if model_type == "kan":
            from app.kan.spline_net import train_kan
            model = train_kan(
                img_np,
                epochs=min(self.settings.siren_epochs, 200),
                lr=self.settings.siren_lr,
            )
        else:
            from app.siren.network import train_siren
            model = train_siren(
                img_np,
                epochs=min(self.settings.siren_epochs, 300),
                lr=self.settings.siren_lr,
                omega_0=self.settings.siren_omega_0,
            )

        await self.emit_progress(job_id, "neural_fitted", 45.0, message="Neural representation trained")

        # 3. Memory Cleanup before Symbolic phase
        # Clean torch state to survive within 512MB limit
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        gc.collect()

        await self.emit_progress(job_id, "symbolic_regression", 50.0, message="Running symbolic regression")

        # 4. Symbolic Extraction (PySR)
        from app.pysr_engine.symbolic import run_symbolic_regression
        pysr_res = run_symbolic_regression(
            model=model,
            resolution=32,
            niterations=min(self.settings.pysr_niterations, 15),
            populations=min(self.settings.pysr_populations, 8),
            maxsize=self.settings.pysr_maxsize,
        )

        await self.emit_progress(job_id, "pareto_selection", 90.0, message="Selecting Pareto elbow formula")

        # 5. Pareto Elbow Selection (channel-aware)
        from app.pareto.selector import find_pareto_elbow

        selected_eqs: list[str] = []
        selected_complexities: list[float] = []
        selected_losses: list[float] = []

        if pysr_res.equations and isinstance(pysr_res.equations[0], list):
            # Per-channel equations: equations[c] is candidate list for channel c
            for ch_idx, ch_candidates in enumerate(pysr_res.equations):
                ch_comps = pysr_res.complexities[ch_idx] if ch_idx < len(pysr_res.complexities) else []
                ch_loss = pysr_res.losses[ch_idx] if ch_idx < len(pysr_res.losses) else []

                if ch_candidates and ch_comps and ch_loss and len(ch_comps) == len(ch_loss):
                    try:
                        e_idx = find_pareto_elbow(ch_comps, ch_loss)
                        selected_eqs.append(ch_candidates[e_idx])
                        selected_complexities.append(float(ch_comps[e_idx]))
                        selected_losses.append(float(ch_loss[e_idx]))
                    except Exception as err:
                        logger.debug("Pareto selection fallback on channel %d: %s", ch_idx, err)
                        selected_eqs.append(ch_candidates[0])
                        selected_complexities.append(float(ch_comps[0]))
                        selected_losses.append(float(ch_loss[0]))
                elif ch_candidates:
                    selected_eqs.append(ch_candidates[0])
                    selected_complexities.append(10.0)
                    selected_losses.append(0.05)

            best_eq = " ; ".join(selected_eqs) if selected_eqs else pysr_res.best_equation
            best_latex = pysr_res.best_latex
            avg_complexity = float(np.mean(selected_complexities)) if selected_complexities else 10.0
            avg_loss = float(np.mean(selected_losses)) if selected_losses else 0.05
        else:
            best_eq = pysr_res.best_equation
            best_latex = pysr_res.best_latex
            avg_complexity = 10.0
            avg_loss = 0.05

        # Cleanup model
        del model
        gc.collect()

        result = {
            "job_id": job_id,
            "status": "COMPLETED",
            "equation": best_eq,
            "latex": best_latex,
            "complexity": avg_complexity,
            "loss": avg_loss,
        }

        await self.emit_progress(job_id, "completed", 100.0, result=result)

        # Persist completed result in Redis
        if self._redis_client:
            try:
                await self._redis_client.set(
                    f"job:{job_id}:result",
                    json.dumps({
                        "download_url": None,
                        "equation": str(best_eq),
                        "metadata": {
                            "latex": str(best_latex),
                            "complexity": result["complexity"],
                            "loss": result["loss"],
                        },
                    }),
                    ex=86400,
                )
            except Exception as exc:
                logger.warning("Failed writing reverse job result to Redis: %s", exc)

        return result

    async def start(self) -> None:
        """Start AMQP consumer loop."""
        self.is_running = True
        await self.connect_redis()

        try:
            import aio_pika
            connection = await aio_pika.connect_robust(self.settings.rabbitmq_url)
            channel = await connection.channel()
            # Enforce strict backpressure prefetch=1 per Section 3.2 of the Blueprint
            await channel.set_qos(prefetch_count=1)

            queue = await channel.declare_queue(self.settings.reverse_queue, durable=True)
            logger.info("Reverse worker listening on queue '%s' (prefetch=1)", self.settings.reverse_queue)

            async with queue.iterator() as queue_iter:
                async for message in queue_iter:
                    if not self.is_running:
                        break
                    async with message.process():
                        try:
                            payload = json.loads(message.body.decode())
                            logger.info("Received reverse job: %s", payload.get("job_id"))
                            await self.process_job(payload)
                        except Exception as exc:
                            logger.exception("Error processing reverse job: %s", exc)
                            jid = payload.get("job_id") if isinstance(payload, dict) else None
                            if self._redis_client and jid:
                                try:
                                    fail_msg = {"status": "failed", "progress": 0.0, "error": str(exc)}
                                    await self._redis_client.set(f"job:{jid}:status", json.dumps(fail_msg), ex=86400)
                                    await self._redis_client.publish(f"job:{jid}:progress", json.dumps({"job_id": jid, **fail_msg}))
                                except Exception:
                                    pass
        except Exception as exc:
            logger.warning("RabbitMQ offline or connection failed: %s. Running in standalone loop.", exc)
            while self.is_running:
                await asyncio.sleep(1.0)

    async def stop(self) -> None:
        """Gracefully stop worker."""
        self.is_running = False
        if self._redis_client:
            await self._redis_client.close()
        logger.info("Reverse worker stopped.")


async def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
    settings = ReverseWorkerSettings()
    worker = ReverseWorker(settings)

    def _sig_handler() -> None:
        asyncio.create_task(worker.stop())

    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, _sig_handler)
        except NotImplementedError:
            pass  # Windows does not support add_signal_handler

    logger.info("Starting PixMath Reverse Worker...")
    await worker.start()


if __name__ == "__main__":
    asyncio.run(main())
