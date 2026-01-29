#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== GuardSpine Local Setup ==="
echo ""

# Step 1: Install root dependencies and build
echo "[1/5] Installing root dependencies..."
cd "$ROOT_DIR"
npm install

echo "[2/5] Building n8n nodes (tsc compile)..."
npm run build

# Step 3: Install mock-api dependencies
echo "[3/5] Installing mock-api dependencies..."
cd "$ROOT_DIR/mock-api"
npm install
cd "$ROOT_DIR"

# Step 4: Start docker-compose
echo "[4/5] Starting docker-compose..."
docker-compose up -d

# Step 5: Wait for n8n to be ready
echo "[5/5] Waiting for n8n to be ready..."
MAX_ATTEMPTS=30
ATTEMPT=0
while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    ATTEMPT=$((ATTEMPT + 1))
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:5678/healthz 2>/dev/null | grep -q "200"; then
        echo "  n8n is ready!"
        break
    fi
    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
        echo "  ERROR: n8n did not become ready after $MAX_ATTEMPTS attempts."
        echo "  Check logs with: docker-compose logs n8n"
        exit 1
    fi
    echo "  Attempt $ATTEMPT/$MAX_ATTEMPTS - waiting 5s..."
    sleep 5
done

# Import example workflows
echo ""
echo "Importing example workflows..."
WORKFLOW_DIR="$ROOT_DIR/examples/workflows"
if [ -d "$WORKFLOW_DIR" ]; then
    for wf in "$WORKFLOW_DIR"/*.json; do
        if [ -f "$wf" ]; then
            NAME="$(basename "$wf")"
            echo "  Importing $NAME..."
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
                -X POST http://localhost:5678/api/v1/workflows \
                -H "Content-Type: application/json" \
                -d @"$wf")
            if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
                echo "    OK ($HTTP_CODE)"
            else
                echo "    WARNING: Got HTTP $HTTP_CODE for $NAME"
            fi
        fi
    done
else
    echo "  No workflow directory found at $WORKFLOW_DIR - skipping import."
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "  n8n UI:    http://localhost:5678"
echo "  Mock API:  http://localhost:8000"
echo ""
echo "  Stop with: docker-compose down"
echo "  Logs with: docker-compose logs -f"
