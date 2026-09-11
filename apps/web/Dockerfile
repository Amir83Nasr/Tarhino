# ── WEB DOCKERFILE ─────────────────────────────────────────

# Build context is the repo root: the Next app imports @workspace/ui from the
# pnpm monorepo.  Run from the repo root:
#   docker build -f apps/web/Dockerfile -t tarhino-web .

# ── BASE ─────────────────────────────────────────────────────
# corepack ships pnpm 10, matching packageManager in package.json.
FROM node:24-alpine AS base
RUN corepack enable

# ── DEPS ─────────────────────────────────────────────────────
# Install workspace dependencies (workspace:* links included) from the lockfile.
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/eslint-config/package.json packages/eslint-config/package.json
COPY packages/typescript-config/package.json packages/typescript-config/package.json
# --ignore-scripts skips the root `prepare: lefthook install` (no git repo in
# the image); sharp/unrs-resolver use prebuilt binaries, nothing to compile.
# Note: eslint-config / typescript-config get no node_modules from pnpm's
# isolated layout — they only need their package.json present in the build stage.
RUN pnpm install --frozen-lockfile --ignore-scripts

# ── BUILD ────────────────────────────────────────────────────
# NEXT_PUBLIC_API_URL is a compile-time constant: pass it here or the client
# bundle falls back to http://localhost:8000/api/v1.
#   --build-arg NEXT_PUBLIC_API_URL=https://api.example.com/api/v1
FROM base AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/eslint-config/node_modules ./packages/eslint-config/node_modules
COPY tsconfig.json turbo.json ./
# typescript-config is needed for the tsconfig `extends` to resolve in the build.
COPY packages/typescript-config ./packages/typescript-config
COPY packages/ui ./packages/ui
COPY apps/web ./apps/web
# The root .env is intentionally not copied: pass NEXT_PUBLIC_API_URL as a
# build arg instead so the value is baked per environment.
RUN pnpm --filter tarhino-frontend build

# ── RUN ──────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
# `next start` needs write access here for the standalone cache in older Next;
# 16 serves fine read-only, but keep the user non-root regardless.
WORKDIR /app
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./public
COPY --from=build --chown=nextjs:nodejs /app/apps/web/package.json ./package.json
COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=build --chown=nextjs:nodejs /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=build --chown=nextjs:nodejs /app/packages/ui/package.json ./packages/ui/package.json
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# Call next directly: `pnpm start` in the runner re-resolves the workspace and
# corepack tries to fetch a pnpm version that has no lockfile here.
CMD ["node_modules/.bin/next", "start"]
