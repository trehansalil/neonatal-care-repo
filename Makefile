.PHONY: setup ipconfig dev-up dev-down clean dev-logs dev-restart dev-export-data

setup:
	brew install ffmpeg
	pip install uv
	uv sync

ipconfig:
	ifconfig | grep "inet " | grep -v 127.0.0.1

# Start local development environment with Docker Compose	
dev-up:
	docker compose up -d

# Stop local development environment
dev-down:
	docker compose down

# Stop and remove all containers, networks, and volumes	
clean:
	docker compose down -v

# View logs from all services
dev-logs:
	docker compose logs -f

# Restart all services
dev-restart:
	docker compose restart

dev-export-data:
	uv run python3 clickhouse_export_import.py export

dev-import-data:
	LATEST_BACKUP=$$(ls -dt ./backups/clickhouse_export_* | head -1) && \
		uv run python3 \
			clickhouse_export_import.py import --input-dir $$LATEST_BACKUP --truncate-first