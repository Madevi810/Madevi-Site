FROM node:24-bookworm-slim AS deps
WORKDIR /app
COPY package*.json ./
# Optional trusted CA for development environments with an HTTPS proxy.
# BuildKit mounts it only for installation; it is not copied into the image.
RUN --mount=type=secret,id=proxy_ca \
    if [ -f /run/secrets/proxy_ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca; fi; \
    npm ci --no-audit --no-fund

FROM node:24-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Non-secret, build-only placeholders; runtime configuration is always external.
RUN DATABASE_URL=postgresql://build@127.0.0.1:5432/build BETTER_AUTH_SECRET=build-only-placeholder-at-least-32-characters BETTER_AUTH_URL=https://localhost MADEVI_ENV=staging MADEVI_DEMO_MODE=false npm run build

FROM deps AS production-deps
RUN npm prune --omit=dev --ignore-scripts --offline --no-audit --no-fund

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
# Apply the Debian PAM security update and leave package managers in build stages.
RUN --mount=type=secret,id=proxy_ca,mode=0444 \
    set -eu; \
    if [ -f /run/secrets/proxy_ca ]; then set -- -o Acquire::https::CaInfo=/run/secrets/proxy_ca; else set --; fi; \
    sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources; \
    apt-get "$@" update; \
    apt-get "$@" install -y --no-install-recommends --only-upgrade libpam-modules libpam-modules-bin libpam-runtime libpam0g; \
    rm -rf /var/lib/apt/lists/* /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /opt/yarn-v*; \
    rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/package*.json ./
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/next.config.ts ./next.config.ts
COPY --from=build --chown=node:node /app/scripts/migrations ./scripts/migrations
COPY --from=build --chown=node:node /app/scripts/migrate.mjs /app/scripts/check-ready.mjs /app/scripts/create-owner.mjs /app/scripts/dispatch-messages.mjs ./scripts/
COPY --from=build --chown=node:node /app/src/lib ./src/lib
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start"]
