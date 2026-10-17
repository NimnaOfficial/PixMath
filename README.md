# PixMath: Bidirectional Mathematical Image Synthesis & Symbolic Extraction

[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![License: MIT](https://img.shields.io/badge/License-MIT-emerald.svg)](LICENSE)
[![Framework: ModernGL / EGL](https://img.shields.io/badge/Renderer-ModernGL%20EGL-cyan.svg)](https://moderngl.readthedocs.io/)
[![Architecture: Hybrid BFF](https://img.shields.io/badge/Architecture-REST%20%7C%20GraphQL%20%7C%20WS-purple.svg)]()

> PixMath is an industrial-grade, bidirectional software platform, CLI, and interactive Web Studio that bridges continuous algebraic mathematics and discrete digital graphics.

---

## 🌟 Core Architecture

```
                  ┌────────────────────────────────────────┐
                  │             PixMath Studio             │
                  │   React 19 + Tailwind + WebGL2/WebGPU  │
                  └───────────────────┬────────────────────┘
                                      │ HTTP / WS / GraphQL
                                      ▼
                  ┌────────────────────────────────────────┐
                  │              API Gateway               │
                  │      FastAPI BFF + Strawberry GraphQL   │
                  └─────────┬────────────────────┬─────────┘
                            │                    │
              AMQP (Forward)│                    │AMQP (Reverse)
                            ▼                    ▼
             ┌─────────────────────────┐   ┌─────────────────────────┐
             │     Forward Worker      │   │     Reverse Worker      │
             │   AST Security Sandbox  │   │     SIREN / KAN (PyTorch)│
             │   AST-to-GLSL Compiler  │   │     PySR Symbolic Distill│
             │   ModernGL EGL Renderer │   │     Pareto Elbow Select │
             └─────────────────────────┘   └─────────────────────────┘
```

### 1. Forward Engine (Math → Image)
- **Mathematical Formulations**: Evaluates continuous 2D coordinate spaces mapping $(x, y) \to (R, G, B)$ using trigonometric polynomials, Signed Distance Functions (SDFs), and Simplex noise domain warping.
- **Compiler Security**: Python `ast.NodeVisitor` sandbox enforcing node whitelists, depth caps ($\le 32$), and node volume limits ($\le 2000$).
- **Hardware Acceleration**: Transpiles validated ASTs directly into GLSL fragment shaders for sub-millisecond GPU rendering via WebGL2 (client) or ModernGL EGL (server).

### 2. Reverse Engine (Image → Math)
- **Implicit Neural Representations**: Trains coordinate MLPs with periodic activations (SIREN with $\omega_0 = 30.0$) or Kolmogorov-Arnold Networks (KAN) to capture high frequencies without spectral bias.
- **Symbolic Regression**: Uses evolutionary genetic programming (PySR) to distill the continuous neural weights into compact, closed-form algebraic expressions.
- **Pareto Frontier Optimization**: Automatically selects the "Pareto elbow" formula to deliver the highest visual fidelity (PSNR/SSIM) with the most concise equation.

---

## 📁 Monorepo Layout

```
pixmath/
├── apps/
│   ├── cli/             # Typer + Rich terminal client (render, extract, studio)
│   ├── web-studio/      # React + Tailwind + Vite + WebGL2/WebGPU live shader & Pareto UI
│   └── api-gateway/     # Hybrid BFF: FastAPI (REST upload) + Strawberry (GraphQL/WS)
├── services/
│   ├── forward-worker/  # AST security sandbox + AST-to-GLSL transpiler + ModernGL/EGL
│   ├── reverse-worker/  # PyTorch SIREN/KAN trainer + PySR genetic engine + FlatBuffers
│   └── dlx-monitor/     # Telemetry service watching RabbitMQ Dead-Letter Exchanges
├── libs/
│   ├── schemas/         # FlatBuffers (ast_tree.fbs) & Protobuf (job_contract.proto)
│   └── math-core/       # Shared SDF primitives, Simplex noise, PSNR & D-SSIM metrics
├── infra/
│   ├── docker/          # 512MB cgroup-constrained Dockerfiles & headless EGL configs
│   └── compose.yaml     # Local dev stack (RabbitMQ, Redis PubSub, Postgres, MinIO)
└── tests/
    ├── unit/            # Math accuracy & GLSL transpiler unit tests
    ├── integration/     # End-to-end REST → RabbitMQ → Worker → WebSocket tests
    └── redteam/         # AST security fuzzing & exponential bomb penetration tests
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm
- Docker & Docker Compose (optional for local infrastructure)
- `uv` (recommended fast Python package manager)

### 1. Local Infrastructure
```bash
docker compose -f infra/compose.yaml up -d
```
Starts RabbitMQ (5672), Redis (6379), PostgreSQL (5432), and MinIO (9000).

### 2. Python Workspace Setup
```bash
uv sync
```

### 3. Running the PixMath CLI
```bash
# Render a mathematical formula directly to PNG
uv run pixmath render --eq "sin(10.0 * sqrt(x*x + y*y) - t) * cos(8.0 * atan2(y, x))" --out art.png

# Show system backend capabilities
uv run pixmath info
```

### 4. Running the Web Studio
```bash
cd apps/web-studio
npm install
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 🧪 Running Tests

```bash
# Run unit tests (SDF primitives, Simplex noise, PSNR/SSIM)
uv run pytest tests/unit

# Run red-team security penetration tests (AST injection & CPU exhaustion bombs)
uv run pytest tests/redteam -m redteam

# Run end-to-end integration tests
uv run pytest tests/integration -m integration
```

---

## 🔒 Security Guarantee
PixMath evaluates user-supplied mathematical equations without ever executing arbitrary Python code. All formulas must strictly pass the `SecurityASTValidator` which strips non-whitelisted operations, blocks dunder methods (`__subclasses__`, `__class__`), and enforces strict structural depth caps before compilation to GLSL.

## 📄 License
MIT © PixMath Authors.
