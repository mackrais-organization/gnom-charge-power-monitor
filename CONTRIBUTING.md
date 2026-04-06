# Contributing

## Development Flow

1. Create a branch for your change.
2. Make the smallest viable change.
3. Run local checks before opening a pull request.
4. Open a pull request with a clear summary and testing notes.

## Local Checks

Run the local pre-review checks:

```bash
./review-check.sh
```

Run JavaScript linting:

```bash
npm install
npm run lint
```

Build the extension bundle:

```bash
./build.sh
```

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
