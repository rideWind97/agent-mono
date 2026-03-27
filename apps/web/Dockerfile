# ---- Base ----
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

# ---- Dependencies ----
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY tooling/typescript-config/package.json ./tooling/typescript-config/package.json
COPY tooling/eslint-config/package.json ./tooling/eslint-config/package.json
RUN pnpm install --frozen-lockfile --prod=false

# ---- Build ----
FROM deps AS build
COPY packages/shared/ ./packages/shared/
COPY packages/ui/ ./packages/ui/
COPY apps/web/ ./apps/web/
COPY tooling/ ./tooling/
COPY tsconfig.base.json ./
RUN pnpm --filter @agent-mono/shared build
RUN pnpm --filter @agent-mono/ui build
RUN pnpm --filter @agent-mono/web build

# ---- Production (nginx) ----
FROM nginx:alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
