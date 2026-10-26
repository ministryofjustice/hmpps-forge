# Stage: development base image. Stays on Debian rather than Alpine because onnxruntime-node
# (used by semantic search) only ships glibc binaries
FROM node:24-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends wget && rm -rf /var/lib/apt/lists/* && \
    groupadd --gid 2000 appgroup && \
    useradd --uid 2000 --gid appgroup --create-home appuser

# Stage: download embedding model assets into a local model directory
FROM python:3.12-slim AS model-assets

ARG EMBEDDING_MODEL_NAME=Xenova/bge-small-en-v1.5
ARG EMBEDDING_MODEL_REVISION=main

RUN pip install --no-cache-dir "huggingface_hub[cli]"
RUN mkdir -p /opt/models && \
    hf download "${EMBEDDING_MODEL_NAME}" \
      --revision "${EMBEDDING_MODEL_REVISION}" \
      --local-dir "/opt/models/${EMBEDDING_MODEL_NAME}"

# Stage: install ALL dependencies (dev + prod) for building
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine AS deps
WORKDIR /app/examples-app
COPY examples-app/package.json examples-app/package-lock.json examples-app/.allowed-scripts.mjs examples-app/.npmrc ./
COPY packages/package.json ../packages/package.json
COPY packages/dist ../packages/dist
RUN --mount=type=cache,target=/npm_cache \
    npm ci --install-links --cache /npm_cache --prefer-offline --ignore-scripts

# Stage: install ONLY production dependencies. The production image is glibc-based, so pick
# glibc builds of native optional deps (e.g. sharp) rather than this stage's musl ones
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine AS prod-deps
WORKDIR /app/examples-app
COPY examples-app/package.json examples-app/package-lock.json examples-app/.allowed-scripts.mjs examples-app/.npmrc ./
COPY packages/package.json ../packages/package.json
COPY packages/dist ../packages/dist
RUN --mount=type=cache,target=/npm_cache \
    npm ci --install-links --cache /npm_cache --prefer-offline --omit=dev --ignore-scripts --libc=glibc

# Stage: development target (used by docker-compose.local.yml)
FROM base AS development
ENV NODE_ENV=development
COPY --from=model-assets --chown=appuser:appgroup \
        /opt/models \
        /opt/models

# Stage: build assets using full deps
FROM deps AS build
COPY examples-app/ ./
RUN npm run build

# Stage: production image
FROM ghcr.io/ministryofjustice/hmpps-distroless-node:24 AS production

ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

ENV BUILD_NUMBER=${BUILD_NUMBER} \
    GIT_REF=${GIT_REF} \
    GIT_BRANCH=${GIT_BRANCH} \
    NODE_ENV=production

WORKDIR /app

COPY --from=build --chown=2000:2000 \
        /app/examples-app/package.json \
        ./package.json

COPY --from=build --chown=2000:2000 \
        /app/examples-app/dist \
        ./dist

COPY --from=prod-deps --chown=2000:2000 \
        /app/examples-app/node_modules \
        ./node_modules

COPY --from=model-assets --chown=2000:2000 \
        /opt/models \
        /opt/models

EXPOSE 3000
USER 2000

CMD [ "dist/server.js" ]
