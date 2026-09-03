# Deprecated — use backend-desktop/Dockerfile (canonical Railway image).
#
# Prefer building from backend-desktop Root Directory on Railway.
# This root Dockerfile is kept for monorepo-context builds only.
#
#   docker build -f backend-desktop/Dockerfile -t platform-api backend-desktop
#
# Or from repo root with this file:

FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY backend-desktop/package.json backend-desktop/pnpm-workspace.yaml backend-desktop/turbo.json ./
COPY backend-desktop/pnpm-lock.yaml* ./
COPY backend-desktop/packages ./packages
COPY backend-desktop/api ./api
RUN pnpm install --frozen-lockfile=false
RUN pnpm turbo run build --filter=@platform/api

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
COPY --from=build /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml* ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages ./packages
COPY --from=build /app/api ./api
RUN find /app/node_modules/.bin -type f -o -type l | xargs chmod +x 2>/dev/null || true
RUN mkdir -p /app/api/data/uploads
EXPOSE 8080
ENV HOST=0.0.0.0
ENV PORT=8080
CMD ["node", "/app/api/scripts/start-railway.mjs"]
