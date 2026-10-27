#!/usr/bin/env bash
# ==============================================================================
# PixMath Full Stack Shutdown Script for Linux / Ubuntu
# ==============================================================================

set -u

YELLOW='\033[1;33m'
GREEN='\033[0;32m'
GRAY='\033[0;90m'
NC='\033[0m'

echo -e "\n${YELLOW}============================================================${NC}"
echo -e "${YELLOW}             PIXMATH -- STOPPING ALL SERVICES                ${NC}"
echo -e "${YELLOW}============================================================${NC}\n"

ROOT_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_PATH"

PID_FILE="$ROOT_PATH/.pixmath_services.json"

kill_pid_gracefully() {
    local pid="$1"
    local name="$2"
    if [ -n "$pid" ] && [ "$pid" -gt 0 ] 2>/dev/null; then
        if kill -0 "$pid" 2>/dev/null; then
            echo -e "${GRAY}[+] Stopping $name (PID: $pid)...${NC}"
            kill -15 "$pid" 2>/dev/null || true
            for _ in 1 2 3 4 5; do
                if ! kill -0 "$pid" 2>/dev/null; then
                    break
                fi
                sleep 0.2
            done
            if kill -0 "$pid" 2>/dev/null; then
                kill -9 "$pid" 2>/dev/null || true
            fi
        fi
    fi
}

# 1. Stop tracked services from JSON
if [ -f "$PID_FILE" ]; then
    if command -v python3 >/dev/null 2>&1; then
        python3 -c "
import json
try:
    with open('$PID_FILE') as f:
        data = json.load(f)
        for k, v in data.items():
            if v and v > 0:
                print(f'{k}:{v}')
except Exception:
    pass
" | while IFS=":" read -r name pid; do
            kill_pid_gracefully "$pid" "$name"
        done
    elif command -v jq >/dev/null 2>&1; then
        for service in Gateway ForwardWorker ReverseWorker DLXMonitor WebStudio; do
            PID="$(jq -r ".$service // empty" "$PID_FILE" 2>/dev/null)"
            kill_pid_gracefully "$PID" "$service"
        done
    fi
    rm -f "$PID_FILE"
fi

# 2. Free listening ports 8000 and 5173 if any lingering child process exists
for PORT in 8000 5173; do
    if command -v fuser >/dev/null 2>&1; then
        fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
    elif command -v lsof >/dev/null 2>&1; then
        PIDS="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
        if [ -n "$PIDS" ]; then
            echo -e "${GRAY}[+] Freeing lingering processes on port $PORT ($PIDS)...${NC}"
            # shellcheck disable=SC2086
            kill -9 $PIDS 2>/dev/null || true
        fi
    fi
done

# 3. Stop Docker infrastructure if active
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo -e "${GRAY}[+] Stopping Docker infrastructure...${NC}"
    docker compose -f infra/compose.yaml stop >/dev/null 2>&1 || true
fi

echo -e "\n${GREEN}[OK] All PixMath services have been stopped successfully.${NC}\n"
