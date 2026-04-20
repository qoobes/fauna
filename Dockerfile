# FAUNA production image — Playwright base (comes with Chromium + all Linux deps)
# Match the Playwright image tag to the `playwright` npm version exactly.
FROM mcr.microsoft.com/playwright:v1.59.1-noble AS base
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Browsers live here in the official image; pin so Playwright finds them regardless of $HOME
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ---- deps stage: install production dependencies ----
FROM base AS deps
COPY package.json package-lock.json* bun.lock* ./
RUN npm install -g bun && bun install --frozen-lockfile

# ---- builder stage: compile Next.js ----
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Production build. Next.js 16 uses Turbopack by default for build.
RUN npm install -g bun && bun run build

# ---- runner stage: minimal runtime image ----
FROM base AS runner
# Use UID/GID 10001 to avoid conflicts with users already present in the Playwright base image
RUN groupadd --system --gid 10001 app && useradd --system --uid 10001 --gid app --create-home app

# Standalone output from Next.js (tree-shaken server + minimal node_modules)
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Drizzle migrations (for reference, not auto-run — we migrate locally against Turso)
COPY --from=builder --chown=app:app /app/drizzle ./drizzle

# Non-root user needs read+execute on the Playwright browser binaries
RUN chmod -R o+rx /ms-playwright

# Persistent volume will mount here; pre-create and own the directory.
# On Railway we set RAILWAY_RUN_UID=0 so the container runs as root for volume access —
# this USER directive is therefore overridden at runtime, but kept for local/other deploys.
RUN mkdir -p /app/results && chown -R app:app /app/results

USER app
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
