#!/usr/bin/env bash
# One-shot VPS prep: external Docker network, volumes, Postgres + MinIO + app, bucket setup.
# Run from repo root as the user that owns Docker (e.g. dockeruser). Requires curl.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.dockeruser.yml}"

docker network create dockeruser_network 2>/dev/null || true
mkdir -p "${HOME}/docker-volumes/askmak/pgdata" "${HOME}/docker-volumes/askmak/minio"

docker compose -f "$COMPOSE_FILE" up -d --build

echo "Waiting for PostgreSQL..."
for i in $(seq 1 90); do
  if docker compose -f "$COMPOSE_FILE" exec -T db pg_isready -U askmak -d askmak >/dev/null 2>&1; then
    echo "PostgreSQL is ready."
    break
  fi
  if [[ "$i" -eq 90 ]]; then
    echo "PostgreSQL did not become ready in time. Check: docker compose -f $COMPOSE_FILE logs db"
    exit 1
  fi
  sleep 1
done

echo "Waiting for MinIO..."
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:4900/minio/health/live >/dev/null 2>&1; then
    echo "MinIO is ready."
    break
  fi
  if [[ "$i" -eq 60 ]]; then
    echo "MinIO did not become ready in time. Check: docker compose -f $COMPOSE_FILE logs minio"
    exit 1
  fi
  sleep 1
done

docker compose -f "$COMPOSE_FILE" run --rm app npm run setup-minio

echo "VPS bootstrap complete. API: http://127.0.0.1:4500 — logs: docker compose -f $COMPOSE_FILE logs -f app"
