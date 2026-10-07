#!/usr/bin/env bash

set -euo pipefail
umask 077

ARCHIVE="${1:?Usage: bash scripts/restore-data.sh <backup.tar.gz> [data-root]}"
TARGET_ROOT="${2:-${HAMLOG_DATA_ROOT:-$HOME/hamlog-data}}"
CONTAINER_NAME="${HAMLOG_CONTAINER_NAME-hamlog}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORK_ROOT=""
ORIGINAL_ROOT=""
CUTOVER_ARMED=false
COMMITTED=false
WAS_RUNNING=false
KEEP_WORK=false
CONTAINER_IMAGE=""
DATA_OWNER=""
MOVE_HELPER_NAME=""
MOVE_HELPER_ID=""
MOVE_HELPER_ACTIVE=false
declare -A ORIGINAL_EXISTS=()

fail() {
  echo "$*" >&2
  exit 1
}

[ -f "$ARCHIVE" ] || fail "Backup archive not found: $ARCHIVE"
[ -f "$ARCHIVE.sha256" ] || fail "Backup checksum not found: $ARCHIVE.sha256"
ARCHIVE="$(realpath "$ARCHIVE")"
mkdir -p "$TARGET_ROOT"
TARGET_ROOT="$(realpath "$TARGET_ROOT")"
[ "$TARGET_ROOT" != / ] || fail "Refusing to restore into the filesystem root."
for entry in data uploads; do
  [ ! -L "$TARGET_ROOT/$entry" ] || fail "Restore target must not be a symbolic link: $entry"
  [ ! -e "$TARGET_ROOT/$entry" ] || [ -d "$TARGET_ROOT/$entry" ] || fail "Restore target is not a directory: $entry"
  ORIGINAL_EXISTS[$entry]=false
  if [ -d "$TARGET_ROOT/$entry" ]; then ORIGINAL_EXISTS[$entry]=true; fi
done

LOCK_ROOT="$TARGET_ROOT/.hamlog-restore-lock"
mkdir "$LOCK_ROOT" || fail "Another restore may be active; lock exists: $LOCK_ROOT"

read_container_running() {
  CURRENT_RUNNING="$(docker inspect --format='{{.State.Running}}' "$CONTAINER_NAME")" || return 1
  [ "$CURRENT_RUNNING" = true ] || [ "$CURRENT_RUNNING" = false ]
}

quiesce_move_helper() {
  if [ "$MOVE_HELPER_ACTIVE" = false ]; then return 0; fi
  # Removing the fixed container ID also invalidates any delayed start request.
  # A create interrupted before its ID was captured can only leave a stopped
  # helper, which is located by its unique name/label instead.
  local remaining
  remaining="$(docker ps -a --filter "label=hamlog.restore.id=$MOVE_HELPER_NAME" --format '{{.ID}}')" || return 1
  while IFS= read -r helper_id; do
    if [ -n "$helper_id" ]; then docker rm -f "$helper_id" >/dev/null 2>&1 || true; fi
  done <<< "$remaining"
  remaining="$(docker ps -a --filter "label=hamlog.restore.id=$MOVE_HELPER_NAME" --format '{{.ID}}')" || return 1
  [ -z "$remaining" ] || return 1
  MOVE_HELPER_ACTIVE=false
  MOVE_HELPER_ID=""
}

move_directory() {
  local source="$1"
  local destination="$2"
  if [ -z "$CONTAINER_NAME" ]; then
    # Offline restores already require host Node.js. Rename, rather than copy
    # across filesystems, so a failed move leaves the source intact.
    node -e "require('node:fs').renameSync(process.argv[1], process.argv[2])" "$source" "$destination"
    return
  fi
  [[ "$source" == "$TARGET_ROOT/"* && "$destination" == "$TARGET_ROOT/"* ]] || return 1
  MOVE_HELPER_ACTIVE=true
  MOVE_HELPER_ID="$(docker create --name "$MOVE_HELPER_NAME" \
    --label "hamlog.restore.id=$MOVE_HELPER_NAME" \
    --user root --network none --read-only --cap-drop ALL --cap-add DAC_OVERRIDE \
    --security-opt no-new-privileges -v "$TARGET_ROOT:/restore" \
    --entrypoint node "$CONTAINER_IMAGE" \
    -e "require('node:fs').renameSync(process.argv[1], process.argv[2])" \
    "/restore/${source#"$TARGET_ROOT/"}" "/restore/${destination#"$TARGET_ROOT/"}")" || return 1
  [[ "$MOVE_HELPER_ID" =~ ^[0-9a-f]{64}$ ]] || return 1
  docker start --attach "$MOVE_HELPER_ID" || return 1
  # Docker start --attach reports CLI success even when the container command
  # exits nonzero; read its exit code before considering the rename complete.
  [ "$(docker inspect --format='{{.State.Running}}' "$MOVE_HELPER_ID")" = false ] || return 1
  [ "$(docker inspect --format='{{.State.ExitCode}}' "$MOVE_HELPER_ID")" = 0 ] || return 1
  quiesce_move_helper
}

rollback() {
  # A failed start can still have started the container. Stop it before moving
  # bind-mount sources back, and preserve both snapshots if recovery fails.
  if [ -n "$CONTAINER_NAME" ]; then
    read_container_running || return 1
    if [ "$CURRENT_RUNNING" = true ]; then docker stop "$CONTAINER_NAME" >/dev/null || return 1; fi
  fi
  for entry in data uploads; do
    if [ -d "$ORIGINAL_ROOT/$entry" ]; then
      if [ -e "$TARGET_ROOT/$entry" ]; then
        move_directory "$TARGET_ROOT/$entry" "$WORK_ROOT/failed-$entry" || return 1
      fi
      move_directory "$ORIGINAL_ROOT/$entry" "$TARGET_ROOT/$entry" || return 1
    elif [ "${ORIGINAL_EXISTS[$entry]}" = false ] && [ -e "$TARGET_ROOT/$entry" ]; then
      move_directory "$TARGET_ROOT/$entry" "$WORK_ROOT/failed-$entry" || return 1
    fi
  done
  if [ "$WAS_RUNNING" = true ]; then
    docker start "$CONTAINER_NAME" >/dev/null || return 1
  fi
}

cleanup() {
  local exit_status=$?
  local keep_lock=false
  trap - EXIT
  trap '' HUP INT TERM
  if [ "$CUTOVER_ARMED" = true ] && [ "$COMMITTED" = false ]; then
    KEEP_WORK=true
    echo "Restore did not commit; recovering the original directories." >&2
    if quiesce_move_helper && rollback; then
      echo "Original directories and previous container state restored." >&2
    else
      if ! quiesce_move_helper; then
        keep_lock=true
        echo "Could not confirm that the move helper stopped; restore lock retained." >&2
      fi
      echo "Automatic recovery failed. Preserved snapshots: $ORIGINAL_ROOT and $WORK_ROOT" >&2
    fi
    if [ "$exit_status" -eq 0 ]; then exit_status=1; fi
  fi
  if [ -n "$WORK_ROOT" ] && [ "$KEEP_WORK" = false ]; then
    rm -rf -- "$WORK_ROOT" || true
  elif [ -n "$WORK_ROOT" ]; then
    echo "Uncommitted restore files retained at: $WORK_ROOT" >&2
  fi
  if [ -n "$ORIGINAL_ROOT" ]; then rmdir "$ORIGINAL_ROOT" 2>/dev/null || true; fi
  if [ "$keep_lock" = false ]; then rmdir "$LOCK_ROOT" 2>/dev/null || true; fi
  exit "$exit_status"
}

trap cleanup EXIT
trap 'exit 129' HUP
trap 'exit 130' INT
trap 'exit 143' TERM

WORK_ROOT="$(mktemp -d "$TARGET_ROOT/.hamlog-restore.XXXXXX")"
MOVE_HELPER_NAME="hamlog-restore-move-$$-${WORK_ROOT##*.}"
cp -- "$ARCHIVE" "$WORK_ROOT/archive.tar.gz"
mapfile -t checksum_lines < "$ARCHIVE.sha256"
[ "${#checksum_lines[@]}" -eq 1 ] || fail "Checksum file must contain exactly one archive checksum."
checksum_pattern='^([[:xdigit:]]{64}) [ *](.+)$'
[[ "${checksum_lines[0]}" =~ $checksum_pattern ]] || fail "Invalid SHA-256 checksum format."
EXPECTED_CHECKSUM="${BASH_REMATCH[1],,}"
[ "${BASH_REMATCH[2]}" = "$(basename "$ARCHIVE")" ] || fail "Checksum filename does not match the selected archive."
actual_checksum="$(sha256sum "$WORK_ROOT/archive.tar.gz")"
[ "${actual_checksum%% *}" = "$EXPECTED_CHECKSUM" ] || fail "Backup checksum mismatch."

# GNU tar prints logical member names after processing extended headers. Reject
# links, special files and escaped/control-character names before extraction.
LC_ALL=C.UTF-8 tar --list --gzip --verbose --numeric-owner --absolute-names \
  --quoting-style=escape --file "$WORK_ROOT/archive.tar.gz" > "$WORK_ROOT/members"
member_pattern='^([-d])[^[:space:]]*[[:space:]]+[0-9]+/[0-9]+[[:space:]]+[0-9]+[[:space:]]+[0-9-]+[[:space:]]+[0-9:]+[[:space:]]+(.+)$'
declare -A members=()
while IFS= read -r line; do
  [[ "$line" =~ $member_pattern ]] || fail "Archive contains a link, special file, or unsupported member."
  member_type="${BASH_REMATCH[1]}"
  member="${BASH_REMATCH[2]}"
  member="${member%/}"
  [[ "$member" != *\\* && "$member" != /* && "$member" != *[[:cntrl:]]* ]] || fail "Unsafe archive member: $member"
  case "$member" in
    data|uploads) [ "$member_type" = d ] || fail "Archive roots must be directories." ;;
    data/*|uploads/*) ;;
    *) fail "Archive member is outside data/uploads: $member" ;;
  esac
  case "/$member/" in
    *'/../'*|*'/./'*|*'//'*) fail "Unsafe archive path: $member" ;;
  esac
  [ -z "${members[$member]+present}" ] || fail "Duplicate archive member: $member"
  members[$member]="$member_type"
done < "$WORK_ROOT/members"
[ "${members[data]:-}" = d ] && [ "${members[uploads]:-}" = d ] || fail "A complete data/uploads snapshot is required."

mkdir "$WORK_ROOT/payload"
tar --extract --gzip --file "$WORK_ROOT/archive.tar.gz" --directory "$WORK_ROOT/payload" \
  --no-same-owner --no-same-permissions --delay-directory-restore
chmod -R u=rwX,g=rX,o=,a-s,a-t "$WORK_ROOT/payload"

if [ -n "$CONTAINER_NAME" ]; then
  command -v docker >/dev/null 2>&1 || fail "Docker is required for the configured container."
  CONTAINER_IMAGE="$(docker inspect --format='{{.Image}}' "$CONTAINER_NAME")"
  runtime_user="$(docker inspect --format='{{.Config.User}}' "$CONTAINER_NAME")"
  case "$runtime_user" in
    ''|root|0|0:0|root:root) DATA_OWNER=root ;;
    node|node:node|1000|1000:1000) DATA_OWNER=node ;;
    *) fail "Unsupported container runtime user: $runtime_user" ;;
  esac
  [ "$(docker inspect --format='{{.State.Paused}}' "$CONTAINER_NAME")" = false ] || fail "Refusing to restore a paused container."
  mount_listing="$(docker inspect --format='{{range .Mounts}}{{printf "%s\t%s\n" .Source .Destination}}{{end}}' "$CONTAINER_NAME")"
  declare -A matching_mounts=()
  while IFS=$'\t' read -r source destination; do
    case "$destination" in
      /app/server/data) [ "$source" = "$TARGET_ROOT/data" ] && matching_mounts[data]=true ;;
      /app/server/uploads) [ "$source" = "$TARGET_ROOT/uploads" ] && matching_mounts[uploads]=true ;;
    esac
  done <<< "$mount_listing"
  [ "${matching_mounts[data]:-}" = true ] && [ "${matching_mounts[uploads]:-}" = true ] || fail "Container mounts do not match the restore target."
  read_container_running || fail "Could not determine whether the container is running."
  WAS_RUNNING="$CURRENT_RUNNING"
fi

if command -v node >/dev/null 2>&1; then
  HAMLOG_DATA_DIR="$WORK_ROOT/payload/data" HAMLOG_REQUIRE_DATA=true node "$SCRIPT_DIR/verify-data.js"
elif [ -n "$CONTAINER_IMAGE" ]; then
  docker run --rm --network none --read-only --cap-drop ALL --cap-add DAC_READ_SEARCH \
    --security-opt no-new-privileges --user root \
    -v "$WORK_ROOT/payload/data:/app/server/data:ro" -v "$SCRIPT_DIR/verify-data.js:/verify-data.js:ro" \
    -e HAMLOG_DATA_DIR=/app/server/data -e HAMLOG_REQUIRE_DATA=true \
    --entrypoint node "$CONTAINER_IMAGE" /verify-data.js
else
  fail "Data verification requires Node.js or a configured container image."
fi

if [ -n "$CONTAINER_NAME" ]; then
  # Prepare only the isolated replacement, leaving live data untouched.
  KEEP_WORK=true
  docker run --rm --user root --network none --cap-drop ALL \
    --cap-add CHOWN --cap-add DAC_OVERRIDE --cap-add FOWNER --cap-add FSETID \
    --security-opt no-new-privileges --entrypoint sh \
    -v "$WORK_ROOT/payload/data:/app/server/data" -v "$WORK_ROOT/payload/uploads:/app/server/uploads" \
    "$CONTAINER_IMAGE" -c 'set -e
      chown -R "$1:$2" /app/server/data /app/server/uploads
      chmod -R u=rwX,g=rX,o= /app/server/data /app/server/uploads
      find /app/server/data /app/server/uploads -type d -exec chmod g+s {} +' \
    sh "$DATA_OWNER" "$(id -g)"
fi

ORIGINAL_ROOT="$(mktemp -d "$TARGET_ROOT/.hamlog-before-restore.XXXXXX")"
if [ -n "$CONTAINER_NAME" ]; then
  read_container_running || fail "Could not determine whether the container is running."
  [ "$CURRENT_RUNNING" = "$WAS_RUNNING" ] || fail "Container state changed during restore; retry after other operations finish."
fi
CUTOVER_ARMED=true
if [ "$WAS_RUNNING" = true ]; then docker stop "$CONTAINER_NAME" >/dev/null; fi
for entry in data uploads; do
  if [ "${ORIGINAL_EXISTS[$entry]}" = true ]; then move_directory "$TARGET_ROOT/$entry" "$ORIGINAL_ROOT/$entry"; fi
done
for entry in data uploads; do move_directory "$WORK_ROOT/payload/$entry" "$TARGET_ROOT/$entry"; done
if [ "$WAS_RUNNING" = true ]; then
  docker start "$CONTAINER_NAME" >/dev/null
  healthy=false
  for ((attempt=0; attempt<20; attempt++)); do
    if docker exec "$CONTAINER_NAME" node -e \
      "fetch('http://127.0.0.1:4000/api/health', { signal: AbortSignal.timeout(5000) }).then(async (r) => { if (!r.ok || (await r.json()).status !== 'ok') process.exit(1); }).catch(() => process.exit(1))"; then
      healthy=true
      break
    fi
    sleep 1
  done
  [ "$healthy" = true ] || fail "Restored container failed its health check."
fi
COMMITTED=true
KEEP_WORK=false
echo "Restore complete: $TARGET_ROOT"
if [ "${ORIGINAL_EXISTS[data]}" = true ] || [ "${ORIGINAL_EXISTS[uploads]}" = true ]; then
  echo "Original data retained at: $ORIGINAL_ROOT"
else
  echo "No previous data directories existed."
fi
