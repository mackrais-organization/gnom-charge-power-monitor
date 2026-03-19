#!/usr/bin/env bash
set -euo pipefail

UUID="charge-power-monitor@mackrais.gmail.com"
SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$UUID"
DST_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

mkdir -p "$DST_DIR"
cp -r "$SRC_DIR"/* "$DST_DIR"/
gnome-extensions enable "$UUID"

printf 'Installed to %s\n' "$DST_DIR"
printf 'If the indicator does not appear immediately, restart GNOME Shell.\n'
printf 'On Ubuntu 22.04 Xorg: Alt+F2, type r, press Enter.\n'
