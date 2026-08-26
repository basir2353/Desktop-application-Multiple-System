# Standalone Railway image — build from backend-desktop/ (Root Directory = backend-desktop).
#
# Live hosted API:
#   https://backend-desktop-production-600b.up.railway.app
#   Health: /health
#
# Railway settings:
#   Root Directory: backend-desktop
#   Dockerfile path: Dockerfile
#
# Do not use RUN --mount=type=cache,... here. Railway Metal builders reject
# every cache-mount id format ("missing the cacheKey prefix from its id").

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY .npmrc package.json pnpm-workspace.yaml turbo.json pnpm-lock.yaml ./
COPY packages ./packages
COPY api ./api
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@platform/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=build /app/.npmrc /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/turbo.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/api ./api
RUN find /app/node_modules/.bin -type f -o -type l | xargs chmod +x 2>/dev/null || true \
    && mkdir -p /app/api/data/uploads
EXPOSE 3000
ENV HOST=0.0.0.0
ENV RAILWAY_SKIP_SCHEMA_PUSH=1
ENV RAILWAY_SKIP_SEED_BOOT=1
ENV RAILWAY_RUN_ENSURE_SCHEMA=0
ENV DATABASE_POOL_MAX=5
ENV NODE_OPTIONS=--max-old-space-size=420
CMD ["node", "/app/api/scripts/start-railway.mjs"]
