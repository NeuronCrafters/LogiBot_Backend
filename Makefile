# Caminhos dos docker-compose
DEV_COMPOSE=docker-compose.dev.yml
PROD_COMPOSE=docker-compose.yml

# Variáveis de Banco (Ajuste conforme seu .env se necessário, mas aqui é para o comando exec)
MONGO_USER=chatsael
MONGO_PASS=chatsael_password
DB_NAME=logibot_db

# ======================
# ⚡ Comandos Principais
# ======================

# [COMBO] Reseta tudo, cria user admin e restaura backup
# 1. Derruba containers e volumes (-v) para forçar execução do mongo-init.js
# 2. Sobe o ambiente em background
# 3. Espera 10s para o Mongo aceitar conexões
# 4. Executa o restore interno
# 5. Mostra os logs
fresh-start:
	@echo "🧨 Destruindo containers e volumes antigos..."
	docker compose -f $(DEV_COMPOSE) down -v
	@echo "🚀 Subindo ambiente de desenvolvimento..."
	docker compose -f $(DEV_COMPOSE) up -d --build
	@$(MAKE) wait-db
	@$(MAKE) restore-internal
	@echo "✅ Ambiente 100% pronto! Logs abaixo:"
	docker compose -f $(DEV_COMPOSE) logs -f

# Apenas sobe o ambiente (sem resetar dados se o volume já existir)
dev:
	docker compose -f $(DEV_COMPOSE) up --build

dev-background:
	docker compose -f $(DEV_COMPOSE) up -d --build

dev-down:
	docker compose -f $(DEV_COMPOSE) down

dev-restart:
	docker compose -f $(DEV_COMPOSE) down && docker compose -f $(DEV_COMPOSE) up --build

# ======================
# 🚀 Comandos de Prod
# ======================

prod:
	docker compose -f $(PROD_COMPOSE) up --build

prod-down:
	docker compose -f $(PROD_COMPOSE) down

prod-restart:
	docker compose -f $(PROD_COMPOSE) down && docker compose -f $(PROD_COMPOSE) up --build

# ======================
# 🗄️ Banco de Dados
# ======================

# Popula o banco com dados via código (Mock)
seed:
	@echo "🌱 Populando o banco com dados falsos (Mock)..."
	npx ts-node src/mock/mock.ts

# Restaura o backup.
# PRÉ-REQUISITO: O docker-compose deve mapear ./db_backup:/data/backup_files
restore-internal:
	@echo "🔄 Restaurando banco de dados a partir de /data/backup_files..."
	docker exec logibot_mongodb_dev mongorestore \
		--username $(MONGO_USER) \
		--password $(MONGO_PASS) \
		--authenticationDatabase admin \
		--db $(DB_NAME) \
		--drop \
		/data/backup_files

# Helper para esperar o banco subir
wait-db:
	@echo "⏳ Aguardando 10 segundos para inicialização do Mongo..."
	@node -e "setTimeout(() => process.exit(0), 10000)"

# ======================
# 🔧 Utilitários
# ======================

logs:
	docker compose -f $(DEV_COMPOSE) logs -f

ps:
	docker compose -f $(DEV_COMPOSE) ps

clean:
	docker system prune -f --volumes

prune-images:
	docker image prune -a -f

# ======================
# 🧪 Testes
# ======================

test:
	echo "FUTURAMENTE TEREMOS TESTES AQUI."

# ======================
# 📦 Build
# ======================

build-dev:
	docker compose -f $(DEV_COMPOSE) build

build-prod:
	docker compose -f $(PROD_COMPOSE) build