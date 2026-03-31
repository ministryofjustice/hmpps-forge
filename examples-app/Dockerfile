# Stage: base image
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine AS base

# Stage: development target (used by docker-compose.local.yml)
FROM base AS development
ENV NODE_ENV=development

# Stage: install ALL dependencies (dev + prod) for building
FROM base AS deps
WORKDIR /app/examples-app
COPY examples-app/package.json examples-app/package-lock.json examples-app/.allowed-scripts.mjs examples-app/.npmrc ./
COPY packages/package.json ../packages/package.json
COPY packages/dist ../packages/dist
RUN --mount=type=cache,target=/root/.npm \
    npm ci --install-links --ignore-scripts

# Stage: install ONLY production dependencies
FROM base AS prod-deps
WORKDIR /app/examples-app
COPY examples-app/package.json examples-app/package-lock.json examples-app/.allowed-scripts.mjs examples-app/.npmrc ./
COPY packages/package.json ../packages/package.json
COPY packages/dist ../packages/dist
RUN --mount=type=cache,target=/root/.npm \
    npm ci --install-links --omit=dev --ignore-scripts

# Stage: build assets using full deps
FROM deps AS build
COPY examples-app/ ./
RUN npm run build

# Stage: production image
FROM base AS production

ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

RUN test -n "$BUILD_NUMBER" || (echo "BUILD_NUMBER not set" && false)
RUN test -n "$GIT_REF" || (echo "GIT_REF not set" && false)
RUN test -n "$GIT_BRANCH" || (echo "GIT_BRANCH not set" && false)

ENV BUILD_NUMBER=${BUILD_NUMBER} \
    GIT_REF=${GIT_REF} \
    GIT_BRANCH=${GIT_BRANCH} \
    NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=appuser:appgroup \
        /app/examples-app/package.json \
        ./package.json

COPY --from=build --chown=appuser:appgroup \
        /app/examples-app/dist \
        ./dist

COPY --from=prod-deps --chown=appuser:appgroup \
        /app/examples-app/node_modules \
        ./node_modules

EXPOSE 3000
USER 2000

CMD [ "npm", "start" ]
