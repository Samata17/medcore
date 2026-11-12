# MedCore HMS API — production image.
# Build from the repository root (the API depends on packages/types):
#   docker build -f apps/api/Dockerfile -t medcore-api .
# All configuration comes from environment variables at run time; no secrets are baked in.

FROM node:22-bookworm-slim AS base
# OpenSSL is required by the Prisma query engine.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- build ----------
FROM base AS build
COPY package.json package-lock.json ./
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts -w @medcore/types -w @medcore/api --include-workspace-root=false
COPY tsconfig.base.json ./
COPY packages/types packages/types
COPY apps/api apps/api
RUN npm run build -w @medcore/types \
 && npx -w @medcore/api prisma generate \
 && npm run build -w @medcore/api

# ---------- production dependencies only ----------
FROM base AS deps
COPY package.json package-lock.json ./
COPY packages/types/package.json packages/types/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --ignore-scripts --omit=dev -w @medcore/types -w @medcore/api --include-workspace-root=false
COPY apps/api/prisma apps/api/prisma
# (mkdir: npm may hoist everything to the root node_modules)
RUN npx -w @medcore/api prisma generate && mkdir -p apps/api/node_modules

# ---------- runtime ----------
FROM base AS runtime
# Listens on API_PORT, else the platform's PORT, else 4100.
ENV NODE_ENV=production \
    UPLOAD_DIR=/app/apps/api/uploads
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=build /app/packages/types/package.json packages/types/package.json
COPY --from=build /app/packages/types/dist packages/types/dist
COPY --from=build /app/apps/api/package.json apps/api/package.json
COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/prisma apps/api/prisma
RUN mkdir -p apps/api/uploads && chown -R node:node apps/api/uploads

# Run as the unprivileged "node" user.
USER node
WORKDIR /app/apps/api
EXPOSE 4100
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.API_PORT||process.env.PORT||4100)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Applies pending database migrations (safe to run on every start; Prisma locks them),
# then starts the API. Set RUN_MIGRATIONS=false if your platform runs them separately.
CMD ["sh", "-c", "if [ \"$RUN_MIGRATIONS\" != \"false\" ]; then node /app/node_modules/prisma/build/index.js migrate deploy; fi && exec node dist/main.js"]
