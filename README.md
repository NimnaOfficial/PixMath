<div align="center">

# ∿ PixMath Studio
### Continuous Mathematics $\longleftrightarrow$ Discrete Pixel Architecture

[![Python 3.11+](https://img.shields.io/badge/Python-3.11%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-6.4-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![WebGL2](https://img.shields.io/badge/WebGL-2.0-990000?style=for-the-badge&logo=webgl&logoColor=white)](https://www.khronos.org/webgl/)
[![ModernGL](https://img.shields.io/badge/ModernGL-EGL%20Headless-00C7B7?style=for-the-badge)](https://moderngl.readthedocs.io/)
[![PyTorch](https://img.shields.io/badge/PyTorch-SIREN%20%7C%20KAN-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)](https://pytorch.org/)
[![RabbitMQ](https://img.shields.io/badge/RabbitMQ-AMQP%20Broker-FF6600?style=for-the-badge&logo=rabbitmq&logoColor=white)](https://www.rabbitmq.com/)
[![Redis](https://img.shields.io/badge/Redis-Pub%2FSub%20%26%20State-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)](LICENSE)

<br/>

**PixMath Studio** is an industrial-grade, bidirectional cyber-physical workstation and microservice platform. It bridges continuous mathematical formulas and discrete digital graphics:
- **Forward Mode ($\mathbb{R}^2 \times \mathbb{R} \to \text{RGB}$):** Compiles algebraic equations into secure GPU fragment shaders for zero-lag 60–120 FPS rendering.
- **Reverse Mode ($\text{RGB} \to \text{Math}$):** Extracts compact, closed-form symbolic equations from images via Implicit Neural Representations (SIREN / KAN) and Evolutionary Genetic Programming (PySR).

</div>

---

## Table of Contents

- [Core Architectural Overview](#-core-architectural-overview)
- [Monorepo Directory Layout](#-monorepo-directory-layout)
- [Key Features \& Capabilities](#-key-features--capabilities)
  - [1. Forward Synthesis Engine (Math $\to$ Image)](#1-forward-synthesis-engine-math--image)
  - [2. Reverse Extraction Engine (Image $\to$ Math)](#2-reverse-extraction-engine-image--math)
  - [3. Web Studio Frontend \& Micro-Interactions](#3-web-studio-frontend--micro-interactions)
  - [4. AST Security Sandbox \& DoS Defense](#4-ast-security-sandbox--dos-defense)
- [Getting Started \& Full Setup Guide](#-getting-started--full-setup-guide)
  - [System Prerequisites](#system-prerequisites)
  - [⚡ One-Click Automated Launch](#-one-click-automated-launch)
  - [Manual Multi-Service Setup](#manual-multi-service-setup)
- [CLI Reference Guide](#-cli-reference-guide)
- [API, GraphQL \& WebSocket Reference](#-api-graphql--websocket-reference)
- [Obsidian Math-Lab Design System](#-obsidian-math-lab-design-system)
- [Testing \& Verification Suite](#-testing--verification-suite)
- [Environment Configuration (`.env`)](#-environment-configuration-env)
- [License](#-license)

---

## 🏛 Core Architectural Overview

PixMath employs a high-performance, asynchronous distributed microservices topology mediated by RabbitMQ job queues and Redis state/telemetry channels, backed by a decoupled WebGL2/WebGPU client.

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Obsidian Math-Lab)"]
        UI["PixMath Web Studio (React 19 + Vite:5173)"]
        CLI["PixMath CLI (Typer + Rich)"]
        Monaco["Monaco AST IDE (JetBrains Mono)"]
        Scrubber["Alt-Drag Scrubber Bridge (u_c[64])"]
        Canvas["WebGL2 Viewport (60-120 FPS)"]
        Radar["Pareto Frontier Radar (D3 + KaTeX)"]
        UI --> Monaco
        UI --> Scrubber
        UI --> Canvas
        UI --> Radar
    end

    subgraph Gateway ["API Gateway (:8000)"]
        FastAPI["FastAPI App Factory"]
        REST["REST Endpoints (/api/v1/jobs)"]
        GQL["Strawberry GraphQL (/graphql)"]
        WSH["WebSocket Pub/Sub (/ws/jobs)"]
        FastAPI --> REST
        FastAPI --> GQL
        FastAPI --> WSH
    end

    subgraph Messaging ["Message Broker & State Storage"]
        RMQ["RabbitMQ Broker (:5672)"]
        FWQ[("forward_jobs")]
        RVQ[("reverse_jobs")]
        DLX[("pixmath.dlx")]
        REDIS[("Redis Cache & Pub/Sub (:6379)")]
        MINIO[("MinIO S3 Object Storage (:9000)")]
        RMQ --> FWQ
        RMQ --> RVQ
        RMQ --> DLX
    end

    subgraph Workers ["Computational Microservices"]
        FW["Forward Worker (AST Sandbox + GLSL + ModernGL)"]
        RW["Reverse Worker (SIREN / KAN + PySR Distillation)"]
        DLXM["DLX Monitor (Exponential Backoff Telemetry)"]
    end

    UI -->|REST / GraphQL / WebSocket| Gateway
    CLI -->|Local GPU / CPU or REST| Gateway
    REST -->|Publish Render Job| FWQ
    REST -->|Publish Extract Job| RVQ
    GQL -->|Mutations & Queries| RMQ
    WSH -->|Subscribe job:id:progress| REDIS

    FWQ -->|Consume| FW
    RVQ -->|Consume| RW
    DLX -->|Dead-letter events| DLXM

    FW -->|Status & Result Keys| REDIS
    FW -->|PNG Output / S3| MINIO
    RW -->|Real-Time Telemetry| REDIS
    RW -->|Optimal Pareto Equation| REDIS
```

---

## 📁 Monorepo Directory Layout

```text
pixmath/
├── apps/
│   ├── api-gateway/            # FastAPI BFF Gateway
│   │   ├── app/
│   │   │   ├── graphql/        # Strawberry GraphQL schema (Queries, Mutations, Subscriptions)
│   │   │   ├── rest/           # REST endpoints (submit_render, submit_extract, download)
│   │   │   ├── ws/             # Real-time WebSocket pub/sub progress streaming
│   │   │   └── main.py         # Application factory, lifespan, CORS, and routing
│   │   └── pyproject.toml
│   │
│   ├── cli/                    # PixMath Command Line Tool
│   │   ├── pixmath_cli/
│   │   │   └── main.py         # Typer + Rich CLI: render, extract, info, CPU/GPU modes
│   │   └── pyproject.toml
│   │
│   └── web-studio/             # Modern Classic Web Studio Client
│       ├── src/
│       │   ├── components/     # Active workstation modules:
│       │   │   ├── StudioTopbar.tsx         # Telemetry HUD, mode switch, presets, resolution
│       │   │   ├── SymbolicEditorPanel.tsx  # Monaco IDE, KaTeX overlay, AST token breadcrumbs
│       │   │   ├── MathCanvas.tsx           # WebGL2 rendering pipeline with uniform buffer u_c
│       │   │   ├── AnalyticsRadarPanel.tsx  # Dual radial gauges (PSNR/D-SSIM), live telemetry
│       │   │   └── ParetoExplorer.tsx       # Interactive Pareto scatter plot with spring physics
│       │   ├── hooks/          # High-performance custom hooks:
│       │   │   └── useScrubberBridge.ts     # Zero-lag Alt-drag numeric literal scrubber engine
│       │   ├── store/          # Zustand state store with decoupled transient subscriptions
│       │   └── legacy_components/ # Archived prototype components
│       └── package.json        # React 19, Tailwind CSS 4, Vite 6, Monaco, KaTeX
│
├── services/
│   ├── forward-worker/         # Math -> Image Rendering Service
│   │   ├── app/
│   │   │   ├── egl_renderer/   # Headless ModernGL GPU context & framebuffers
│   │   │   ├── sandbox/        # SecurityASTValidator & expression parser
│   │   │   ├── transpiler/     # AST-to-GLSL compiler with safe-math & 2D noise
│   │   │   └── worker.py       # RabbitMQ consumer & Redis state machine
│   │   └── pyproject.toml
│   │
│   ├── reverse-worker/         # Image -> Math Neural-Symbolic Distillation
│   │   ├── app/
│   │   │   ├── siren/          # Sinusoidal Representation Networks (Sitzmann et al.)
│   │   │   ├── kan/            # Kolmogorov-Arnold Networks with learnable B-splines
│   │   │   ├── pysr_engine/    # PySR genetic programming distillation engine
│   │   │   ├── pareto/         # Discrete-curvature Pareto elbow detector
│   │   │   └── worker.py       # Base64 ingestion, multi-channel distillation, telemetry
│   │   └── pyproject.toml
│   │
│   └── dlx-monitor/            # Dead-Letter Exchange Watchdog
│       ├── app/
│       │   └── telemetry.py    # Exponential retry policy & structured logging
│       └── pyproject.toml
│
├── libs/
│   ├── math-core/              # Shared Mathematical Library (pixmath_core)
│   │   ├── pixmath_core/
│   │   │   ├── metrics/        # PSNR and D-SSIM image comparison metrics
│   │   │   ├── noise/          # 2D Simplex and Perlin noise implementations
│   │   │   ├── recognition/    # Fast local surface recognition & watermark embedding
│   │   │   ├── sandbox/        # Centralized AST security validator & DoS guardrails
│   │   │   ├── sdf/            # Signed Distance Function primitives (circle, box, blend)
│   │   │   └── validation/     # Input dimensions & color format validators
│   │   └── pyproject.toml
│   │
│   └── schemas/                # Shared Schema Definitions
│       ├── flatbuffers/        # FlatBuffers binary AST schemas (ast_tree.fbs)
│       └── proto/              # Protobuf job definitions (job_contract.proto)
│
├── infra/
│   └── compose.yaml            # Local infrastructure: RabbitMQ, Redis, PostgreSQL, MinIO
│
├── tests/
│   ├── unit/                   # Math accuracy, SDF, and GLSL unit tests
│   ├── integration/            # End-to-end Gateway ↔ Worker ↔ Redis pipeline tests
│   └── redteam/                # AST injection, dunder bypass, and parser bomb tests
│
├── start_project.ps1           # Windows full-stack launch script
├── stop_project.ps1            # Windows clean shutdown script
├── start_project.sh            # Linux / macOS full-stack launch script
├── stop_project.sh             # Linux / macOS clean shutdown script
├── pyproject.toml              # UV monorepo workspace definition
└── LICENSE                     # MIT Open Source License
```

---

## ⚡ Key Features & Capabilities

### 1. Forward Synthesis Engine (Math $\to$ Image)
- **Continuous Domain Mapping:** Maps normalized continuous coordinates $(x, y) \in [-1, 1]^2$ with temporal parameter $t \ge 0$ into color values $(R, G, B)$.
- **Math Primitives & SDF Library:** Full native support for:
  - Trigonometric & periodic functions: `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`.
  - Hyperbolic & exponential operations: `exp`, `log`, `log2`, `log10`, `sqrt`, `abs`.
  - Signed Distance Functions: circular boundaries, rectangular hulls, smooth blends (`min`, `max`, `clamp`, `smoothstep`, `mix`).
  - Spatial Noise: 1D value noise and 2D bilinear Hermite value noise domain warping (`noise(x, y)`).
- **Headless GPU Acceleration:** Server-side ModernGL EGL context renders 4K imagery headlessly in sub-millisecond frame times.
- **Watermark & Provenance:** Embedded cryptographically validated equation metadata inside output PNG chunks for zero-loss reproduction.

### 2. Reverse Extraction Engine (Image $\to$ Math)
- **Implicit Neural Representation:**
  - **SIREN:** Periodic activation layers $\sin(\omega_0(W x + b))$ with $\omega_0 = 30.0$ designed to circumvent spectral bias and model fine high-frequency structures.
  - **KAN (Kolmogorov-Arnold Network):** Learnable univariate cubic B-spline curves on network edges, delivering superior parameter efficiency.
- **Symbolic Regression (PySR):** Multi-population evolutionary genetic programming extracts closed-form algebraic equations from the continuous neural field.
- **Pareto Frontier Optimization:** Computes discrete (Menger) curvature along the complexity-vs-loss Pareto front, identifying the mathematically optimal "elbow equation" that maximizes visual accuracy while minimizing expression tree depth.
- **Aligned Coordinate Systems:** Rigorously matches coordinate orientation ($x = \text{column}, y = \text{row}$) to prevent image transposition or reflection during extraction.

### 3. Web Studio Frontend & Micro-Interactions
- **Zero-Lag 60+ FPS Rendering Loop:** The WebGL2 viewport runs on an imperative `requestAnimationFrame` lifecycle decoupled from React’s virtual DOM.
- **Alt-Drag Constant Scrubbers:** Holding `Alt` and hovering over any numeric literal in the Monaco editor transforms the cursor into `col-resize`. Dragging horizontally updates constants in real time by dispatching deltas directly to internal uniform buffer `uniform float u_c[64]` without triggering AST re-parsing or shader recompilation.
- **AST X-Ray Inspector:** Hovering over tokenized AST sub-expressions sends node IDs to the shader, applying a dark blue vignette and chromatic strobe over the exact coordinates governed by that sub-expression.
- **Synchronous KaTeX Typesetting:** Real-time equation rendering alongside Monaco without layout shifts.
- **Interactive Pareto Radar:** Hardware-accelerated scatter plot displaying candidate equations evolving over WebSockets, with direct click-to-transition cross-dissolving.
- **ROI Attention Brush:** Press `B` to paint attention weight masks directly onto uploaded images, directing PySR to allocate 80% of equation complexity to regions of interest.

### 4. AST Security Sandbox & DoS Defense
- **Whitelist-Only Validation:** Every AST node type, operator, identifier, and function is strictly verified against `SAFE_NODE_TYPES`, `SAFE_OPERATORS`, and `SAFE_FUNCTIONS`.
- **Dunder & Injection Protection:** Blocks attribute access (`.`), dunder attributes (`__class__`, `__bases__`, `__subclasses__`), imports (`__import__`), and execution calls (`eval`, `exec`).
- **Parser Resource Exhaustion Defense:** Enforces a maximum raw string length of 4,096 characters and uses regex filters to reject chained unary operators (e.g., `"-" * 1000 + "x"`) before CPython's parser can suffer stack overflow or memory exhaustion.

---

## 🚀 Getting Started & Full Setup Guide

### System Prerequisites

| Dependency | Minimum Version | Recommended | Notes |
| :--- | :--- | :--- | :--- |
| **Operating System** | Windows 10/11, Ubuntu 22.04+, or macOS 13+ | Any 64-bit OS | Fully cross-platform |
| **Python** | 3.11+ | Python 3.13 | 64-bit |
| **uv** | 0.4.0+ | Latest (`uv --version`) | Fast workspace sync |
| **Node.js** | 18.0+ | Node 20 or 22 LTS | For Web Studio client |
| **Docker** | 24.0+ | Docker Desktop / Engine | Optional for standalone mode |

---

### ⚡ One-Click Automated Launch

PixMath includes turnkey orchestration scripts for both Windows and Linux/macOS that automatically verify Python, synchronize missing packages, launch all 5 microservices, monitor health checks, and provide a clean dashboard:

#### On Windows (PowerShell)
```powershell
# In Windows PowerShell:
.\start_project.ps1
```

To stop all services cleanly and free ports:
```powershell
.\stop_project.ps1
```

#### On Linux / Ubuntu / macOS (Bash)
```bash
# Make executable (first time only):
chmod +x start_project.sh stop_project.sh

# Launch the platform:
./start_project.sh
```

To stop all services:
```bash
./stop_project.sh
```

#### Live Service URLs After Startup:
- **PixMath Web Studio:** [http://localhost:5173](http://localhost:5173)
- **API Gateway REST Root:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive GraphQL IDE (GraphiQL):** [http://127.0.0.1:8000/graphql](http://127.0.0.1:8000/graphql)
- **Swagger REST API Documentation:** [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
- **Gateway Health Check:** [http://127.0.0.1:8000/health](http://127.0.0.1:8000/health)
- **RabbitMQ Management (Docker):** [http://localhost:15672](http://localhost:15672) (`pixmath` / `pixmath`)
- **MinIO S3 Console (Docker):** [http://localhost:9001](http://localhost:9001) (`minioadmin` / `minioadmin`)

---

### Manual Multi-Service Setup

If you prefer to run services individually in dedicated terminal windows:

#### Step 1: Start Supporting Infrastructure
```bash
docker compose -f infra/compose.yaml up -d
```

#### Step 2: Synchronize Monorepo Dependencies
```bash
# Using uv (recommended)
uv sync --all-packages
```

#### Step 3: Run the API Gateway
```bash
cd apps/api-gateway
uv run uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000 --reload
```

#### Step 4: Run the Forward Worker (Rendering)
```bash
cd services/forward-worker
uv run python -m app.worker
```

#### Step 5: Run the Reverse Worker (Distillation)
```bash
cd services/reverse-worker
uv run python -m app.worker
```

#### Step 6: Run the DLX Monitor
```bash
cd services/dlx-monitor
uv run python -m app.telemetry
```

#### Step 7: Run the Web Studio Frontend
```bash
cd apps/web-studio
npm install
npm run dev
```

---

## 💻 CLI Reference Guide

PixMath includes a command-line interface powered by Typer and Rich:

```bash
# Global help
pixmath --help
```

### 1. `pixmath render`
Renders an algebraic equation directly to an image file via GPU ModernGL (or CPU NumPy fallback):

```bash
# Render complex wave interference to 4K PNG
pixmath render \
  --eq "sin(10.0 * sqrt(x*x + y*y) - 2.0*t) * cos(8.0 * atan2(y, x) + t)" \
  --width 3840 \
  --height 2160 \
  --time 1.5 \
  --out wallpaper_4k.png

# Render Signed Distance Function with Simplex noise
pixmath render \
  --eq "clamp(sin(x * 5.0) + cos(y * 5.0) + noise(x * 2.0, y * 2.0), 0.0, 1.0)" \
  --width 1024 \
  --height 1024 \
  --out sdf_noise.png
```

| Flag | Shorthand | Default | Description |
| :--- | :--- | :--- | :--- |
| `--eq` | | *Required* | Mathematical equation string |
| `--width` | `-w` | `512` | Image width in pixels |
| `--height` | `-h` | `512` | Image height in pixels |
| `--out` | `-o` | `output.png` | Target output image file path |
| `--time` | `-t` | `0.0` | Temporal coordinate value ($t$) |

### 2. `pixmath extract`
Extracts closed-form mathematical equations and LaTeX representations from an image:

```bash
pixmath extract --image target.png --out recovered_equation.txt
```

### 3. `pixmath info`
Inspects installed hardware accelerators, ModernGL EGL context, PyTorch CUDA availability, and version matrix:

```bash
pixmath info
```

---

## 📡 API, GraphQL & WebSocket Reference

### REST Endpoints (`/api/v1/jobs`)

| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/jobs/render` | Submit forward equation render job | `202 Accepted` |
| `POST` | `/api/v1/jobs/extract` | Upload image for reverse extraction | `202 Accepted` |
| `GET` | `/api/v1/jobs/{job_id}/status` | Query job status and progress (0.0 to 1.0) | `200 OK` / `404` |
| `GET` | `/api/v1/jobs/{job_id}/result` | Fetch final equation or download URL | `200 OK` / `409 Conflict` |
| `GET` | `/api/v1/jobs/{job_id}/download` | Download rendered binary PNG file | `200 OK` / `404` |
| `GET` | `/health` | Gateway liveness probe | `200 OK` |

#### Submit Render Job Example (`POST /api/v1/jobs/render`):
```json
{
  "equation": "sin(10.0 * sqrt(x*x + y*y) - t) * cos(8.0 * atan2(y, x))",
  "width": 1024,
  "height": 1024,
  "format": "png"
}
```

---

### Strawberry GraphQL (`/graphql`)

PixMath exposes queries, mutations, and subscriptions over GraphQL. Visit `http://127.0.0.1:8000/graphql` for the interactive GraphiQL IDE.

#### Query Job Status:
```graphql
query GetJob($jobId: String!) {
  jobStatus(jobId: $jobId) {
    jobId
    status
    progress
    error
  }
}
```

#### Mutation: Submit Render Job:
```graphql
mutation RenderEquation {
  renderEquation(
    equation: "sin(6.0 * x) * cos(6.0 * y)"
    width: 512
    height: 512
  ) {
    jobId
    status
    submittedAt
  }
}
```

---

### Real-Time WebSocket Telemetry (`/ws/jobs/{job_id}`)

Clients can establish a persistent WebSocket connection to stream live generation telemetry, progress ticks, and Pareto frontier candidates:

```javascript
const ws = new WebSocket("ws://127.0.0.1:8000/ws/jobs/" + jobId);

ws.onmessage = (event) => {
  const telemetry = JSON.parse(event.data);
  console.log(`Phase: ${telemetry.phase}, Progress: ${telemetry.progress_percent}%`);
};
```

---

## 🎨 Obsidian Math-Lab Design System

The PixMath Web Studio abandons generic SaaS card layouts in favor of an **Obsidian Math-Lab** aesthetic, pairing computational rigor with tactile precision.

### Color Token Architecture

| Token Name | Hex Value | Semantic Role |
| :--- | :--- | :--- |
| `bg-void` | `#05080E` | Deepest cosmic black for application outer boundaries |
| `surface-base` | `#0A0F1D` | Primary workstation background |
| `surface-panel` | `rgba(16, 24, 40, 0.65)` | Translucent glassmorphism panels with `backdrop-filter: blur(16px)` |
| `border-subtle`| `rgba(255, 255, 255, 0.08)` | Minimal architectural dividers |
| `border-active`| `rgba(6, 182, 212, 0.45)` | Electric Cyan glow highlight on active focus |
| `math-coord` | `#06B6D4` | **Electric Cyan**: Spatial coordinates ($x$, $y$, $uv$, grid axes) |
| `math-trig` | `#F59E0B` | **Radiant Amber**: Periodic harmonics (`sin`, `cos`, `atan2`) |
| `math-sdf` | `#EC4899` | **Hot Magenta**: Signed Distance Functions and level boundaries |
| `math-noise` | `#8B5CF6` | **Hyper Violet**: Simplex and Perlin noise domain warping |
| `math-pareto` | `#10B981` | **Emerald Spark**: Pareto-optimal convergence points |
| `math-error` | `#EF4444` | **Laser Red**: AST security violations & syntax errors |

### Typography Tokens
- **Code & AST IDE:** `JetBrains Mono` / `Fira Code` with active programming ligatures enabled (`calt`, `liga`).
- **Equation Typesetting:** Synchronous `KaTeX` running with display-mode mathematical typesetting.
- **System Metrics:** Tabular figures (`tnum`) enabled on all FPS, latency, PSNR, and D-SSIM metric readouts.

---

## 🧪 Testing & Verification Suite

PixMath maintains a testing suite covering unit math accuracy, GLSL compilation, distributed integration, and redteam AST fuzzing:

```bash
# Run all 38 tests across the workspace:
python -m pytest tests

# Run AST security & penetration test gate:
python -m pytest tests/redteam -m redteam

# Run forward rendering pipeline integration tests:
python -m pytest tests/integration -m integration

# Run math-core unit tests (SDF, PSNR, SSIM, Simplex Noise):
python -m pytest tests/unit

# Verify Web Studio TypeScript & Vite production build:
npm --prefix apps/web-studio run build
```

---

## ⚙️ Environment Configuration (`.env`)

Configure PixMath by copying `.env.example` to `.env`:

```ini
# ── General ────────────────────────────────────────────────────────────
PIXMATH_ENV=development
PIXMATH_LOG_LEVEL=INFO

# ── API Gateway ────────────────────────────────────────────────────────
API_HOST=0.0.0.0
API_PORT=8000
API_CORS_ORIGINS=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"]
API_MAX_UPLOAD_MB=50

# ── RabbitMQ ───────────────────────────────────────────────────────────
RABBITMQ_URL=amqp://pixmath:pixmath@localhost:5672/
RABBITMQ_FORWARD_QUEUE=forward_jobs
RABBITMQ_REVERSE_QUEUE=reverse_jobs
RABBITMQ_DLX_EXCHANGE=pixmath.dlx

# ── Redis ──────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379/0
REDIS_PUBSUB_CHANNEL=pixmath:events

# ── Forward Worker ─────────────────────────────────────────────────────
FORWARD_AST_MAX_DEPTH=32
FORWARD_AST_MAX_NODES=2000
FORWARD_RENDER_TIMEOUT_SEC=30
FORWARD_MAX_RESOLUTION=4096

# ── Reverse Worker ─────────────────────────────────────────────────────
REVERSE_SIREN_OMEGA0=30.0
REVERSE_SIREN_EPOCHS=1000
REVERSE_SIREN_LR=0.0001
REVERSE_PYSR_POPULATIONS=20
REVERSE_PYSR_NITERATIONS=50
REVERSE_PYSR_MAXSIZE=30
```

---

## 📄 License

PixMath is licensed under the [MIT License](LICENSE).

```text
MIT License
Copyright (c) 2026 PixMath Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.
```

---

<div align="center">
  <sub>Engineered by the PixMath Core Engineering Team. Designed for continuous mathematics and GPU acceleration.</sub>
</div>
