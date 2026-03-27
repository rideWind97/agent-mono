# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY apps/api/package.json ./apps/api/package.json
COPY tooling/typescript-config/package.json ./tooling/typescript-config/package.json
COPY tooling/eslint-config/package.json ./tooling/eslint-config/package.json
RUN pnpm install --frozen-lockfile --prod=false

# ---- Build ----
FROM deps AS build
COPY packages/shared/ ./packages/shared/
COPY apps/api/ ./apps/api/
COPY tooling/ ./tooling/
COPY tsconfig.base.json ./
RUN pnpm --filter @agent-mono/shared build
RUN pnpm --filter @agent-mono/api build

# ---- Production ----
FROM base AS production
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/index.js"]
