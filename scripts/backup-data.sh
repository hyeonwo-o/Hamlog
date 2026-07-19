#!/usr/bin/env bash

set -euo pipefail

SOURCE_ROOT="${1:-${HAMLOG_DATA_ROOT:-$HOME/hamlog-data}}"
BACKUP_ROOT="${2:-${HAMLOG_BACKUP_DIR:-$HOME/hamlog-backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
CONTAINER_NAME="${HAMLOG_CONTAINER_NAME-hamlog}"

if ! [[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]]; then
  echo "BACKUP_RETENTION_DAYS must be a non-negative integer." >&2
  exit 1
fi

declare -a source_entries=()
for entry in data uploads; do
  if [ -d "$SOURCE_ROOT/$entry" ]; then
    source_entries+=("$entry")
  fi
done

if [ "${#source_entries[@]}" -eq 0 ]; then
  echo "No HamLog data directories found under $SOURCE_ROOT; backup skipped."
  exit 0
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

cleanup() {
  local exit_code=$?

  if [ "$container_paused" = true ]; then
    docker unpause "$CONTAINER_NAME" >/dev/null 2>&1 || true
  fi

  if [ -n "${temporary_archive:-}" ] && [ -f "$temporary_archive" ]; then
    rm -f "$temporary_archive"
  fi

  if [ "$backup_complete" = false ]; then
    rm -f "$archive_path" "$checksum_path"
  fi

  exit "$exit_code"
}

trap cleanup EXIT

if [ -n "$CONTAINER_NAME" ] \
  && command -v docker >/dev/null 2>&1 \
  && [ "$(docker inspect --format='{{.State.Running}}' "$CONTAINER_NAME" 2>/dev/null || true)" = "true" ]; then
  docker pause "$CONTAINER_NAME" >/dev/null
  container_paused=true
fi

tar -C "$SOURCE_ROOT" -czf "$temporary_archive" "${source_entries[@]}"
tar -tzf "$temporary_archive" >/dev/null
mv "$temporary_archive" "$archive_path"
temporary_archive=""

(
  cd "$BACKUP_ROOT"
  sha256sum "$backup_name" > "$(basename "$checksum_path")"
)
backup_complete=true

if [ "$container_paused" = true ]; then
  docker unpause "$CONTAINER_NAME" >/dev/null
  container_paused=false
fi

find "$BACKUP_ROOT" -maxdepth 1 -type f \
  \( -name 'hamlog-*.tar.gz' -o -name 'hamlog-*.tar.gz.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete

echo "HamLog backup created: $archive_path"
