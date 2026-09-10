# Release Checklist

## Before Tagging

1. Run local checks:
   ```bash
   ./review-check.sh
   python3 metadata-check.py
   npm install
   npm run lint
   node --check charge-power-monitor@mackrais.gmail.com/extension.js
   ./build.sh
   ```
2. `./build.sh` already runs `./shexli-check.sh --strict` (the
   extensions.gnome.org Shexli analyzer, when a Python >= 3.12 one is
   installed). Optionally also run `gnome-extensions pack`, matching the CI
   `Validate Package` job (needs `gnome-shell`):
   ```bash
   gnome-extensions pack charge-power-monitor@mackrais.gmail.com \
     --extra-source=icon.svg --extra-source=icon-symbolic.svg \
     --extra-source=icon.png --extra-source=icon-symbolic.png \
     --force --out-dir /tmp/pack
   ```
3. Reinstall and verify the extension manually:
   ```bash
   ./reinstall.sh
   ```
   Confirm:
   - panel indicator works
   - dropdown renders correctly, including the battery charge limit submenu
   - extension enables without GNOME Shell errors
4. Update documentation if behaviour, compatibility, scripts, or packaging changed.
5. Update `CHANGELOG.md`.
6. Bump `version-name` in `metadata.json`. The release tag **must** be
   `v<version-name>` (the `Release` workflow fails otherwise). Leave `version`
   unset - extensions.gnome.org assigns it.

## Create Release

The change lands on `master` through a pull request (see `CONTRIBUTING.md`).
Once it is merged:

1. Tag and push:
   ```bash
   git tag -a vN -m "vN"
   git push origin vN
   ```
   (`N` is the `version-name`.) The `Release` workflow verifies the tag against
   `metadata.json`, runs the checks, builds the bundle, and publishes a GitHub
   release with the zip attached.

   Alternatively, create the tag on GitHub and run the `Release` workflow
   manually from the **Actions** tab (`workflow_dispatch`, input: the tag name).

2. Upload the released zip to extensions.gnome.org (extension `9541`). The
   website assigns its own incrementing `version`; keep `version-name` in step 6
   aligned with it.
