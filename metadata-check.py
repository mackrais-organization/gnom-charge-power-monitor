#!/usr/bin/env python3
"""Validate metadata.json against extensions.gnome.org expectations.

Checks the same mechanical rules the EGO review process applies, so obvious
problems fail locally and in CI instead of at submission time.
"""

import json
import re
import sys
from pathlib import Path

UUID = "charge-power-monitor@mackrais.gmail.com"
METADATA_PATH = Path(__file__).parent / UUID / "metadata.json"

REQUIRED_KEYS = ("uuid", "name", "description", "shell-version", "url")
ALLOWED_KEYS = {
    "uuid",
    "name",
    "description",
    "shell-version",
    "url",
    "gettext-domain",
    "settings-schema",
    "session-modes",
    "version",
    "version-name",
    "donations",
}
ALLOWED_SESSION_MODES = {"user", "unlock-dialog"}
ALLOWED_DONATION_KEYS = {
    "buymeacoffee",
    "custom",
    "github",
    "kofi",
    "liberapay",
    "opencollective",
    "patreon",
    "paypal",
}
UUID_RE = re.compile(r"^[A-Za-z0-9._-]+@[A-Za-z0-9._-]+$")
SHELL_VERSION_RE = re.compile(r"^\d+(\.\d+)?$")
VERSION_NAME_RE = re.compile(r"^(?!^[. ]+$)[a-zA-Z0-9 .]{1,16}$")

errors: list[str] = []


def error(message: str) -> None:
    errors.append(message)


def main() -> int:
    try:
        raw = METADATA_PATH.read_text(encoding="utf-8")
    except OSError as exc:
        print(f"metadata-check: cannot read {METADATA_PATH}: {exc}", file=sys.stderr)
        return 1

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"metadata-check: metadata.json is not valid JSON: {exc}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print("metadata-check: metadata.json must be a JSON object", file=sys.stderr)
        return 1

    for key in REQUIRED_KEYS:
        if key not in data:
            error(f"missing required key: {key}")

    for key in data:
        if key not in ALLOWED_KEYS:
            error(f"unexpected key (EGO rejects unnecessary keys): {key}")

    uuid = data.get("uuid")
    if isinstance(uuid, str):
        if not UUID_RE.match(uuid):
            error("uuid must be extension-id@namespace using [A-Za-z0-9._-]")
        if uuid.split("@")[-1] == "gnome.org":
            error("uuid namespace must not be gnome.org")
        if uuid != UUID:
            error(f"uuid changed from {UUID!r} to {uuid!r}")

    name = data.get("name")
    if isinstance(name, str) and not name.strip():
        error("name must not be empty")

    description = data.get("description")
    if isinstance(description, str) and not description.strip():
        error("description must not be empty")

    shell_version = data.get("shell-version")
    if not isinstance(shell_version, list) or not shell_version:
        error("shell-version must be a non-empty array")
    else:
        for entry in shell_version:
            if not isinstance(entry, str) or not SHELL_VERSION_RE.match(entry):
                error(f"shell-version entry is not a stable version string: {entry!r}")

    url = data.get("url")
    if isinstance(url, str) and not url.startswith(("http://", "https://")):
        error("url must be an http(s) URL")

    if "version" in data:
        error("drop 'version' - extensions.gnome.org assigns it")

    version_name = data.get("version-name")
    if version_name is not None:
        if not isinstance(version_name, str) or not VERSION_NAME_RE.match(version_name):
            error("version-name must be 1-16 chars of letters, digits, spaces, dots")

    session_modes = data.get("session-modes")
    if session_modes is not None:
        if not isinstance(session_modes, list) or not session_modes:
            error("session-modes must be a non-empty array or be dropped")
        else:
            extra = set(session_modes) - ALLOWED_SESSION_MODES
            if extra:
                error(f"invalid session-modes: {sorted(extra)}")
            if session_modes == ["user"]:
                error("drop session-modes when only 'user' mode is needed")

    donations = data.get("donations")
    if donations is not None:
        if not isinstance(donations, dict) or not donations:
            error("donations must be a non-empty object or be dropped")
        else:
            extra = set(donations) - ALLOWED_DONATION_KEYS
            if extra:
                error(f"invalid donations keys: {sorted(extra)}")

    if errors:
        print("metadata-check: FAILED")
        for message in errors:
            print(f"  - {message}")
        return 1

    print("metadata-check: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
