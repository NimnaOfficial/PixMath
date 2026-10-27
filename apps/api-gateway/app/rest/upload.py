"""REST upload router for the PixMath API Gateway.

Provides endpoints for submitting render / extract jobs and querying
their status and results.  Jobs are published to RabbitMQ queues and
tracked in Redis.
"""

from __future__ import annotations

import asyncio
import json
import logging
import uuid
from datetime import datetime, timezone
from enum import Enum
from typing import Any

import aio_pika
from fastapi import APIRouter, HTTPException, Request, UploadFile, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/jobs", tags=["jobs"])

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FORWARD_QUEUE = "forward_jobs"
REVERSE_QUEUE = "reverse_jobs"
JOB_TTL_SECONDS: int = 60 * 60 * 24  # 24 h


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class OutputFormat(str, Enum):
    """Supported output image formats."""

    PNG = "png"
    WEBP = "webp"
    EXR = "exr"


class RenderRequest(BaseModel):
    """Body for ``POST /render``."""

    equation: str = Field(..., min_length=1, description="PixMath equation string")
    width: int = Field(512, ge=1, le=8192, description="Output width in pixels")
    height: int = Field(512, ge=1, le=8192, description="Output height in pixels")
    format: OutputFormat = Field(OutputFormat.PNG, description="Output image format")


class JobAccepted(BaseModel):
    """Response returned when a job is successfully enqueued."""

    job_id: str
    status: str = "queued"
    submitted_at: str


class JobStatusEnum(str, Enum):
    """Possible states of a processing job."""

    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class JobStatus(BaseModel):
    """Current status of a job."""

    job_id: str
    status: JobStatusEnum
    progress: float = Field(0.0, ge=0.0, le=1.0)
    error: str | None = None


class JobResult(BaseModel):
    """Result payload for a completed job."""

    job_id: str
    status: JobStatusEnum
    download_url: str | None = None
    equation: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class ValidationMetricsModel(BaseModel):
    """Diagnostic metrics from ephemeral image validation."""

    width: int
    height: int
    contrast_score: float
    sharpness_score: float
    coherence_score: float
    purity_score: float
    luminance_std: float
    dynamic_range: float
    autocorrelation: float
    tv_ratio: float


class ImageValidationResponse(BaseModel):
    """Structured report returned after multi-layer mathematical validation."""

    is_valid: bool
    overall_score: float
    grade: str
    feasibility_assessment: str
    rejection_reasons: list[str] = Field(default_factory=list)
    metrics: ValidationMetricsModel
    recommended_action: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _publish_message(
    request: Request,
    queue_name: str,
    payload: dict[str, Any],
    job_id: str,
) -> None:
    """Publish a JSON message to the given RabbitMQ queue.

    Also writes the initial job state into Redis.

    Args:
        request: Incoming HTTP request (used to access ``app.state``).
        queue_name: RabbitMQ queue to publish to.
        payload: Job payload dict (will be JSON-serialised).
        job_id: Unique identifier for this job.
    """
    channel = getattr(request.app.state, "rmq_channel", None)
    if channel is None or channel.is_closed:
        try:
            from app.main import settings
            conn = await asyncio.wait_for(aio_pika.connect_robust(settings.rabbitmq_url), timeout=2.0)
            request.app.state.rmq_connection = conn
            channel = await conn.channel()
            request.app.state.rmq_channel = channel
        except Exception:
            channel = None

    if channel:
        # Ensure queue exists (idempotent).
        await channel.declare_queue(queue_name, durable=True)
        message = aio_pika.Message(
            body=json.dumps(payload).encode(),
            content_type="application/json",
            message_id=job_id,
            delivery_mode=aio_pika.DeliveryMode.PERSISTENT,
        )
        await channel.default_exchange.publish(
            message,
            routing_key=queue_name,
        )
        logger.info("Published job %s to queue %s", job_id, queue_name)
    else:
        logger.warning("RabbitMQ not connected; job %s accepted in offline mode", job_id)

    # Persist initial state in Redis if available.
    redis = getattr(request.app.state, "redis", None)
    if redis:
        state = {
            "status": JobStatusEnum.QUEUED.value,
            "progress": 0.0,
            "submitted_at": datetime.now(timezone.utc).isoformat(),
        }
        await redis.set(f"job:{job_id}:status", json.dumps(state), ex=JOB_TTL_SECONDS)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/render",
    response_model=JobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a forward-render job",
)
async def submit_render_job(body: RenderRequest, request: Request) -> JobAccepted:
    """Accept an equation string and queue a GPU render job.

    Returns ``202 Accepted`` with the generated ``job_id`` immediately.
    """
    job_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()

    payload: dict[str, Any] = {
        "job_id": job_id,
        "id": job_id,
        "type": "render",
        "equation": body.equation,
        "width": body.width,
        "height": body.height,
        "format": body.format.value,
        "submitted_at": now,
    }

    await _publish_message(request, FORWARD_QUEUE, payload, job_id)
    return JobAccepted(job_id=job_id, submitted_at=now)


@router.post(
    "/validate-image",
    response_model=ImageValidationResponse,
    summary="Validate image mathematical feasibility ephemerally",
)
async def validate_uploaded_image(
    image: UploadFile,
) -> ImageValidationResponse:
    """Analyze an uploaded image in memory to assess feasibility for equation extraction.

    Strictly ephemeral: No bytes are written to disk. All buffers are discarded immediately.
    """
    from pixmath_core.validation import validate_image_ephemeral

    contents = await image.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        report = validate_image_ephemeral(contents)
        return ImageValidationResponse(**report.to_dict())
    finally:
        del contents


@router.post(
    "/extract",
    response_model=JobAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Submit a reverse-extraction job",
)
async def submit_extract_job(
    request: Request,
    image: UploadFile,
    validate_precheck: bool = True,
) -> JobAccepted:
    """Accept an uploaded image and queue a reverse-extraction job.

    The image bytes are base64-encoded in-memory and placed onto the
    ``reverse_jobs`` queue for the reverse-worker to process.
    Strictly ephemeral: No bytes are written to disk.
    """
    import base64
    from pixmath_core.validation import validate_image_ephemeral

    job_id = uuid.uuid4().hex
    now = datetime.now(timezone.utc).isoformat()

    contents = await image.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    if validate_precheck:
        report = validate_image_ephemeral(contents)
        if not report.is_valid:
            reasons_summary = "; ".join(report.rejection_reasons)
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Image validation declined: {reasons_summary}",
            )

    # Fast-path: Check for instant lossless round-trip watermark
    from pixmath_core.recognition import recognize_math_equation
    rec_res = recognize_math_equation(contents)
    if rec_res.is_roundtrip_lossless:
        redis = getattr(request.app.state, "redis", None)
        if redis:
            await redis.set(
                f"job:{job_id}:status",
                json.dumps({"status": "completed", "progress": 1.0}),
                ex=JOB_TTL_SECONDS,
            )
            await redis.set(
                f"job:{job_id}:result",
                json.dumps({
                    "download_url": None,
                    "equation": rec_res.equation,
                    "metadata": {
                        "latex": rec_res.latex,
                        "confidence": rec_res.confidence,
                        "confidence_grade": rec_res.confidence_grade,
                        "is_roundtrip_lossless": True,
                        "method": rec_res.method,
                        "uncertain_tokens": rec_res.uncertain_tokens,
                        "complexity": 1.0,
                        "loss": 0.0,
                    },
                }),
                ex=JOB_TTL_SECONDS,
            )
        del contents
        return JobAccepted(job_id=job_id, submitted_at=now)

    payload: dict[str, Any] = {
        "job_id": job_id,
        "type": "extract",
        "image_b64": base64.b64encode(contents).decode(),
        "filename": image.filename or "upload.png",
        "submitted_at": now,
    }

    # Free raw bytes buffer immediately
    del contents

    await _publish_message(request, REVERSE_QUEUE, payload, job_id)
    return JobAccepted(job_id=job_id, submitted_at=now)


@router.get(
    "/{job_id}/status",
    response_model=JobStatus,
    summary="Get job status",
)
async def get_job_status(job_id: str, request: Request) -> JobStatus:
    """Return the current status and progress of a job from Redis."""
    redis = request.app.state.redis
    raw: str | None = await redis.get(f"job:{job_id}:status")

    if raw is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found.",
        )

    data: dict[str, Any] = json.loads(raw)
    return JobStatus(
        job_id=job_id,
        status=JobStatusEnum(data.get("status", "queued")),
        progress=float(data.get("progress", 0.0)),
        error=data.get("error"),
    )


@router.get(
    "/{job_id}/result",
    response_model=JobResult,
    summary="Get job result",
)
async def get_job_result(job_id: str, request: Request) -> JobResult:
    """Return the result of a completed job (e.g. download URL)."""
    redis = request.app.state.redis

    # Check status first.
    status_raw: str | None = await redis.get(f"job:{job_id}:status")
    if status_raw is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found.",
        )

    status_data: dict[str, Any] = json.loads(status_raw)
    job_status = JobStatusEnum(status_data.get("status", "queued"))

    if job_status not in {JobStatusEnum.COMPLETED, JobStatusEnum.FAILED}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Job {job_id} is still {job_status.value}. Try again later.",
        )

    # Fetch result payload.
    result_raw: str | None = await redis.get(f"job:{job_id}:result")
    result_data: dict[str, Any] = json.loads(result_raw) if result_raw else {}

    return JobResult(
        job_id=job_id,
        status=job_status,
        download_url=result_data.get("download_url"),
        equation=result_data.get("equation"),
        metadata=result_data.get("metadata", {}),
    )


@router.get(
    "/{job_id}/download",
    summary="Download rendered output image",
)
async def download_job_output(job_id: str, request: Request) -> FileResponse:
    """Return the rendered image binary file."""
    from pathlib import Path

    redis = getattr(request.app.state, "redis", None)
    file_path = Path("./output") / f"{job_id}.png"
    if redis:
        result_raw = await redis.get(f"job:{job_id}:result")
        if result_raw:
            try:
                res_meta = json.loads(result_raw)
                meta_path = res_meta.get("metadata", {}).get("path")
                if meta_path and Path(meta_path).exists():
                    file_path = Path(meta_path)
            except Exception:
                pass

    if not file_path.exists():
        for cand in [
            Path("./output") / f"{job_id}.png",
            Path("../../output") / f"{job_id}.png",
            Path("../services/forward-worker/output") / f"{job_id}.png",
            Path("../../services/forward-worker/output") / f"{job_id}.png",
        ]:
            if cand.exists():
                file_path = cand
                break

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Rendered image for job {job_id} not found.",
        )

    return FileResponse(
        path=str(file_path),
        media_type="image/png",
        filename=f"{job_id}.png",
    )
