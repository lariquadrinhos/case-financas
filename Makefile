# Bigorna — Controle Financeiro PF + PJ
#
# Monolito web: Next.js 15 (App Router) + TypeScript + Tailwind v4.
# Fase atual: domínio e regras puras, SQLite atrás de portas segregadas
# (ADR-0012), API em /api/v1 e as telas fiéis ao Figma. Fase 2: autenticação.
#
# Toolchain exigido: Node >= 20.9 (ver .nvmrc). Não usar Node 18 — o Tailwind v4
# e o npm 11 não suportam.

# Prioriza um Node moderno instalado via Homebrew, se existir, sem exigir shell de login.
export PATH := /opt/homebrew/opt/node@24/bin:$(PATH)

.DEFAULT_GOAL := help
.PHONY: help install dev build start check typecheck lint fmt fmt-check test test-unit \
        test-e2e test-e2e-install storybook audit audit-tokens audit-lgpd audit-deps require-node \
        seed clean

help: ## Mostra este menu
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "} {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

require-node: ## Falha cedo se o Node for velho demais, com a instrução de conserto
	@node -e 'const [maj,min]=process.versions.node.split(".").map(Number); \
	  if (maj<20 || (maj===20 && min<19) || (maj===21) || (maj===22 && min<12)) { \
	    console.error("\n  Node "+process.versions.node+" é velho demais. Este projeto exige ^20.19 ou >= 22.12 (piso do vite 7).\n"); \
	    console.error("  Conserto:  nvm install 24 && nvm use 24     (ou)  brew install node@24\n"); \
	    process.exit(1); }'

node_modules: package.json ## Instala dependências quando o manifesto muda
	@$(MAKE) require-node
	npm install
	@touch node_modules

install: node_modules ## Instala dependências

dev: node_modules ## Sobe o servidor de desenvolvimento em localhost:3000
	npm run dev

build: node_modules ## Compila para produção
	npm run build

start: ## Sobe o build de produção
	npm run start

# `fmt-check` entra aqui porque o CI já roda `npm run fmt:check` (.github/workflows/ci.yml):
# um portão local mais frouxo que o remoto só descobre a divergência depois do push.
check: typecheck lint fmt-check test-unit audit ## Portão local: tipos + lint + formato + testes + auditorias

typecheck: node_modules ## Verifica os tipos sem emitir
	npm run typecheck

lint: node_modules ## ESLint em todo o projeto
	npm run lint

fmt: node_modules ## Formata com Prettier
	npm run fmt

fmt-check: node_modules ## Verifica formatação sem alterar arquivo
	npm run fmt:check

test: test-unit ## Testes que rodam em qualquer máquina (unitários)

test-unit: node_modules ## Vitest — domínio, regras puras e componentes
	npm run test

test-e2e-install: node_modules ## Baixa o browser do Playwright
	npx playwright install --with-deps chromium

test-e2e: node_modules ## Playwright — fora do `test` por depender de browser
	@if npx playwright --version >/dev/null 2>&1; then \
		npm run test:e2e; \
	else \
		echo "  Playwright ausente — pulando e2e. Rode 'make test-e2e-install'."; \
	fi

storybook: node_modules ## Storybook do design system em localhost:6006
	npm run storybook

audit-tokens: ## Falha se algum componente tiver cor ou medida literal (ADR-0011)
	@./tools/audit.sh tokens

audit-lgpd: ## Falha se houver PII em fixture ou console.log em src/ (ADR-0009)
	@./tools/audit.sh lgpd

audit: audit-tokens audit-lgpd ## Roda as duas auditorias de repositório

audit-deps: node_modules ## Vulnerabilidades conhecidas nas dependências
	npm audit --audit-level=high

seed: node_modules ## Popula ./.data/bigorna.db com o cenário sintético de desenvolvimento
	npm run db:seed

db-reset: ## Apaga ./.data/bigorna.db para recomeçar do zero (ex.: retestar o onboarding)
	rm -f .data/bigorna.db .data/bigorna.db-shm .data/bigorna.db-wal

clean: ## Remove artefatos de build e teste
	rm -rf .next out coverage playwright-report test-results storybook-static
