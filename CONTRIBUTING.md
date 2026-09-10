# Contributing

## Development Flow

This project uses GitHub Flow:

1. Branch off `master`.
2. Make the smallest viable change.
3. Run local checks (below) and commit.
4. Push the branch and open a pull request with a clear summary and testing
   notes.
5. Merge to `master` only with CI green. `master` is the release branch;
   releases are cut from it by tagging (see `RELEASE.md`).

## Local Checks

These mirror the CI `Review` job:

```bash
./review-check.sh                 # EGO-style heuristics + metadata-check.py
python3 metadata-check.py          # metadata.json vs extensions.gnome.org rules
npm install
npm run lint                       # ESLint with the GJS ruleset
node --check charge-power-monitor@mackrais.gmail.com/extension.js
```

Build the extension bundle (CI `Build Bundle` job):

```bash
./build.sh
```

Package validation (CI `Validate Package` job). `gnome-extensions pack` needs
the CLI from `gnome-shell`; `shexli-check.sh` runs the extensions.gnome.org
Shexli analyzer if a compatible one is installed (Python >= 3.12) and skips
otherwise:

```bash
gnome-extensions pack charge-power-monitor@mackrais.gmail.com \
  --extra-source=icon.svg --extra-source=icon-symbolic.svg \
  --extra-source=icon.png --extra-source=icon-symbolic.png \
  --force --out-dir /tmp/pack
./shexli-check.sh          # add --strict to fail on error-level findings
```

`shexli-check.sh` also runs from `build.sh` (`--strict`) and from `install.sh`
/ `reinstall.sh` (best-effort).

Reinstall the extension locally for manual verification:

```bash
./reinstall.sh
```

## Compatibility Notes

- The extension currently targets GNOME Shell `42`, `43`, and `44`.
- The codebase uses the legacy `imports.*` extension style and is not prepared for GNOME Shell `45+` without migration.

## Pull Request Guidance

- Keep changes focused and easy to review.
- Update `README.md` when behavior, scripts, compatibility, or packaging changes.
- Do not introduce synchronous shell I/O unless there is a strong reason.
- Prefer reviewer-friendly commits and explicit testing notes.
- Bump `version-name` in `metadata.json` only in the PR that is meant to become
  the next release.
