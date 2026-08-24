#!/usr/bin/env bash

set -euo pipefail

SOURCE_ROOT="${1:-${HAMLOG_DATA_ROOT:-$HOME/hamlog-data}}"
BACKUP_ROOT="${2:-${HAMLOG_BACKUP_DIR:-$HOME/hamlog-backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
CONTAINER_NAME="${HAMLOG_CONTAINER_NAME-hamlog}"
ALLOW_EMPTY_BACKUP="${HAMLOG_ALLOW_EMPTY_BACKUP:-false}"
VERIFY_DATA="${HAMLOG_VERIFY_DATA:-false}"
BACKUP_HOOK="${HAMLOG_BACKUP_HOOK:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
  exit 1
fi

for boolean_value in "$ALLOW_EMPTY_BACKUP" "$VERIFY_DATA"; do
  if [ "$boolean_value" != "true" ] && [ "$boolean_value" != "false" ]; then
    echo "HAMLOG_ALLOW_EMPTY_BACKUP and HAMLOG_VERIFY_DATA must be true or false." >&2
    exit 1
  fi
done

declare -a source_entries=()
for entry in data uploads; do
  if [ -d "$SOURCE_ROOT/$entry" ]; then
    source_entries+=("$entry")
  fi
done

has_source_content=false
for entry in "${source_entries[@]}"; do
  if [ -n "$(find "$SOURCE_ROOT/$entry" -mindepth 1 -print -quit)" ]; then
    has_source_content=true
    break
  fi
done

if [ "${#source_entries[@]}" -eq 0 ] || [ "$has_source_content" = false ]; then
  if [ "$ALLOW_EMPTY_BACKUP" = true ]; then
    echo "No existing HamLog data found under $SOURCE_ROOT; empty backup explicitly allowed."
    mkdir -p "$SOURCE_ROOT/data" "$SOURCE_ROOT/uploads"
    source_entries=(data uploads)
  else
    echo "No existing HamLog data found under $SOURCE_ROOT; refusing to create an empty backup." >&2
    exit 1
  fi
fi

mkdir -p "$BACKUP_ROOT"

timestamp="$(date -u +'%Y%m%dT%H%M%SZ')"
backup_suffix="${GITHUB_SHA:-}"
backup_suffix="${backup_suffix:0:7}"
if [ -n "$backup_suffix" ]; then
  backup_name="hamlog-$timestamp-$backup_suffix.tar.gz"
else
  backup_name="hamlog-$timestamp-$$.tar.gz"
fi

archive_path="$BACKUP_ROOT/$backup_name"
checksum_path="$archive_path.sha256"
temporary_archive="$(mktemp "$BACKUP_ROOT/.hamlog-backup.XXXXXX")"
container_paused=false
backup_complete=false
verification_root=""
snapshot_pid=""

resume_container() {
  if [ "$container_paused" != true ]; then
    return 0
  fi

  if docker unpause "$CONTAINER_NAME" >/dev/null; then
    container_paused=false
    return 0
  fi

  return 1
}

remove_verification_root() {
  if [ -z "${verification_root:-}" ] || [ ! -d "$verification_root" ]; then
    verification_root=""
    return 0
  fi

  case "$verification_root" in
    "$BACKUP_ROOT"/.hamlog-verify.*)
      find "$verification_root" -depth -delete
      verification_root=""
      ;;
    *)
      echo "Refusing to remove unexpected verification directory: $verification_root" >&2
      return 1
      ;;
  esac
}

cleanup() {
  local exit_code=$?

  trap - EXIT
  trap '' HUP INT TERM
  resume_container >/dev/null 2>&1 || true

  if [ -n "${snapshot_pid:-}" ]; then
    kill -TERM "$snapshot_pid" >/dev/null 2>&1 || true
    wait "$snapshot_pid" >/dev/null 2>&1 || true
    snapshot_pid=""
  fi

  remove_verification_root >/dev/null 2>&1 || true

  if [ -n "${temporary_archive:-}" ] && [ -f "$temporary_archive" ]; then
    rm -f "$temporary_archive"
  fi

  if [ "$backup_complete" = false ]; then
    rm -f "$archive_path" "$checksum_path"
  fi

  exit "$exit_code"
}

handle_signal() {
  case "$1" in
    HUP) exit 129 ;;
    INT) exit 130 ;;
    TERM) exit 143 ;;
  esac
}

trap cleanup EXIT
trap 'handle_signal HUP' HUP
trap 'handle_signal INT' INT
trap 'handle_signal TERM' TERM

verifier_path=""
container_image=""
container_runtime_user=""

if [ "$VERIFY_DATA" = true ] && [ "$has_source_content" = true ]; then
  if [ ! -d "$SOURCE_ROOT/data" ]; then
    echo "Data verification requested, but $SOURCE_ROOT/data does not exist." >&2
    exit 1
  fi

  verifier_path="$SCRIPT_DIR/verify-data.js"
  if [ ! -f "$verifier_path" ]; then
    echo "Data verifier not found: $verifier_path" >&2
    exit 1
  fi

  if [ -n "$CONTAINER_NAME" ] && command -v docker >/dev/null 2>&1; then
    container_image="$(docker inspect --format='{{.Config.Image}}' "$CONTAINER_NAME" 2>/dev/null || true)"
    container_runtime_user="$(docker inspect --format='{{.Config.User}}' "$CONTAINER_NAME" 2>/dev/null || true)"
  fi

  if [ -z "$container_image" ] && ! command -v node >/dev/null 2>&1; then
    echo "Data verification requires Node.js or an existing HamLog container image." >&2
    exit 1
  fi
fi

if [ -n "$CONTAINER_NAME" ] \
  && command -v docker >/dev/null 2>&1 \
  && [ "$(docker inspect --format='{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)" = "true" ]; then
  if [ "$(docker inspect --format='{{.State.Paused}}' "$CONTAINER_NAME" 2>/dev/null || true)" = "true" ]; then
    echo "Container is already paused; refusing to change its existing state: $CONTAINER_NAME" >&2
    exit 1
  fi

  # Mark ownership of the pause before invoking Docker so signal cleanup also
  # covers the narrow interval in which `docker pause` is completing.
  container_paused=true
  docker pause "$CONTAINER_NAME" >/dev/null
fi

tar -C "$SOURCE_ROOT" -czf "$temporary_archive" "${source_entries[@]}" &
snapshot_pid=$!
if wait "$snapshot_pid"; then
  snapshot_pid=""
else
  snapshot_status=$?
  snapshot_pid=""
  exit "$snapshot_status"
fi
resume_container

tar -tzf "$temporary_archive" >/dev/null

if [ "$VERIFY_DATA" = true ] && [ "$has_source_content" = false ]; then
  echo "Data verification skipped because an empty backup was explicitly allowed."
elif [ "$VERIFY_DATA" = true ]; then
  verification_root="$(mktemp -d "$BACKUP_ROOT/.hamlog-verify.XXXXXX")"
  tar -xzf "$temporary_archive" -C "$verification_root" data

  if [ -n "$container_image" ]; then
    container_runtime_user="${container_runtime_user:-root}"
    docker run --rm \
      --network none \
      --read-only \
      --cap-drop ALL \
      --cap-add DAC_READ_SEARCH \
      --security-opt no-new-privileges \
      --user "$container_runtime_user" \
      -v "$verification_root/data:/app/server/data:ro" \
      -v "$verifier_path:/verify-data.js:ro" \
      -e HAMLOG_DATA_DIR=/app/server/data \
      -e HAMLOG_REQUIRE_DATA=true \
      --entrypoint node \
      "$container_image" \
      /verify-data.js
  else
    HAMLOG_DATA_DIR="$verification_root/data" HAMLOG_REQUIRE_DATA=true node "$verifier_path"
  fi

  remove_verification_root
fi

mv "$temporary_archive" "$archive_path"
temporary_archive=""

(
  cd "$BACKUP_ROOT"
  sha256sum "$backup_name" > "$(basename "$checksum_path")"
  sha256sum -c "$(basename "$checksum_path")"
)
backup_complete=true

if [ -n "$BACKUP_HOOK" ]; then
  case "$BACKUP_HOOK" in
    /*) ;;
    *)
      echo "HAMLOG_BACKUP_HOOK must be an absolute path." >&2
      exit 1
      ;;
  esac

  if [ ! -x "$BACKUP_HOOK" ]; then
    echo "Configured backup hook is not executable: $BACKUP_HOOK" >&2
    exit 1
  fi

  "$BACKUP_HOOK" "$archive_path" "$checksum_path"
fi

find "$BACKUP_ROOT" -maxdepth 1 -type f \
  \( -name 'hamlog-*.tar.gz' -o -name 'hamlog-*.tar.gz.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "HamLog backup created: $archive_path"
