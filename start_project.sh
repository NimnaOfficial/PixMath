#!/usr/bin/env bash
# ==============================================================================
# PixMath Full Stack Startup Script for Linux / Ubuntu (POSIX Bash compatible)
# ==============================================================================

set -u

# Text formatting
CYAN='\033[0;36m'
DARK_CYAN='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "\n${CYAN}============================================================${NC}"
echo -e "${CYAN}             PIXMATH -- FULL STACK PLATFORM LAUNCH           ${NC}"
echo -e "${DARK_CYAN}   Continuous Mathematics <-> Discrete Pixel Architecture     ${NC}"
echo -e "${CYAN}============================================================${NC}\n"

ROOT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_PATH"

# 1. Environment & Logging setup
LOGS_DIR="$ROOT_PATH/logs"
mkdir -p "$LOGS_DIR"

ENV_FILE="$ROOT_PATH/.env"
ENV_EXAMPLE="$ROOT_PATH/.env.example"
if [ ! -f "$ENV_FILE" ] && [ -f "$ENV_EXAMPLE" ]; then
    echo -e "${CYAN}[+] Generating .env from .env.example...${NC}"
    cp "$ENV_EXAMPLE" "$ENV_FILE"
fi

# Load environment variables from .env
if [ -f "$ENV_FILE" ]; then
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
fi

# Detect Python interpreter (.venv preferred, fallback to uv / system python3)
PYTHON_BIN=""
if [ -x "$ROOT_PATH/.venv/bin/python" ]; then
    PYTHON_BIN="$ROOT_PATH/.venv/bin/python"
elif command -v uv >/dev/null 2>&1; then
    echo -e "${CYAN}[+] Syncing workspace dependencies with uv...${NC}"
    uv sync --all-packages
    PYTHON_BIN="$ROOT_PATH/.venv/bin/python"
elif command -v python3 >/dev/null 2>&1; then
    PYTHON_BIN="$(command -v python3)"
else
    echo -e "${RED}[ERR] Python not found. Please install Python 3.11+ or install uv.${NC}"
    exit 1
fi

PY_VER="$("$PYTHON_BIN" --version 2>&1)"
echo -e "${GREEN}[OK] Python: $PY_VER (using $PYTHON_BIN)${NC}"

# Set PYTHONPATH for cross-service resolution
export PYTHONPATH="$ROOT_PATH/libs/math-core:$ROOT_PATH/libs/schemas:$ROOT_PATH/apps/api-gateway:$ROOT_PATH/services/forward-worker:$ROOT_PATH/services/reverse-worker:$ROOT_PATH/services/dlx-monitor:$ROOT_PATH/apps/cli:${PYTHONPATH:-}"

# Node.js & npm detection (loads nvm if present in ~/.nvm)
if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
        # shellcheck source=/dev/null
        . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
    fi
fi

if ! command -v npm >/dev/null 2>&1; then
    echo -e "${YELLOW}[!] Warning: npm was not found in PATH. Web Studio frontend won't start.${NC}"
fi

# Install Web Studio node_modules if missing
if [ ! -d "$ROOT_PATH/apps/web-studio/node_modules" ] && command -v npm >/dev/null 2>&1; then
    echo -e "${CYAN}[+] Installing Web Studio frontend dependencies (npm install)...${NC}"
    npm --prefix "$ROOT_PATH/apps/web-studio" install
fi

# 2. Check & Launch Docker Infrastructure (Optional / Non-blocking)
DOCKER_RUNNING=0
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo -e "${GREEN}[+] Docker daemon detected. Starting message broker and database stack...${NC}"
    if docker compose -f infra/compose.yaml up -d; then
        DOCKER_RUNNING=1
        echo -e "${GREEN}[OK] RabbitMQ, Redis, Postgres, and MinIO started.${NC}"
        # Brief pause to ensure RabbitMQ port is ready for clients
        for _ in 1 2 3 4 5 6 7 8 9 10; do
            if (echo > /dev/tcp/127.0.0.1/5672) 2>/dev/null; then
                break
            fi
            sleep 0.5
        done
    else
        echo -e "${YELLOW}[-] Docker container launch failed. Continuing in standalone mode.${NC}"
    fi
else
    echo -e "${YELLOW}[-] Docker offline or not installed. Starting services in standalone mode.${NC}"
fi

# 3. Launch API Gateway (FastAPI + Strawberry GraphQL + WebSockets)
echo -e "${CYAN}[+] Starting PixMath API Gateway (Port 8000)...${NC}"
setsid bash -c "cd '$ROOT_PATH/apps/api-gateway' && exec '$PYTHON_BIN' -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000" \
    > "$LOGS_DIR/gateway.log" 2> "$LOGS_DIR/gateway.err.log" < /dev/null &
GATEWAY_PID=$!

# 4. Launch Forward Worker
echo -e "${CYAN}[+] Starting Forward Worker...${NC}"
setsid bash -c "cd '$ROOT_PATH/services/forward-worker' && exec '$PYTHON_BIN' -m app.worker" \
    > "$LOGS_DIR/forward_worker.log" 2> "$LOGS_DIR/forward_worker.err.log" < /dev/null &
FWD_PID=$!

# 5. Launch Reverse Worker
echo -e "${CYAN}[+] Starting Reverse Worker...${NC}"
setsid bash -c "cd '$ROOT_PATH/services/reverse-worker' && exec '$PYTHON_BIN' -m app.worker" \
    > "$LOGS_DIR/reverse_worker.log" 2> "$LOGS_DIR/reverse_worker.err.log" < /dev/null &
REV_PID=$!

# 6. Launch DLX Monitor
echo -e "${CYAN}[+] Starting DLX Monitor...${NC}"
setsid bash -c "cd '$ROOT_PATH/services/dlx-monitor' && exec '$PYTHON_BIN' -m app.telemetry" \
    > "$LOGS_DIR/dlx_monitor.log" 2> "$LOGS_DIR/dlx_monitor.err.log" < /dev/null &
DLX_PID=$!

# 7. Launch Web Studio Frontend (React 19 + WebGL2 on Port 5173)
WEB_PID=0
if command -v npm >/dev/null 2>&1; then
    echo -e "${CYAN}[+] Starting PixMath Web Studio (Port 5173)...${NC}"
    setsid bash -c "cd '$ROOT_PATH/apps/web-studio' && exec npm run dev -- --host 0.0.0.0" \
        > "$LOGS_DIR/web_studio.log" 2> "$LOGS_DIR/web_studio.err.log" < /dev/null &
    WEB_PID=$!
fi

# Save PIDs to JSON file for clean shutdown
cat <<EOF > "$ROOT_PATH/.pixmath_services.json"
{
  "Gateway": ${GATEWAY_PID:-0},
  "ForwardWorker": ${FWD_PID:-0},
  "ReverseWorker": ${REV_PID:-0},
  "DLXMonitor": ${DLX_PID:-0},
  "WebStudio": ${WEB_PID:-0}
}
EOF

# 8. Health Check Verification
echo -e "${CYAN}[+] Verifying service availability...${NC}"
RETRIES=8
GATEWAY_READY=0
while [ $RETRIES -gt 0 ] && [ $GATEWAY_READY -eq 0 ]; do
    sleep 1
    if command -v curl >/dev/null 2>&1; then
        HTTP_CODE="$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health || true)"
        if [ "$HTTP_CODE" = "200" ]; then
            GATEWAY_READY=1
        fi
    fi
    RETRIES=$((RETRIES - 1))
done

echo -e "\n${GREEN}============================================================${NC}"
echo -e "${GREEN}             PIXMATH SERVICES ONLINE & READY                ${NC}"
echo -e "${GREEN}============================================================${NC}\n"
echo -e "  * PixMath Web Studio:       ${YELLOW}http://localhost:5173${NC}"
echo -e "  * API Gateway:              ${CYAN}http://127.0.0.1:8000${NC}"
echo -e "  * Interactive GraphQL:      \033[0;35mhttp://127.0.0.1:8000/graphql${NC}"
echo -e "  * REST Swagger Docs:        \033[0;34mhttp://127.0.0.1:8000/docs${NC}"
echo -e "  * Health Status:            ${GREEN}http://127.0.0.1:8000/health${NC}"

if [ "$DOCKER_RUNNING" -eq 1 ]; then
    echo -e "  * RabbitMQ Management:      ${YELLOW}http://localhost:15672 (pixmath/pixmath)${NC}"
    echo -e "  * MinIO S3 Console:         ${CYAN}http://localhost:9001  (minioadmin/minioadmin)${NC}"
fi

echo -e "\n  * Service Logs directory:   ${GRAY}$LOGS_DIR${NC}\n"
echo -e "To stop all services cleanly, run:"
echo -e "  ${GREEN}./stop_project.sh${NC}\n"
