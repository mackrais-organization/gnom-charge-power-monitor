# Pinned local Shexli

This image pins the compatible analyzer dependency set, including the exact
Linux/Python 3.12 wheel hashes in `requirements.lock`:

- `shexli==0.2.1`
- `tree-sitter==0.25.0`

Shexli's unconstrained `tree-sitter>=0.25.0` dependency otherwise installs
`tree-sitter 0.26.0`, which segfaults while analyzing this extension. This is
development tooling only; it does not modify the extension archive or replace
the analyzer used by extensions.gnome.org.

Run it from the repository root:

```bash
docker compose -f docker-compose.shexli.yml run --rm shexli \
  dist/charge-power-monitor@mackrais.gmail.com.shell-extension.zip
```
