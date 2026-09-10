SHELL := /bin/bash
.DEFAULT_GOAL := help

API_DIR := apps/api
WEB_FILTER := tarhino-frontend
UV := uv
PNPM := pnpm

# ── HELP ──────────────────────────────────────────────────

help: ## Show this help
	@printf '\nTarhino\n'
	@printf '\n\033[32mSetup / Env:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' setup 'Create .env from .env.example'
	@printf '  \033[36m%-13s\033[0m %s\n' install 'Install web + api dependencies'
	@printf '\n\033[32mDev / Run:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' dev 'Run all workspaces in dev mode'
	@printf '  \033[36m%-13s\033[0m %s\n' dev-web 'Run only the Next.js frontend'
	@printf '  \033[36m%-13s\033[0m %s\n' dev-api 'Run only the FastAPI backend'
	@printf '\n\033[32mBuild:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' build 'Build all workspaces'
	@printf '\n\033[32mQuality / Checks:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' lint 'Lint all workspaces'
	@printf '  \033[36m%-13s\033[0m %s\n' format 'Format all workspaces'
	@printf '  \033[36m%-13s\033[0m %s\n' typecheck 'Typecheck all workspaces'
	@printf '\n\033[32mAPI / Backend:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' api-lint 'Ruff check the backend'
	@printf '  \033[36m%-13s\033[0m %s\n' api-format 'Ruff format the backend'
	@printf '  \033[36m%-13s\033[0m %s\n' api-test 'Run backend tests'
	@printf '\n\033[32mDB / Migrations:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' db-upgrade 'Apply all pending migrations'
	@printf '  \033[36m%-13s\033[0m %s\n' db-revision 'Autogenerate migration (m="message")'
	@printf '  \033[36m%-13s\033[0m %s\n' db-downgrade 'Revert the last migration'
	@printf '\n\033[32mClean / Reset:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' clean 'Remove build caches and installed deps'
	@printf '\n\033[32mHelp:\033[0m\n'
	@printf '  \033[36m%-13s\033[0m %s\n' help 'Display documentation for a command'
	@printf '\n'

# ── SETUP / ENV ───────────────────────────────────────────

setup: install ## Create .env from .env.example
	@test -f .env || cp .env.example .env

install: ## Install web + api dependencies
	$(PNPM) install
	cd $(API_DIR) && $(UV) sync

# ── DEV / RUN ─────────────────────────────────────────────

dev: ## Run all workspaces in dev mode
	$(PNPM) dev

dev-web: ## Run only the Next.js frontend
	$(PNPM) --filter $(WEB_FILTER) dev

dev-api: ## Run only the FastAPI backend
	cd $(API_DIR) && $(UV) run uvicorn app.main:app --reload --host 0.0.0.0

# ── BUILD ─────────────────────────────────────────────────

build: ## Build all workspaces
	$(PNPM) build

# ── QUALITY / CHECKS ──────────────────────────────────────

lint: ## Lint all workspaces
	$(PNPM) lint

format: ## Format all workspaces
	$(PNPM) format

typecheck: ## Typecheck all workspaces
	$(PNPM) typecheck

# ── API / BACKEND ─────────────────────────────────────────

api-lint: ## Ruff check the backend
	cd $(API_DIR) && $(UV) run ruff check .

api-format: ## Ruff format the backend
	cd $(API_DIR) && $(UV) run ruff format .

api-test: ## Run backend tests
	cd $(API_DIR) && $(UV) run pytest

# ── DB / MIGRATIONS ───────────────────────────────────────

db-upgrade: ## Apply all pending migrations
	cd $(API_DIR) && $(UV) run alembic upgrade head

db-revision: ## Autogenerate migration, e.g. make db-revision m="add users"
	@test -n "$(m)" || { echo "usage: make db-revision m=\"message\""; exit 1; }
	cd $(API_DIR) && $(UV) run alembic revision --autogenerate -m "$(m)"

db-downgrade: ## Revert the last migration
	cd $(API_DIR) && $(UV) run alembic downgrade -1

# ── CLEAN / RESET ─────────────────────────────────────────

clean: ## Remove build caches and installed deps
	rm -rf node_modules .turbo apps/web/.next apps/web/node_modules packages/*/node_modules
	rm -rf $(API_DIR)/.pytest_cache $(API_DIR)/.ruff_cache
	find $(API_DIR) -type d -name __pycache__ -prune -exec rm -rf {} +

.PHONY: help setup install dev dev-web dev-api build lint format typecheck \
        api-lint api-format api-test db-upgrade db-revision db-downgrade clean