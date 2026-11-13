#!/usr/bin/env bash
#
# Load-tests the PIH OCL export in this repo on a real OpenMRS database before it's merged.
#
# Builds pihemr (with the export in content/configuration/backend_configuration/ocl/), builds the
# ZL EMR distribution on top of it, and starts it in a throwaway openmrs-docker instance restored
# from the nightly ZL seed image (partnersinhealth/zl-emr-seed-haiti). The seed's database already
# has the export from master loaded, so this is the same upgrade production servers go through.
# It passes if Initializer loads the new export and the OCL module records no errors.
#
# Used by the "Update OCL export" GitHub Action and by the PIH "ocl" Claude skill, so both run
# exactly the same test. It takes about 5-10 minutes (5 1/2 on a GitHub runner for 1.8.58).
#
# Needs: Docker, Java 8, Maven, git, unzip, jq, python3.
#
# Exit status: 0 the export loaded cleanly, 1 it didn't (import errors, or OpenMRS didn't start),
# 2 the test couldn't run (bad arguments, a build failure, a missing tool).
#
# The instance is stopped at the end but not destroyed, so you can look at it. Remove it with
# `openmrs-docker <instance> destroy` (it asks for confirmation). In GitHub Actions the runner is
# thrown away anyway.

set -uo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/ocl-load-test.sh [options]

  --zl-emr-dir DIR          zl-emr checkout to build (default: clone PIH/zl-emr master into a temp dir)
  --distro-tools-dir DIR    openmrs-contrib-distro-tools checkout (default: clone its main branch)
  --instance NAME           openmrs-docker instance name (default: ocl-load-test-<version>)
  --seed-image IMAGE        seed image (default: partnersinhealth/zl-emr-seed-haiti:latest)
  --pih-config LIST         PIH config (default: haiti,haiti-central,haiti-local-idgen)
  --summary-md FILE         also write a Markdown summary to FILE (for PRs and step summaries)
  --openmrs-log FILE        save the OpenMRS log to FILE
  --keep-running            leave the instance running at the end instead of stopping it
  -h, --help                show this help

Ports default to free ones; set OPENMRS_HTTP_PORT, OPENMRS_DB_PORT or OPENMRS_DEBUG_PORT to choose.
EOF
}

REPO_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
OCL_DIR="$REPO_DIR/content/configuration/backend_configuration/ocl"
ZL_EMR_DIR=""
TOOLS_DIR=""
INSTANCE=""
SEED_IMAGE="partnersinhealth/zl-emr-seed-haiti:latest"
PIH_CONFIG="haiti,haiti-central,haiti-local-idgen"
SUMMARY_MD=""
OPENMRS_LOG=""
KEEP_RUNNING=false

while [ $# -gt 0 ]; do
  case "$1" in
    --zl-emr-dir) ZL_EMR_DIR="$2"; shift 2 ;;
    --distro-tools-dir) TOOLS_DIR="$2"; shift 2 ;;
    --instance) INSTANCE="$2"; shift 2 ;;
    --seed-image) SEED_IMAGE="$2"; shift 2 ;;
    --pih-config) PIH_CONFIG="$2"; shift 2 ;;
    --summary-md) SUMMARY_MD="$2"; shift 2 ;;
    --openmrs-log) OPENMRS_LOG="$2"; shift 2 ;;
    --keep-running) KEEP_RUNNING=true; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
done

WORK_DIR=$(mktemp -d "${TMPDIR:-/tmp}/ocl-load-test.XXXXXX")
RESULT="could not run"
DETAILS=""
INSTANCE_CREATED=false
TEST_IMAGE=""

log() { echo "[ocl-load-test] $*"; }

# Writes the Markdown summary (if asked for) and stops the instance. Runs on every exit.
finish() {
  local status=$?
  if [ -n "$SUMMARY_MD" ]; then
    {
      case "$status" in
        0) echo "### OCL export load test: ✅ passed" ;;
        1) echo "### OCL export load test: ❌ failed" ;;
        *) echo "### OCL export load test: ⚠️ couldn't run" ;;
      esac
      echo
      echo "Loaded ${EXPORT_VERSION:-the export} into a ZL EMR instance restored from \`$SEED_IMAGE\` (PIH config \`$PIH_CONFIG\`): $RESULT."
      if [ -n "$DETAILS" ]; then
        echo
        printf '%s\n' "$DETAILS"
      fi
    } > "$SUMMARY_MD"
  fi
  if [ "$INSTANCE_CREATED" = true ] && [ "$KEEP_RUNNING" != true ]; then
    log "Stopping $INSTANCE and removing its test image $TEST_IMAGE (its volumes are kept; remove it with: openmrs-docker $INSTANCE destroy, or start it again with: openmrs-docker $INSTANCE start --build)"
    "$OD" "$INSTANCE" stop >/dev/null 2>&1 || true
    docker image rm "$TEST_IMAGE" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
  exit "$status"
}
trap finish EXIT

cant_run() { RESULT="couldn't run: $*"; echo "::error::$*" >&2; exit 2; }
failed() { RESULT="$1"; echo "::error::$1" >&2; exit 1; }

for tool in docker java mvn git unzip jq python3; do
  command -v "$tool" >/dev/null || cant_run "'$tool' isn't installed"
done

# --- The export ---------------------------------------------------------------------------------

shopt -s nullglob
zips=("$OCL_DIR"/*.zip)
shopt -u nullglob
[ "${#zips[@]}" -eq 1 ] || cant_run "expected exactly one export zip in $OCL_DIR, found ${#zips[@]}"
EXPORT_ZIP="${zips[0]}"
EXPORT_FILE=$(basename "$EXPORT_ZIP")
unzip -p "$EXPORT_ZIP" export.json > "$WORK_DIR/export.json" || cant_run "couldn't read export.json from $EXPORT_FILE"
EXPORT_VERSION=$(jq -r '.id' "$WORK_DIR/export.json")
EXPORT_CONCEPTS=$(jq '.concepts | length' "$WORK_DIR/export.json")
EXPORT_MAPPINGS=$(jq '.mappings | length' "$WORK_DIR/export.json")
rm "$WORK_DIR/export.json"
log "Export: $EXPORT_FILE (version $EXPORT_VERSION, $EXPORT_CONCEPTS concepts, $EXPORT_MAPPINGS mappings)"

[ -n "$INSTANCE" ] || INSTANCE="ocl-load-test-${EXPORT_VERSION//./-}"

# --- Checkouts ----------------------------------------------------------------------------------

if [ -z "$TOOLS_DIR" ]; then
  TOOLS_DIR="$WORK_DIR/distro-tools"
  git clone -q --depth 1 https://github.com/PIH/openmrs-contrib-distro-tools.git "$TOOLS_DIR" \
    || cant_run "couldn't clone PIH/openmrs-contrib-distro-tools"
fi
TOOLS_DIR=$(cd "$TOOLS_DIR" && pwd)
OD="$TOOLS_DIR/bin/openmrs-docker"
[ -x "$OD" ] || cant_run "$OD not found"

if [ -z "$ZL_EMR_DIR" ]; then
  ZL_EMR_DIR="$WORK_DIR/zl-emr"
  git clone -q --depth 1 https://github.com/PIH/zl-emr.git "$ZL_EMR_DIR" || cant_run "couldn't clone PIH/zl-emr"
fi
ZL_EMR_DIR=$(cd "$ZL_EMR_DIR" && pwd)

# zl-emr must build on the pihemr version we're about to install, or it would use another one.
first_tag() { grep -m1 -o "<$1>[^<]*</$1>" "$2" | sed -E "s#</?$1>##g"; }
PIHEMR_VERSION=$(first_tag version "$REPO_DIR/pom.xml")
ZL_PARENT_VERSION=$(first_tag parentContentVersion "$ZL_EMR_DIR/distro/pom.xml")
[ -n "$PIHEMR_VERSION" ] || cant_run "couldn't read pihemr's version"
if [ "$PIHEMR_VERSION" != "$ZL_PARENT_VERSION" ]; then
  cant_run "zl-emr builds on pihemr-content $ZL_PARENT_VERSION, but this pihemr is $PIHEMR_VERSION"
fi

# --- Build --------------------------------------------------------------------------------------

log "Building pihemr $PIHEMR_VERSION and installing it in the local Maven repository"
mvn -B -q clean install -DskipTests -f "$REPO_DIR/pom.xml" || cant_run "the pihemr build failed"

# --- Instance -----------------------------------------------------------------------------------

free_port() { python3 -I -c 'import socket; s=socket.socket(); s.bind(("",0)); print(s.getsockname()[1])'; }
export OPENMRS_HTTP_PORT="${OPENMRS_HTTP_PORT:-$(free_port)}"
export OPENMRS_DB_PORT="${OPENMRS_DB_PORT:-$(free_port)}"
export OPENMRS_DEBUG_PORT="${OPENMRS_DEBUG_PORT:-$(free_port)}"
# Build under a local-only name, so a developer's partnersinhealth/zl-emr:latest isn't replaced
# by this test build. The image is removed at the end.
export OPENMRS_IMAGE_NAME=ocl-load-test/zl-emr
export OPENMRS_IMAGE_TAG="$INSTANCE"
TEST_IMAGE="$OPENMRS_IMAGE_NAME:$OPENMRS_IMAGE_TAG"
export OPENMRS_PIH_CONFIG="$PIH_CONFIG"
export OPENMRS_DISTRO_DIR="$ZL_EMR_DIR"
# Keeps MySQL within the 7 GB GitHub runner, as the smoke tests do
export OPENMRS_DB_OPT_innodb_buffer_pool_size=1G

if [ -d "${PIHX_HOME:-$HOME/pihx}/$INSTANCE" ]; then
  cant_run "instance $INSTANCE already exists; remove it (openmrs-docker $INSTANCE destroy) or pass --instance"
fi
log "Creating instance $INSTANCE from $SEED_IMAGE (OpenMRS on port $OPENMRS_HTTP_PORT)"
"$OD" "$INSTANCE" create || cant_run "couldn't create instance $INSTANCE"
INSTANCE_CREATED=true
# initialize looks in the OpenMRS image to see which user owns its data, before we've built ours.
# Give it the published image under the test name; it runs as the same user, and the build replaces it.
docker pull -q partnersinhealth/zl-emr:latest >/dev/null || cant_run "couldn't pull partnersinhealth/zl-emr:latest"
docker tag partnersinhealth/zl-emr:latest "$TEST_IMAGE" || cant_run "couldn't tag $TEST_IMAGE"
"$OD" "$INSTANCE" initialize --from-image "$SEED_IMAGE" --pull || cant_run "couldn't restore $SEED_IMAGE"

log "Building the ZL EMR distribution and starting it (the OCL import runs during startup)"
"$OD" "$INSTANCE" start --build || cant_run "couldn't build or start the instance"

# The build uses 'mvn -U', which could pick up pihemr's published snapshot instead of ours.
built=$(find "$ZL_EMR_DIR/distro/target/distro/web" -path '*ocl*' -name '*.zip' -printf '%f\n' 2>/dev/null | sort -u)
if [ "$built" != "$EXPORT_FILE" ]; then
  cant_run "the built distribution has OCL export '${built:-none}', not $EXPORT_FILE (did Maven use another pihemr snapshot?)"
fi

log "Waiting for OpenMRS to start"
wait_ok=true
"$OD" "$INSTANCE" wait || wait_ok=false

# --- Checks -------------------------------------------------------------------------------------

sql() {
  "$OD" "$INSTANCE" compose exec -T -e MYSQL_PWD="${OPENMRS_DB_ROOT_PASSWORD:-openmrs}" openmrs-db \
    mysql -uroot -N -B openmrs -e "$1"
}

# Lines about Initializer or the OCL import that are errors, with the few lines after each.
log_excerpt() {
  "$OD" "$INSTANCE" compose logs --no-color --no-log-prefix openmrs 2>/dev/null \
    | grep -i -E -A3 '(ERROR|Exception).*(initializer|openconceptlab|Duplicate entry)|(initializer|openconceptlab).*(ERROR|Exception)' \
    | tail -40
}
add_log_excerpt() {
  DETAILS+=$'\n\n'"OpenMRS log (Initializer and OCL errors):"$'\n```\n'"$(log_excerpt)"$'\n```'
}

if [ -n "$OPENMRS_LOG" ]; then
  "$OD" "$INSTANCE" compose logs --no-color --no-log-prefix openmrs > "$OPENMRS_LOG" 2>&1 || true
  log "Saved the OpenMRS log to $OPENMRS_LOG"
fi

# Initializer only writes the checksum after the domain loaded without an exception.
checksum=$("$OD" "$INSTANCE" compose exec -T openmrs \
  sh -c "ls /openmrs/data/configuration_checksums/ocl/ 2>/dev/null" | tr -d '\r' | grep -F "${EXPORT_FILE%.zip}" || true)

last_import=$(sql "SELECT import_id, local_date_started, IFNULL(local_date_stopped,''),
                          UNIX_TIMESTAMP(local_date_started), IFNULL(error_message,'')
                   FROM openconceptlab_import ORDER BY import_id DESC LIMIT 1" 2>/dev/null)
IFS=$'\t' read -r import_id started stopped started_epoch import_error <<< "$last_import"

# The seed has imports of its own; only count the last one if it ran in this instance.
container=$("$OD" "$INSTANCE" compose ps -q openmrs 2>/dev/null | head -1)
container_started=$(docker inspect -f '{{.State.StartedAt}}' "$container" 2>/dev/null)
container_epoch=$(date -d "$container_started" +%s 2>/dev/null || echo 0)
if [ -n "${import_id:-}" ] && [ "${started_epoch%.*}" -lt "$container_epoch" ]; then
  import_id=""
fi

DETAILS="- Export: \`$EXPORT_FILE\` ($EXPORT_CONCEPTS concepts, $EXPORT_MAPPINGS mappings)"

if [ -z "${import_id:-}" ]; then
  # No import ran. If OpenMRS also failed, it failed before reaching the import.
  if [ "$wait_ok" != true ] || [ -z "$checksum" ]; then
    add_log_excerpt
    failed "OpenMRS didn't start, and the OCL import never ran"
  fi
  cant_run "no OCL import ran in this instance; the seed may already have $EXPORT_FILE loaded"
fi

states=$(sql "SELECT state, COUNT(*) FROM openconceptlab_item WHERE import_id = $import_id GROUP BY state" 2>/dev/null)
# ItemState is stored by its position: 0 ADDED, 1 UPDATED, 2 RETIRED, 3 UNRETIRED, 4 ERROR,
# 5 IGNORED_ERROR, 6 UP_TO_DATE, 7 DUPLICATE
names=(added updated retired unretired errors ignored-errors up-to-date duplicates)
state_summary=""
item_errors=0
while IFS=$'\t' read -r state count; do
  [ -n "$state" ] || continue
  state_summary+="${state_summary:+, }$count ${names[$state]:-state $state}"
  [ "$state" = 4 ] && item_errors=$count
done <<< "$states"
DETAILS+=$'\n'"- OCL import $import_id: started $started, finished ${stopped:-never}; items: ${state_summary:-none}"

if [ -n "$import_error" ] || [ "$item_errors" != 0 ]; then
  # The importer's messages repeat each retry; the cause after the last "[CAUSE]: " is the useful part.
  errors=$(sql "SELECT CONCAT('- ', type, ' \`', url, '\`: ',
                              REPLACE(LEFT(SUBSTRING_INDEX(IFNULL(error_message,''), '[CAUSE]: ', -1), 300), '\\n', ' '))
                FROM openconceptlab_item WHERE import_id = $import_id AND state = 4 LIMIT 25" 2>/dev/null)
  DETAILS+=$'\n\n'"The import reported: ${import_error:-errors}. Items that failed (first 25 of $item_errors):"$'\n'"$errors"
  printf '%s\n' "$errors"
  failed "the OCL import failed for $item_errors item(s)"
fi
if [ -z "$stopped" ]; then
  add_log_excerpt
  failed "the OCL import didn't finish"
fi
if [ "$wait_ok" != true ] || [ -z "$checksum" ]; then
  add_log_excerpt
  failed "the OCL import finished, but Initializer or OpenMRS startup failed afterwards"
fi

RESULT="loaded cleanly"
log "Passed: $EXPORT_FILE loaded cleanly (${state_summary:-no items})"
exit 0
