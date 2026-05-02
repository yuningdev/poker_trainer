#!/usr/bin/env bash
set -euo pipefail

IMAGE="poker-trainer:latest"
CONTAINER="poker-trainer"
PORT=8000

echo "Building Docker image: $IMAGE"
docker build -t "$IMAGE" .

echo "Removing old container (if any)..."
docker rm -f "$CONTAINER" 2>/dev/null || true

echo "Starting container: $CONTAINER"
docker run -d \
  --name "$CONTAINER" \
  -p "$PORT:$PORT" \
  "$IMAGE"

echo ""
echo "Server is running at http://localhost:$PORT"
