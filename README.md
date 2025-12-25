# Neonatal Management & Baby Tracker

A comprehensive web application for managing newborn care with hydronephrosis, including a daily tracker for temperature, feeding, and diaper output.

## Features

### 1. **HydroCare Routine Guide** (`index.html`)
- Interactive routine calculator based on baby's weight
- Feeding schedule recommendations
- Visual charts for daily routines
- Hygiene and safety guidelines
- Emergency checklist

### 2. **Baby Tracker** (`tracker.html`)
- Track temperature (🌡️)
- Log feeding (🍼) - amount and type
- Monitor wet diapers/susu (💧)
- Track soiled diapers/poti (💩) with color
- Add notes for each entry
- View daily statistics
- Historical entries with timestamps

### 3. **PostgreSQL Database**
- Persistent data storage
- Survives container restarts
- Indexed for performance

## Architecture

```
┌─────────────────┐
│   Frontend      │
│  (HTML/JS/CSS)  │
│  Port 5000      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Flask Backend  │
│   Python API    │
│  Port 5000      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   PostgreSQL    │
│    Database     │
│   Port 5432     │
└─────────────────┘
```

## Setup & Running

### Prerequisites
- Docker
- Docker Compose
- [uv](https://github.com/astral-sh/uv) (for local development)

### Quick Start

1. **Build and start all services:**
```bash
docker-compose up --build
```

2. **Access the application:**
- Main Guide: http://localhost:8082
- Tracker: http://localhost:8082/tracker.html
- API Health: http://localhost:8082/api/health

3. **Stop the services:**
```bash
docker-compose down
```

4. **Stop and remove all data:**
```bash
docker-compose down -v
```

## API Endpoints

### Entries
- `GET /api/entries` - Get all entries (last 100)
- `GET /api/entries?date=YYYY-MM-DD` - Get entries for specific date
- `POST /api/entries` - Create new entry
- `DELETE /api/entries/:id` - Delete specific entry
- `DELETE /api/entries` - Delete all entries

### Statistics
- `GET /api/stats` - Get daily statistics
- `GET /api/stats?date=YYYY-MM-DD` - Get stats for specific date

### Health
- `GET /api/health` - Check service health

## Database Schema

```sql
CREATE TABLE entries (
    id SERIAL PRIMARY KEY,
    temperature DECIMAL(4,1),
    feed_amount INTEGER,
    feed_type VARCHAR(50),
    susu_count INTEGER DEFAULT 0,
    poti_count INTEGER DEFAULT 0,
    poti_color VARCHAR(50),
    notes TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Environment Variables

Configure in `docker-compose.yml`:
- `DB_HOST`: PostgreSQL host (default: `db`)
- `DB_NAME`: Database name (default: `baby_tracker`)
- `DB_USER`: Database user (default: `postgres`)
- `DB_PASSWORD`: Database password (default: `postgres`)
- `DB_PORT`: Database port (default: `5432`)

## File Structure

```
.
├── docker-compose.yml      # Docker services configuration
├── Dockerfile              # Flask backend container
├── pyproject.toml          # Python dependencies (uv)
├── app.py                  # Flask API backend
├── init.sql               # Database initialization
├── html/
│   ├── index.html         # Main guide page
│   └── tracker.html       # Tracker page
└── README.md              # This file
```

## Development

### Running Locally (without Docker)

1. **Start PostgreSQL:**
```bash
# Using Docker
docker run -d \
  --name baby-tracker-db \
  -e POSTGRES_DB=baby_tracker \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:15-alpine
```

2. **Install Python dependencies:**
```bash
# Install uv if not already installed
curl -LsSf https://astral.sh/uv/install.sh | sh

# Sync dependencies
uv sync
```

3. **Set environment variables:**
```bash
export DB_HOST=localhost
export DB_NAME=baby_tracker
export DB_USER=postgres
export DB_PASSWORD=postgres
export DB_PORT=5432
```

4. **Run Flask app:**
```bash
# Run with uv
uv run python app.py

# Or activate virtual environment and run
source .venv/bin/activate
python app.py
```

### Database Access

```bash
# Connect to database
docker exec -it baby-tracker-db psql -U postgres -d baby_tracker

# View entries
SELECT * FROM entries ORDER BY timestamp DESC LIMIT 10;

# Count entries
SELECT COUNT(*) FROM entries;

# Daily summary
SELECT 
  DATE(timestamp) as date,
  COUNT(*) as total_entries,
  SUM(susu_count) as total_wet_diapers,
  SUM(poti_count) as total_soiled_diapers
FROM entries
GROUP BY DATE(timestamp)
ORDER BY date DESC;
```

## Troubleshooting

### Database connection issues
```bash
# Check if database is running
docker-compose ps

# View backend logs
docker-compose logs backend

# View database logs
docker-compose logs db
```

### Reset everything
```bash
# Stop and remove containers, volumes
docker-compose down -v

# Rebuild and start
docker-compose up --build
```

## Security Notes

⚠️ **For Production Use:**
1. Change default PostgreSQL password
2. Use environment variables file (`.env`)
3. Enable HTTPS/SSL
4. Add authentication/authorization
5. Implement data backup strategy
6. Set up proper logging

## Medical Disclaimer

This tool is for educational and tracking purposes only. Always follow your pediatrician's or nephrologist's specific medical advice. Seek immediate medical attention for:
- Temperature > 38°C (100.4°F)
- Fewer than 3 wet diapers in 24 hours
- Red/bloody or white/pale stools
- Excessive fussiness or lethargy
- Refusing feeds

## License

MIT License - Feel free to modify and use for personal purposes.
