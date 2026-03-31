SHELL = '/bin/bash'

PROJECT_NAME = hmpps-forge-examples-app

SERVICE_NAME = app

APP_VERSION ?= local
NODE_MODULES_LAYOUT_VERSION = standalone-layout-v1

DEV_COMPOSE_FILES = -f docker/docker-compose.base.yml -f docker/docker-compose.local.yml
CI_COMPOSE_FILES = -f docker/docker-compose.base.yml -f docker/docker-compose.test.yml
PROD_COMPOSE_FILES = -f docker/docker-compose.base.yml

export APP_VERSION
export COMPOSE_PROJECT_NAME=${PROJECT_NAME}

default: help

help: ## The help text you're reading.
	@grep --no-filename -E '^[0-9a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'

prod-build: ## Builds a production image of the app.
	@docker compose ${PROD_COMPOSE_FILES} build app

prod-up: ## Starts/restarts the app in a production container.
	@docker compose ${PROD_COMPOSE_FILES} down app
	@docker compose ${PROD_COMPOSE_FILES} up app --wait --no-recreate

dev-build: ## Builds a development image of the app and installs Node dependencies.
	@make install-node-modules
	@docker compose ${DEV_COMPOSE_FILES} build app

dev-up: ## Starts/restarts a development container. A remote debugger can be attached on port 9229.
	@make install-node-modules
	@docker compose down ${SERVICE_NAME}
	@docker compose ${DEV_COMPOSE_FILES} up ${SERVICE_NAME} --wait --no-recreate

down: ## Stops and removes all containers in the project.
	@docker compose down

test: ## Runs the unit test suite.
	@docker compose exec ${SERVICE_NAME} npm run test

e2e: ## Run Playwright tests locally (dev environment must be running).
	@npx playwright test --reporter=list

e2e-ui: ## Run Playwright tests with UI mode (dev environment must be running).
	@npx playwright test --ui

e2e-ci: ## Run Playwright tests in Docker container (for CI).
	@make install-node-modules
	@docker compose $(CI_COMPOSE_FILES) up $(SERVICE_NAME) --wait $(if $(filter local,$(APP_VERSION)),--build) && \
	@docker compose $(CI_COMPOSE_FILES) run --rm playwright

lint: ## Runs the linter.
	@docker compose exec ${SERVICE_NAME} npm run lint

lint-fix: ## Automatically fixes linting issues.
	@docker compose exec ${SERVICE_NAME} npm run lint-fix

install-node-modules: ## Installs Node modules into the Docker volume.
	@docker volume create ${PROJECT_NAME}_examples_app_node_modules > /dev/null 2>&1 || true
	@docker run --rm \
	  -v ./package.json:/tmp/src/examples-app/package.json:ro \
	  -v ./package-lock.json:/tmp/src/examples-app/package-lock.json:ro \
	  -v ./.allowed-scripts.mjs:/tmp/src/examples-app/.allowed-scripts.mjs:ro \
	  -v ./.npmrc:/tmp/src/examples-app/.npmrc:ro \
	  -v ../packages/package.json:/tmp/src/packages/package.json:ro \
	  -v ../packages/dist:/tmp/src/packages/dist:ro \
	  -v ~/.npm:/npm_cache \
	  -v ${PROJECT_NAME}_examples_app_node_modules:/app/examples-app/node_modules \
	  node:24-alpine \
	  /bin/sh -c '\
	    PACKAGES_DIST_HASH=$$(find /tmp/src/packages/dist -type f -exec sha256sum {} \; | sort | sha256sum | cut -d" " -f1); \
	    CURRENT_HASH=$$({ printf "%s\n" "${NODE_MODULES_LAYOUT_VERSION}" "$$PACKAGES_DIST_HASH"; cat /tmp/src/examples-app/package.json /tmp/src/examples-app/package-lock.json /tmp/src/examples-app/.npmrc /tmp/src/packages/package.json; } | sha256sum | cut -d" " -f1); \
	    STORED_HASH=$$(cat /app/examples-app/node_modules/.package-hash 2>/dev/null || echo ""); \
	    if [ "$$CURRENT_HASH" != "$$STORED_HASH" ]; then \
	      echo "Package files changed, running npm ci..."; \
	      mkdir -p /app/examples-app /app/packages/dist && \
	      cp /tmp/src/examples-app/package.json /tmp/src/examples-app/package-lock.json /tmp/src/examples-app/.allowed-scripts.mjs /tmp/src/examples-app/.npmrc /app/examples-app/ && \
	      cp /tmp/src/packages/package.json /app/packages/ && \
	      cp -R /tmp/src/packages/dist/. /app/packages/dist/ && \
	      cd /app/examples-app && npm ci --install-links --cache /npm_cache && \
	      echo "$$CURRENT_HASH" > /app/examples-app/node_modules/.package-hash; \
	    else \
	      echo "node_modules is up-to-date."; \
	    fi'

clean: ## Stops and removes all project containers. Deletes local build/cache directories.
	@docker compose down
	@docker images -q --filter=reference="ghcr.io/ministryofjustice/*:local" | xargs -r docker rmi
	@docker volume ls -qf "dangling=true" | xargs -r docker volume rm
	@rm -rf dist node_modules test_results

update: ## Downloads the latest versions of container images.
	@docker compose ${DEV_COMPOSE_FILES} pull --ignore-buildable
