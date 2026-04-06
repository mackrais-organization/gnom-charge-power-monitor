#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UUID="charge-power-monitor@mackrais.gmail.com"

"$ROOT_DIR/install.sh"

gnome-extensions disable "$UUID" >/dev/null 2>&1 || true
gnome-extensions enable "$UUID"

printf '\nExtension status:\n'
gnome-extensions info "$UUID"

printf '\nUPower devices:\n'
upower -e || true

printf '\nRecent GNOME Shell log lines:\n'
journalctl --user --since '2 minutes ago' --no-pager | rg "$UUID|JS ERROR|SyntaxError|TypeError|ReferenceError" || true

printf '\nIf the panel did not refresh, restart GNOME Shell.\n'
printf 'On Xorg: Alt+F2, type r, press Enter.\n'
