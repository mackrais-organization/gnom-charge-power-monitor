# Charge Power Monitor

Author: `Oleh Boiko`  
Contact: `developer@mackrais.com`

GNOME Shell extension for Ubuntu 22.04.5 LTS / GNOME Shell 42.9 that shows current battery charge or discharge power in watts in the top panel.

It reads:

- `/sys/class/power_supply/*/power_now`
- `/sys/class/power_supply/*/voltage_now`
- `/sys/class/power_supply/*/current_now`
- `/sys/class/power_supply/*/status`
- `/sys/class/power_supply/*/capacity`

It prefers `power_now` when available and falls back to:

`watts = voltage_now * current_now / 1e12`

## Install

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/charge-power-monitor@mackrais.gmail.com
cp -r charge-power-monitor@mackrais.gmail.com/* ~/.local/share/gnome-shell/extensions/charge-power-monitor@mackrais.gmail.com/
gnome-extensions enable charge-power-monitor@mackrais.gmail.com
```

On Xorg in Ubuntu 22.04, press `Alt`+`F2`, type `r`, press `Enter` to restart GNOME Shell.

## Upload Package

For `extensions.gnome.org`, upload the generated zip from:

`dist/charge-power-monitor@mackrais.gmail.com.shell-extension.zip`

## Current machine

- OS: Ubuntu 22.04.5 LTS (Jammy Jellyfish)
- GNOME Shell: 42.9
- Desktop session: `ubuntu:GNOME`
