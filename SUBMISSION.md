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

- `version-name` is `7` (matches the expected website version); `version` is
  left for the website to assign.
- `donations` declares a single supported key (`kofi`).
- No GSettings schema and no gettext domain are used, so those keys are omitted.
- `session-modes` is omitted (only `user` mode is needed).
- Only `extension.js`, `metadata.json`, `icon.svg`, and `icon-symbolic.svg` are
  shipped in the ZIP (`build.sh`).

### Privileged action (`pkexec`)

Applying a battery charge limit writes one root-owned kernel attribute. The
command is a fixed array constant with no shell:

```
pkexec /usr/bin/tee -- <end-threshold attribute>
```

The integer value is passed on stdin. See `CHARGE_LIMIT_COMMAND`,
`writeEndThresholdCommand()` and `_applyChargeLimit()` in `extension.js`.

- `pkexec` runs `/usr/bin/tee` (coreutils) - not a script, not anything a user
  process can modify.
- The one argument is always the kernel's own `charge_control_end_threshold`
  (or legacy `charge_stop_threshold`) attribute under
  `/sys/class/power_supply/<battery>/`, taken from the `power_supply`
  enumeration (`CHARGE_END_THRESHOLD_FILES`). Nothing user-supplied is
  interpolated into the command.
- The value is an integer chosen from the list the kernel publishes in
  `charge_control_end_available_thresholds` (or a fixed fallback list).
- One `pkexec` call, so one authentication dialog. The start threshold is never
  written - the driver keeps it below the end value on its own.
- Runs only when the user picks a value in the menu. If the battery exposes no
  end-threshold attribute, the whole control is replaced by a "not supported"
  line.
