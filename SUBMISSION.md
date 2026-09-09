# extensions.gnome.org Submission Notes

Extension name: `Charge Power Monitor`

Author: `Oleh Boiko`

Contact: `developer@mackrais.com`

UUID: `charge-power-monitor@mackrais.gmail.com`

Repository URL:

`https://github.com/mackrais-organization/gnom-charge-power-monitor`

Upload this file to `extensions.gnome.org`:

`dist/charge-power-monitor@mackrais.gmail.com.shell-extension.zip`

Description (matches `metadata.json`):

`Shows laptop battery charge or discharge power in watts and supported peripheral battery levels in the GNOME top panel menu. On laptops whose kernel driver exposes a charge threshold, the menu can also set the battery charge limit; applying a new limit is authenticated through pkexec.`

Declared GNOME Shell support: `42`, `43`, `44`.

## Reviewer notes

- `version-name` is `6` (matches the expected website version); `version` is
  left for the website to assign.
- `donations` declares a single supported key (`kofi`).
- No GSettings schema and no gettext domain are used, so those keys are omitted.
- `session-modes` is omitted (only `user` mode is needed).
- Privileged action: applying a battery charge threshold writes a root-owned
  sysfs node. The write is run as `pkexec /bin/sh -c 'echo <value> > <sysfs path>'`
  - a system binary, not a bundled or user-writable script - and only in
  response to the user picking a value in the menu. The sysfs path comes from
  the kernel's own `power_supply` enumeration and the value is an integer from a
  fixed list. If the driver does not expose a threshold node, the control is not
  shown.
- Only `extension.js`, `metadata.json`, `icon.svg`, and `icon-symbolic.svg` are
  shipped in the ZIP (`build.sh`).
