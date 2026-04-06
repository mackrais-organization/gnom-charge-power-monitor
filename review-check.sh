#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="charge-power-monitor@mackrais.gmail.com"
EXTENSION_JS="$ROOT_DIR/$UUID/extension.js"
WARN_ONLY=0

if [[ "${1:-}" == "--warn-only" ]]; then
  WARN_ONLY=1
fi

if [[ ! -f "$EXTENSION_JS" ]]; then
  printf 'review-check: error: missing %s\n' "$EXTENSION_JS" >&2
  exit 1
fi

errors=0
warnings=0

print_issue() {
  local severity="$1"
  local code="$2"
  local message="$3"
  local location="$4"

  printf '%s %s %s (%s)\n' "$severity" "$code" "$message" "$location"
}

add_error() {
  errors=$((errors + 1))
  print_issue "error" "$1" "$2" "$3"
}

add_warning() {
  warnings=$((warnings + 1))
  print_issue "warning" "$1" "$2" "$3"
}

match_lines() {
  local pattern="$1"
  rg -n "$pattern" "$EXTENSION_JS" || true
}

bytearray_matches="$(match_lines 'imports\.byteArray')"
if [[ -n "$bytearray_matches" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    add_error "EGO017" "deprecated modules must not be imported" "$line"
  done <<< "$bytearray_matches"
fi

sync_io_matches="$(match_lines 'GLib\.file_get_contents|load_contents\(')"
if [[ -n "$sync_io_matches" ]]; then
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    add_warning "EGO030" "extensions should avoid synchronous file IO in shell code" "$line"
  done <<< "$sync_io_matches"
fi

if rg -q '_deviceItems\.push\(' "$EXTENSION_JS"; then
  if ! rg -q '_clearDeviceItems\(\)' "$EXTENSION_JS"; then
    add_warning "EGO014" "objects created by extension should be destroyed in disable()" "$EXTENSION_JS"
  elif ! awk '
    /disable\(\) \{/ { in_disable=1; depth=1; print; next }
    in_disable {
      print
      depth += gsub(/\{/, "{")
      depth -= gsub(/\}/, "}")
      if (depth == 0)
        exit
    }
  ' "$EXTENSION_JS" | rg -q '_clearDeviceItems\(\)'; then
    add_warning "EGO014" "objects created by extension should be destroyed in disable()" "$EXTENSION_JS:disable()"
  fi
fi

printf '\nreview-check summary: %d error(s), %d warning(s)\n' "$errors" "$warnings"

if (( errors > 0 && WARN_ONLY == 0 )); then
  printf 'review-check failed: fix error-level issues before build\n' >&2
  exit 1
fi

exit 0
