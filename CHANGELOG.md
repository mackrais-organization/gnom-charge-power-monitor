# Changelog

All notable changes to this project should be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

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

[Unreleased]: https://github.com/mackrais-organization/gnom-charge-power-monitor/compare/v6...HEAD
[6]: https://github.com/mackrais-organization/gnom-charge-power-monitor/releases/tag/v6
