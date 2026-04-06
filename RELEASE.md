# Release Checklist

## Before Tagging

1. Run local checks:
   ```bash
   ./review-check.sh
   npm install
   npm run lint
   ./build.sh
   ```
2. Reinstall and verify the extension manually:
   ```bash
   ./reinstall.sh
   ```
3. Confirm:
   - panel indicator works
   - dropdown renders correctly
   - extension enables without GNOME Shell errors
   - `dist/charge-power-monitor@mackrais.gmail.com.shell-extension.zip` is up to date
4. Update documentation if behavior, compatibility, scripts, or packaging changed.
5. Update `CHANGELOG.md`.

## Create Release

1. Commit the release changes.
2. Create and push a tag:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
3. Wait for the GitHub `Release` workflow to publish the release artifact.
4. Upload the generated zip to `extensions.gnome.org` if needed.
