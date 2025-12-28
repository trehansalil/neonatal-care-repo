.PHONY: ipconfig dev-up dev-down clean dev-logs dev-restart

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