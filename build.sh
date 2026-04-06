#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="charge-power-monitor@mackrais.gmail.com"
DIST_DIR="$ROOT_DIR/dist"
ZIP_PATH="$DIST_DIR/$UUID.shell-extension.zip"

"$ROOT_DIR/review-check.sh"

mkdir -p "$DIST_DIR"
rm -f "$ZIP_PATH"
(
  cd "$ROOT_DIR/$UUID"
  zip -qr "$ZIP_PATH" .
)

printf 'Built: %s\n' "$ZIP_PATH"
