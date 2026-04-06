#!/usr/bin/env bash
set -euo pipefail

UUID="charge-power-monitor@mackrais.gmail.com"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC_DIR="$ROOT_DIR/$UUID"
DST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

"$ROOT_DIR/review-check.sh" --warn-only || true
printf '\n'

mkdir -p "$DST_DIR"
cp -r "$SRC_DIR"/* "$DST_DIR"/
gnome-extensions enable "$UUID"

printf 'Installed to %s\n' "$DST_DIR"
printf 'If the indicator does not appear immediately, restart GNOME Shell.\n'
printf 'On Ubuntu 22.04 Xorg: Alt+F2, type r, press Enter.\n'
