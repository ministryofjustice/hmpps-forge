# Stage: base image
FROM ghcr.io/ministryofjustice/hmpps-node:24-alpine AS base

# Stage: development target (used by docker-compose.local.yml)
FROM base AS development
ENV NODE_ENV=development

# TODO(unpublished-forge): Remove the node -e, --ignore-scripts, and COPY forge-package lines
# from both stages once @ministryofjustice/hmpps-forge is published to npm.
# Then restore `npm run setup` in deps and plain `npm ci --omit=dev` in prod-deps.
# Also remove `rm -rf forge-package` from the build stage.

# Stage: install ALL dependencies (dev + prod) for building
FROM base AS deps
COPY package*.json .allowed-scripts.mjs ./
RUN node -e "var p=JSON.parse(require('fs').readFileSync('package.json')); delete p.dependencies['@ministryofjustice/hmpps-forge']; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));"
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts
COPY forge-package ./node_modules/@ministryofjustice/hmpps-forge

# Stage: install ONLY production dependencies
FROM base AS prod-deps
COPY package*.json .allowed-scripts.mjs ./
RUN node -e "var p=JSON.parse(require('fs').readFileSync('package.json')); delete p.dependencies['@ministryofjustice/hmpps-forge']; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));"
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts
COPY forge-package ./node_modules/@ministryofjustice/hmpps-forge

# Stage: build assets using full deps
FROM deps AS build
COPY . .
RUN rm -rf forge-package && npm run build

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

COPY --from=build --chown=appuser:appgroup \
        /app/package.json \
        /app/package-lock.json \
        ./

COPY --from=build --chown=appuser:appgroup \
        /app/dist ./dist

COPY --from=prod-deps --chown=appuser:appgroup \
        /app/node_modules ./node_modules

EXPOSE 3000
USER 2000

CMD [ "npm", "start" ]
