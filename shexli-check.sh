#!/usr/bin/env bash
#
# Run the extensions.gnome.org "Shexli" static analyzer on an EGO-layout
# throwaway package.
#
# The local Compose image pins shexli 0.2.1 with tree-sitter 0.25.0. Without
# that constraint pip selects tree-sitter 0.26.0, which segfaults.

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

[[ -d "$SRC_DIR" ]] || skip "missing $SRC_DIR"
command -v zip >/dev/null 2>&1 || skip "zip not installed"
command -v docker >/dev/null 2>&1 || skip "docker not installed"
docker compose version >/dev/null 2>&1 || skip "docker compose not available"

# --- pack a throwaway zip in the EGO layout (files at the root) -------------
tmp_dir="$(mktemp -d "$ROOT_DIR/.shexli.XXXXXX")"
tmp_zip="$tmp_dir/$UUID.shell-extension.zip"
trap 'rm -rf "$tmp_dir"' EXIT
( cd "$SRC_DIR" && zip -qr "$tmp_zip" . ) || skip "could not pack $SRC_DIR"

# --- run ------------------------------------------------------------------
out="$(
    cd "$ROOT_DIR"
    docker compose -f docker-compose.shexli.yml run --build --rm shexli \
        "/workspace/${tmp_zip#"$ROOT_DIR"/}" 2>&1
)"
status=$?

if (( status > 1 )); then
    printf '%s\n' "$out" >&2
    printf 'shexli: Docker analyzer failed with status %s\n' "$status" >&2
    exit "$status"
fi

printf '%s\n' "$out"

if (( STRICT == 1 )) && grep -qiE '\b[0-9]+ errors?\b' <<<"$out" \
    && ! grep -qiE '\b0 errors?\b' <<<"$out"; then
    printf 'shexli: error-level findings present\n' >&2
    exit 1
fi

exit 0
