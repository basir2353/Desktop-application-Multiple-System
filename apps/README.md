# Apps

User-facing applications in the monorepo.

| App | Package | Description |
| --- | --- | --- |
| [launcher](./launcher/) | `@platform/launcher` | Tauri desktop shell and POPS UI |
| [waiter-mobile](./waiter-mobile/) | `@platform/waiter-mobile` | Expo app for waiters |
| [modules/sample](./modules/sample/) | `@platform/module-sample` | Reference federated remote |

## Development

From the repository root:

```bash
pnpm dev:launcher          # Desktop shell
pnpm dev:waiter-mobile     # Mobile app
pnpm dev:module:sample     # Sample remote on port 5001
pnpm dev:stack             # API + sample + launcher together
```
