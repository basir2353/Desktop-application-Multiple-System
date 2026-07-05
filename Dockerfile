# Railway — build from repository root (monorepo).
# Identical to backend/api/Dockerfile; Railway auto-detects this at repo root.
FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY package.json pnpm-workspace.yaml turbo.json ./
COPY pnpm-lock.yaml* ./
COPY packages ./packages
COPY backend ./backend
RUN pnpm install --frozen-lockfile=false
RUN pnpm turbo run build --filter=@platform/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/backend/api ./backend/api
# Ensure drizzle-kit binary is executable for preDeployCommand
RUN chmod +x /app/node_modules/.bin/drizzle-kit 2>/dev/null || true
WORKDIR /app/backend/api
EXPOSE 3000
ENV HOST=0.0.0.0
# Railway overrides CMD with startCommand from railway.toml.
CMD ["node", "dist/main.js"]
