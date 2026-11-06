SHELL = /bin/bash

# Orchestrates the Rust examples app's image and services (Dockerfile, docker-compose.yml), and the
# local npm install the app and its tests read (examples-app/node_modules).

COMPOSE = docker compose -f docker-compose.yml
SERVICE_NAME = ui

APP_VERSION ?= local
APP_PORT ?= 3000
BUILD_NUMBER ?= $(shell date +%Y-%m-%d.%H%M)
GIT_REF ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo unknown)
GIT_BRANCH ?= $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)

export APP_VERSION APP_PORT BUILD_NUMBER GIT_REF GIT_BRANCH

.DEFAULT_GOAL := help
.PHONY: help install build up start down restart logs ps health clean

help: ## The help text you're reading.
	@grep --no-filename -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Installs the frontend packages into examples-app/node_modules (for cargo run / cargo test).
	@cd examples-app && npm ci --ignore-scripts --no-audit --no-fund

build: ## Builds the app image (release build of the Rust app).
	@$(COMPOSE) build $(SERVICE_NAME)

up: build ## Builds the image, then starts Redis and the app and waits until both are healthy.
	@$(COMPOSE) up --detach --wait
	@echo "Forge Developer Guide: http://localhost:$(APP_PORT)/forge-developer-guide"

start: ## Starts the services from the existing image, without rebuilding.
	@$(COMPOSE) up --detach --wait --no-build

down: ## Stops and removes the containers.
	@$(COMPOSE) down

restart: ## Restarts the app container.
	@$(COMPOSE) restart $(SERVICE_NAME)

logs: ## Follows the app's logs (devtools auth codes are printed here).
	@$(COMPOSE) logs --follow $(SERVICE_NAME)

ps: ## Lists the services and their health.
	@$(COMPOSE) ps

health: ## Checks the running app's health endpoint.
	@curl --fail --silent --show-error http://localhost:$(APP_PORT)/health && echo

clean: ## Stops the services and removes the containers, volumes and the app image.
	@$(COMPOSE) down --volumes --rmi local
	@docker image rm ghcr.io/ministryofjustice/hmpps-forge-examples-app-rust:$(APP_VERSION) 2>/dev/null || true
