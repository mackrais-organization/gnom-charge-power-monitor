#!/usr/bin/env bash
#
# Run the extensions.gnome.org "Shexli" static analyzer on the packaged
# extension, the same check the website runs on upload.
#
# Shexli needs Python >= 3.12 and, as of 0.2.1, still crashes on the standard
# EGO zip layout. So this wrapper is best-effort: a missing, incompatible, or
# crashing Shexli is reported as "skipped", never as a failure. Real findings
# are printed; "--strict" makes error-level findings exit non-zero.
#
# To enable it locally, install Shexli into an isolated environment, e.g.:
#     pipx install shexli                 # needs pipx + Python >= 3.12
#     uv tool install shexli              # needs uv
# or put `shexli` on PATH some other way.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="charge-power-monitor@mackrais.gmail.com"
SRC_DIR="$ROOT_DIR/$UUID"
STRICT=0
[[ "${1:-}" == "--strict" ]] && STRICT=1

skip() {
    printf 'shexli: skipped (%s)\n' "$1"
    exit 0
}

# --- locate a runner --------------------------------------------------------
runner=()
if command -v shexli >/dev/null 2>&1; then
    runner=(shexli)
elif command -v uvx >/dev/null 2>&1; then
    runner=(uvx --quiet --python 3.12 shexli)
elif command -v uv >/dev/null 2>&1; then
    runner=(uv tool run --python 3.12 shexli)
elif command -v pipx >/dev/null 2>&1; then
    runner=(pipx run shexli)
else
    skip "shexli not found (needs Python >= 3.12; see comments in $(basename "$0"))"
fi

[[ -d "$SRC_DIR" ]] || skip "missing $SRC_DIR"
command -v zip >/dev/null 2>&1 || skip "zip not installed"

# --- pack a throwaway zip in the EGO layout (files at the root) -------------
tmp_zip="$(mktemp -d)/$UUID.shell-extension.zip"
trap 'rm -rf "$(dirname "$tmp_zip")"' EXIT
( cd "$SRC_DIR" && zip -qr "$tmp_zip" . ) || skip "could not pack $SRC_DIR"

# --- run ------------------------------------------------------------------
out="$("${runner[@]}" "$tmp_zip" 2>&1)"
status=$?

if (( status == 139 )) || grep -qiE 'segmentation fault|core dumped' <<<"$out"; then
    skip "shexli crashed on this package (known bug in shexli <= 0.2.1)"
fi
if (( status > 1 )); then
    skip "shexli exited with status $status"
fi

printf '%s\n' "$out"

if (( STRICT == 1 )) && grep -qiE '\b[0-9]+ errors?\b' <<<"$out" \
    && ! grep -qiE '\b0 errors?\b' <<<"$out"; then
    printf 'shexli: error-level findings present\n' >&2
    exit 1
fi

exit 0
