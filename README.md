# Charge Power Monitor

Author: `Oleh Boiko`  
Contact: `developer@mackrais.com`

GNOME Shell extension for Ubuntu 22.04.5 LTS / GNOME Shell 42.9.

It provides:

- a top panel indicator with current laptop battery charge or discharge power in watts
- a dropdown menu with laptop battery state and percentage
- a dropdown section with supported peripheral battery levels when exposed by the system

## Screenshot Example

![Charge Power Monitor screenshot](screenshot/image.png)

## Data Sources

### Laptop battery power

The panel watt indicator reads Linux `power_supply` telemetry from:

- `/sys/class/power_supply/*/power_now`
- `/sys/class/power_supply/*/voltage_now`
- `/sys/class/power_supply/*/current_now`
- `/sys/class/power_supply/*/status`
- `/sys/class/power_supply/*/capacity`

It prefers `power_now` when available and falls back to:

`watts = voltage_now * current_now / 1e12`

### Peripheral battery levels

The dropdown menu tries to detect external device batteries from:

- `UPower` via `upower -d`
- `BlueZ` on the system D-Bus via `org.bluez`

Typical supported devices:

- Bluetooth mice
- Bluetooth keyboards
- some headsets and headphones
- phones or tablets that expose a battery level through the system

## Limitations

- A device is shown only if Linux actually exposes its battery percentage through `UPower` or `BlueZ`.
- Many 2.4G USB receiver devices do not report battery level through standard Linux interfaces.
- Some Bluetooth audio devices appear in `bluetoothctl` but still do not expose `org.bluez.Battery1`, so they will not appear in the extension menu.

## Install

Use the provided installer:

```bash
./install.sh
```

Manual install:

```bash
mkdir -p ~/.local/share/gnome-shell/extensions/charge-power-monitor@mackrais.gmail.com
cp -r charge-power-monitor@mackrais.gmail.com/* ~/.local/share/gnome-shell/extensions/charge-power-monitor@mackrais.gmail.com/
gnome-extensions enable charge-power-monitor@mackrais.gmail.com
```

## Reload GNOME Shell

On Xorg in Ubuntu 22.04:

- press `Alt`+`F2`
- type `r`
- press `Enter`

On Wayland, log out and log back in.

## Build Package

To generate the zip for `extensions.gnome.org`:

```bash
./build.sh
```

The output archive is:

`dist/charge-power-monitor@mackrais.gmail.com.shell-extension.zip`

## Current machine

- OS: Ubuntu 22.04.5 LTS (Jammy Jellyfish)
- GNOME Shell: 42.9
- Desktop session: `ubuntu:GNOME`
