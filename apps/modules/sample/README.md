# Sample module

Reference [Module Federation](https://module-federation.io/) remote for integrating third-party UI into the launcher shell.

## Development

```bash
pnpm dev:module:sample
```

Serves on port **5001** by default (`SAMPLE_MODULE_PORT` in root `.env`). The launcher loads `VITE_SAMPLE_REMOTE_URL` (default `http://127.0.0.1:5001/assets/remoteEntry.js`).

## Build

```bash
pnpm --filter @platform/module-sample build
```

Use this package as a template when authoring new federated modules under `apps/modules/`.
