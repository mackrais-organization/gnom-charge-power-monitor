# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

### Added

- `shexli-check.sh`: runs the extensions.gnome.org Shexli static analyzer on the
  packaged extension. Best-effort - skips cleanly when no compatible Shexli is
  installed (it needs Python >= 3.12) or when it crashes. Wired into `build.sh`
  (`--strict`), `install.sh`, `reinstall.sh`, and the CI `Validate Package` job.

## [7] - 2026-09-10

extensions.gnome.org rejected version 6 over the privileged command. This
release addresses that.

### Changed

- The battery charge limit is now applied with one fixed, shell-free command:
  `pkexec /usr/bin/tee -- <end-threshold attribute>` with the integer on stdin.
  No `/bin/sh -c`, no string interpolation, one authentication dialog.
- Only the end threshold is written; the driver keeps the start (resume)
  threshold below it. The menu still reads and shows the resume level. Removes
  `charge_control_start_threshold` writes and the start-value picker.
- `execCommunicate()` accepts optional stdin.

### Added (already on `master`, first released here)

- `metadata-check.py`: validates `metadata.json` against extensions.gnome.org
  rules (key set, `uuid`, `shell-version`, `version-name`, `session-modes`,
  `donations`); run by `review-check.sh` and CI.
- CI `Validate Package` job that packs the extension with the real
  `gnome-extensions pack` tool.
- Manual `workflow_dispatch` trigger for the `Release` workflow, and a check
  that the release tag matches `metadata.json` `version-name`.
- `eslint.config.js` GJS ruleset (rejects `var`, loose equality, deprecated
  `imports.byteArray` / `imports.lang` / `imports.mainloop`).
- Dev/CI dependency bumps: `eslint` 9 -> 10, `actions/checkout` 4 -> 7,
  `softprops/action-gh-release` 2 -> 3.

## [6] - 2026-09-09

First git-tagged release. The number matches the extensions.gnome.org version
for this upload.

### Added

- "Battery charge limit" menu control:
  - shown only when the battery driver exposes a charge threshold
    (`charge_control_end_threshold`, or the legacy `charge_stop_threshold`);
    otherwise the menu states that the laptop does not support it;
  - offers the exact values the controller accepts when it publishes
    `charge_control_end_available_thresholds`, and a `100 / 90 / 80 / 70 / 60 / 50`
    spread otherwise;
  - marks the active value and shows the current stop/resume levels;
  - explains that a lower cap only takes effect after the battery drains below
    the resume level, since the controller does not discharge a battery that is
    already fuller than the cap;
  - sets a matching start threshold a step below the end value (snapped to a
    supported value) when `charge_control_start_threshold` is available;
  - applies changes through `pkexec` (system authentication dialog); the sysfs
    node is root-owned.
- `metadata.json`: `version-name` and a `donations` (Ko-fi) key.

### Notes

- extensions.gnome.org versions 1-3 were rejected; versions 4-5 shipped the
  panel watt indicator (`power_supply` telemetry) and the peripheral battery
  section (`UPower` and `BlueZ`). This changelog starts at version 6.

### Compatibility

- GNOME Shell `42`, `43`, and `44`. The codebase uses the legacy `imports.*`
  extension style and is not prepared for GNOME Shell `45+` without migration.

[Unreleased]: https://github.com/mackrais-organization/gnom-charge-power-monitor/compare/v7...HEAD
[7]: https://github.com/mackrais-organization/gnom-charge-power-monitor/releases/tag/v7
[6]: https://github.com/mackrais-organization/gnom-charge-power-monitor/releases/tag/v6
