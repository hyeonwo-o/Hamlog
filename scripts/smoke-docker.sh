#!/usr/bin/env bash

set -euo pipefail

IMAGE="${1:?Usage: bash scripts/smoke-docker.sh <image>}"
CONTAINER_NAME="hamlog-docker-smoke-$$"
SMOKE_ROOT="$(mktemp -d /tmp/hamlog-docker-smoke.XXXXXX)"
HOST_UID="$(id -u)"
HOST_GID="$(id -g)"
TEST_DATA_GID=23456
if [ "$TEST_DATA_GID" = "$HOST_GID" ]; then
  TEST_DATA_GID=23457
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

cleanup() {
  local exit_code=$?

  docker rm -f "$CONTAINER_NAME" >/dev/null 2>&1 || true
  docker run --rm \
    --user root \
    --network none \
    --entrypoint sh \
    -v "$SMOKE_ROOT:/smoke" \
    "$IMAGE" \
    -c 'chown -R "$1:$2" /smoke' sh "$HOST_UID" "$HOST_GID" \
    >/dev/null 2>&1 || true

  case "$SMOKE_ROOT" in
    /tmp/hamlog-docker-smoke.*) find "$SMOKE_ROOT" -depth -delete ;;
  esac

  exit "$exit_code"
}

trap cleanup EXIT

if docker inspect "$CONTAINER_NAME" >/dev/null 2>&1; then
  echo "Refusing to reuse an existing container: $CONTAINER_NAME" >&2
  exit 1
fi

mkdir -p "$SMOKE_ROOT/data" "$SMOKE_ROOT/uploads"

# Simulate bind mounts created by a different host uid.
docker run --rm \
  --user root \
  --network none \
  --entrypoint sh \
  -v "$SMOKE_ROOT/data:/app/server/data" \
  -v "$SMOKE_ROOT/uploads:/app/server/uploads" \
  "$IMAGE" \
  -c 'chown -R root:root /app/server/data /app/server/uploads && chmod 700 /app/server/data /app/server/uploads'

prepare_data() {
  local data_owner="$1"
  local data_gid="${2:-$HOST_GID}"
  docker run --rm \
    --user root \
    --network none \
    --cap-drop ALL \
    --cap-add CHOWN \
    --cap-add DAC_OVERRIDE \
    --cap-add FOWNER \
    --cap-add FSETID \
    --security-opt no-new-privileges \
    --entrypoint sh \
    -v "$SMOKE_ROOT/data:/app/server/data" \
    -v "$SMOKE_ROOT/uploads:/app/server/uploads" \
    "$IMAGE" \
    -c 'set -e
        chown -R "$1:$2" /app/server/data /app/server/uploads
        chmod -R u=rwX,g=rX,o= /app/server/data /app/server/uploads
        find /app/server/data /app/server/uploads -type d -exec chmod g+s {} +' \
    sh "$data_owner" "$data_gid"
}

start_container() {
  local runtime_user="$1"
  local version="$2"
  local -a user_args=()
  if [ -n "$runtime_user" ]; then
    user_args=(--user "$runtime_user")
  fi

  docker run -d \
    --name "$CONTAINER_NAME" \
    "${user_args[@]}" \
    --cap-drop ALL \
    --security-opt no-new-privileges \
    -v "$SMOKE_ROOT/data:/app/server/data" \
    -v "$SMOKE_ROOT/uploads:/app/server/uploads" \
    -e NODE_ENV=production \
    -e PORT=4000 \
    -e APP_VERSION="$version" \
    -e JWT_SECRET=docker-smoke-secret-long-enough \
    -e ADMIN_PASSWORD=docker-smoke-password-long-enough \
    "$IMAGE" >/dev/null
}

wait_for_health() {
  local expected_version="$1"
  local attempt=0

  until docker exec "$CONTAINER_NAME" node -e \
    "const expected = process.argv[1]; fetch('http://127.0.0.1:4000/api/health').then(async (response) => { const body = await response.json(); if (!response.ok || body.status !== 'ok' || body.version !== expected) process.exit(1); }).catch(() => process.exit(1))" \
    "$expected_version"; do
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 20 ]; then
      docker logs "$CONTAINER_NAME" || true
      return 1
    fi
    sleep 1
  done
}

verify_writable_mounts() {
  docker exec "$CONTAINER_NAME" node -e \
    "const fs = require('node:fs'); const created = []; try { for (const dir of ['/app/server/data', '/app/server/uploads']) created.push(fs.mkdtempSync(dir + '/.hamlog-write-check-')); } finally { for (const path of created.reverse()) fs.rmSync(path, { recursive: true, force: true }); }"
}

# Match the constrained preparation step used by Compose and deployment.
prepare_data node "$TEST_DATA_GID"
start_container "" docker-smoke
wait_for_health docker-smoke

if [ "$(docker exec "$CONTAINER_NAME" id -un)" != "node" ]; then
  echo "Container is not running as the node user." >&2
  exit 1
fi

docker exec "$CONTAINER_NAME" node -e \
  "const fs = require('node:fs'); const expected = Number(process.argv[1]); const data = fs.statSync('/app/server/data'); const postsDir = fs.statSync('/app/server/data/posts'); const posts = fs.statSync('/app/server/data/posts.json'); if ((data.mode & 0o2000) === 0 || (postsDir.mode & 0o2000) === 0 || data.gid !== expected || postsDir.gid !== expected || posts.gid !== expected || (posts.mode & 0o007) !== 0) process.exit(1);" \
  "$TEST_DATA_GID"

verify_writable_mounts

if docker exec "$CONTAINER_NAME" node -e \
  "require('node:fs').writeFileSync('/app/server/.hamlog-code-write-check', 'no')" \
  >/dev/null 2>&1; then
  echo "Application source is unexpectedly writable by the runtime user." >&2
  exit 1
fi

docker rm -f "$CONTAINER_NAME" >/dev/null

# Reproduce the one-release rollback path from the former root image and verify
# that the paused-container backup can still read, validate, and archive data.
prepare_data root "$HOST_GID"
start_container root docker-smoke-root
wait_for_health docker-smoke-root
verify_writable_mounts

if [ "$(docker exec "$CONTAINER_NAME" id -un)" != "root" ]; then
  echo "Legacy rollback container is not running as root." >&2
  exit 1
fi

mkdir -p "$SMOKE_ROOT/backups"
HAMLOG_CONTAINER_NAME="$CONTAINER_NAME" \
  HAMLOG_VERIFY_DATA=true \
  HAMLOG_ALLOW_EMPTY_BACKUP=false \
  HAMLOG_BACKUP_HOOK= \
  BACKUP_RETENTION_DAYS=30 \
  bash "$SCRIPT_DIR/backup-data.sh" "$SMOKE_ROOT" "$SMOKE_ROOT/backups"

if [ "$(find "$SMOKE_ROOT/backups" -maxdepth 1 -type f -name 'hamlog-*.tar.gz' | wc -l)" -ne 1 ] \
  || [ "$(find "$SMOKE_ROOT/backups" -maxdepth 1 -type f -name 'hamlog-*.tar.gz.sha256' | wc -l)" -ne 1 ] \
  || [ "$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME")" != "running" ]; then
  echo "Legacy rollback backup smoke verification failed." >&2
  exit 1
fi

echo "Docker smoke test passed: non-root runtime, writable mounts, read-only source, and legacy rollback backup."
