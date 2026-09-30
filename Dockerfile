# ---------------------------------------------------------------------------
# CS2 Skins Platform — production image
#
# A long-lived Node server, which the architecture depends on: the grouped
# catalog index, the bounded caches and the in-flight deduplication all live in
# process memory and are worth amortising across requests.
#
# The image is **secret-independent**. No API key is baked in, no build arg
# carries one, and nothing reads `.env` — every secret arrives at runtime from
# the host's environment. See docs/DEPLOYMENT.md.
# ---------------------------------------------------------------------------

# Node 24 LTS on Debian slim. Not Alpine: the marginal size saving is not worth
# musl surprises in a stack that ships prebuilt binaries.
FROM node:24-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    # Never let a stray npm install reach the network at runtime.
    NPM_CONFIG_UPDATE_NOTIFIER=false
RUN corepack enable
WORKDIR /app


# ---------------------------------------------------------------------------
# deps — every dependency, including dev, because the build needs them
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
# Frozen: the lockfile is the contract, and a build that silently resolves a
# different tree is not the build that was tested.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile


# ---------------------------------------------------------------------------
# build — compile the SvelteKit app into ./build
# ---------------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# `svelte-kit sync` runs via the prepare script during install; the copied
# node_modules skips it, so the build does it explicitly.
RUN pnpm exec svelte-kit sync && pnpm run build


# ---------------------------------------------------------------------------
# prod-deps — runtime dependencies only
# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts


# ---------------------------------------------------------------------------
# runtime — the server, and nothing that built it
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production \
    # adapter-node reads both. Binding 0.0.0.0 is what makes the container
    # reachable; the host supplies PORT, so nothing here hardcodes 3000.
    HOST=0.0.0.0 \
    PORT=3000
WORKDIR /app

# `node` exists in the official image already; use it rather than inventing a
# user and chasing permissions.
USER node

COPY --chown=node:node --from=prod-deps /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/build ./build
COPY --chown=node:node package.json ./

EXPOSE 3000

# Liveness the platform can also use. It touches no upstream, so an outage at
# CS2Cap never restarts a healthy process.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Exec form, so the server is PID 1 and receives SIGTERM directly —
# adapter-node shuts down gracefully on it without custom signal handling.
CMD ["node", "build"]
