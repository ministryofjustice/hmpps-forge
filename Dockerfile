# syntax=docker/dockerfile:1.7
#
# The Rust examples app (the Forge Developer Guide). The build context is this directory:
#   docker build -t hmpps-forge-examples-app-rust .
# or use `make build` / `make up`.
#
# The runtime image holds the binary at /app/app and the files it reads under /app, located through
# FORGE_APP_ROOT (views/, content/, assets/, node_modules/) and FORGE_MOJ_COMPONENTS (templates/,
# styles/).

ARG RUST_VERSION=1.99
ARG NODE_VERSION=24

# Stage: the frontend packages the app renders and serves (GOV.UK Frontend and MOJ Frontend
# templates, styles and browser builds, highlight.js styles), from examples-app's package-lock.json.
FROM node:${NODE_VERSION}-slim AS frontend
WORKDIR /deps
COPY examples-app/package.json examples-app/package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund

# Stage: static release build of the app (musl), so the runtime image can be `scratch`. musl-tools
# provides the C toolchain ring (rustls's crypto provider, for rediss://) builds with.
FROM rust:${RUST_VERSION}-slim-bookworm AS build
RUN apt-get update && \
    apt-get install -y --no-install-recommends musl-tools ca-certificates && \
    rm -rf /var/lib/apt/lists/* && \
    rustup target add "$(uname -m)-unknown-linux-musl" && \
    mkdir -p /rootfs/tmp && chmod 1777 /rootfs/tmp
WORKDIR /build
COPY . ./
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/usr/local/cargo/git \
    --mount=type=cache,target=/build/target \
    target="$(uname -m)-unknown-linux-musl" && \
    cargo build --release --locked -p forge-examples-app --target "$target" && \
    cp "target/$target/release/forge-examples-app" /usr/local/bin/forge-examples-app

# Stage: production image, from scratch: the static binary, a CA bundle (TLS to Redis) and the
# files the app reads. No shell, so the healthcheck is the binary's own `healthcheck` subcommand
# (GET /ping on $PORT).
FROM scratch AS production

ARG BUILD_NUMBER
ARG GIT_REF
ARG GIT_BRANCH

ENV BUILD_NUMBER=${BUILD_NUMBER} \
    GIT_REF=${GIT_REF} \
    GIT_BRANCH=${GIT_BRANCH} \
    NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    FORGE_APP_ROOT=/app \
    FORGE_MOJ_COMPONENTS=/app/forge-moj-components

COPY --from=build /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/ca-certificates.crt
COPY --from=build /rootfs/tmp /tmp

WORKDIR /app
COPY --from=build --chown=2000:2000 /usr/local/bin/forge-examples-app app
COPY --chown=2000:2000 examples-app/views views
COPY --chown=2000:2000 examples-app/content content
COPY --chown=2000:2000 examples-app/assets assets
COPY --from=frontend --chown=2000:2000 /deps/node_modules node_modules
COPY --chown=2000:2000 forge-moj-components/templates forge-moj-components/templates
COPY --chown=2000:2000 forge-moj-components/styles forge-moj-components/styles

EXPOSE 3000
USER 2000:2000

HEALTHCHECK --interval=5s --timeout=5s --start-period=10s --retries=20 CMD ["/app/app", "healthcheck"]

ENTRYPOINT ["/app/app"]
