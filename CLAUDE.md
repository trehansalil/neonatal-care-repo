# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Flask-based neonatal care tracker for logging baby care events (feeding, diapers, temperature, weight) via voice or manual input. Core features: speech-to-text pipeline, LLM categorization, real-time SSE updates, and ClickHouse analytics.

## Commands

```bash
# Setup & dependencies (uses uv package manager)
make setup          # Install ffmpeg, uv, sync Python deps

# Docker Compose services
make dev-up         # Start all containers (detached)
make dev-build      # Rebuild images and start
make dev-down       # Stop (preserves volumes)
make clean          # Remove all containers, networks, volumes (destructive)
make dev-logs       # Stream all service logs
make dev-restart    # Restart without rebuilding

# Data management
make dev-export-data  # Export ClickHouse → backups/clickhouse_export_YYYYMMDD_HHMMSS/
make dev-import-data  # Import latest backup (with --truncate-first)

# Run backend locally (rarely needed; Docker preferred)
uv run python app.py

# Run test scripts
uv run python test_categorization.py
uv run python test_entry_mapping.py
uv run python test_notifications.py
```

**Access points after `make dev-up`:**
- App: `https://localhost` (Nginx) or `https://localhost:8082` (Flask direct)
- MinIO console: `http://localhost:9001`
- n8n: `http://localhost:5678`
- ClickHouse HTTP: `http://localhost:8123`

**Health check:** `GET /api/health`

## Architecture

```
Nginx (:80/:443) → Flask/Gunicorn (:5000 internal, :8082 external)
                      ├── ClickHouse (:8123) — OLAP database
                      ├── MinIO (:9000 internal, :9002 external) — audio storage
                      ├── Redis (:6379) — SSE pub/sub + notification state
                      └── Transcription Server (host:8083) — MLX Whisper on Mac
                   → Azure OpenAI — LLM categorization/mapping (async background)
                   → n8n (:5678) — webhook automation (Telegram notifications)
```

Gunicorn runs **4 workers with Gevent**. Redis pub/sub is the backbone for SSE across workers—without Redis, SSE falls back to single-worker in-memory queues. A file-based lock (`/tmp/baby_tracker_notification_checker.lock`) ensures only one worker runs the background notification thread.

## Key Source Files

- [app.py](app.py): Monolithic Flask app (~1,900 lines). Contains all routes, `init_db()` (schema source of truth), SSE broadcast logic, `get_next_id()`, and the background notification checker.
- [src/settings.py](src/settings.py): Pydantic Settings; import via `from src.settings import configured_settings`
- [src/services/speech/llm/categorization_service.py](src/services/speech/llm/categorization_service.py): LLM categorization with `instructor` + Pydantic models
- [src/services/speech/llm/entry_mapping_service.py](src/services/speech/llm/entry_mapping_service.py): Structured field extraction (feed_amount, susu_count, poti_color, etc.)
- [src/services/speech/async_processor.py](src/services/speech/async_processor.py): Background thread pool (2 workers per Gunicorn process) for async LLM tasks
- [src/services/s3_compatible_service.py](src/services/s3_compatible_service.py): MinIO client; `MINIO_ENDPOINT` for internal access, `MINIO_EXTERNAL_ENDPOINT` for presigned URLs
- [init_clickhouse.sql](init_clickhouse.sql): Schema reference (runtime schema managed by `init_db()` in app.py)

## ClickHouse Patterns

**Critical: Mutations are async by default.** Always use `SETTINGS mutations_sync=2` for DELETE/UPDATE (controlled by `MUTATIONS_SYNC_LEVEL` env var):

```python
client.command('''
    ALTER TABLE entries DELETE WHERE id = %(id)s
    SETTINGS mutations_sync=%(sync)s
''', parameters={'id': entry_id, 'sync': MUTATIONS_SYNC_LEVEL})
```

**No auto-increment IDs**: Use `get_next_id(client)` before every INSERT (implements `MAX(id)+1` with retry logic).

**Connection pattern:**
```python
client = get_db_connection()
try:
    ...
finally:
    client.close()
```

**Three tables:** `entries` (main care log), `entries_backup` (TTL 1 day), `speech_entries` (voice recordings + transcriptions).

**Timezone:** All DateTime64 columns use `LOCAL_TIMEZONE` (pytz object from `TZ` env var, default `Asia/Kolkata`).

## Speech Processing Pipeline

```
POST /api/speech_entries (multipart audio)
  → MinIO: speech/{date}/speech_{uuid}.webm
  → STT service (MLX Whisper or AssemblyAI)
  → ClickHouse speech_entries INSERT (status: pending_categorization)
  → SSE: transcription_complete
  → async_processor queue → LLM categorization → update speech_entries.category
  → SSE: categorization_update
  → entry_mapping_service → INSERT into entries
  → SSE: mapping_complete
```

## SSE (Server-Sent Events)

```python
broadcast_sse_event('transcription_complete', {'entry_id': id, 'transcription': text})
```

Publishes to Redis channel; all workers subscribe and forward to connected clients. Endpoint: `GET /api/events/transcription`. Nginx must have `X-Accel-Buffering: no` (already configured).

## Frontend

- **No build step.** Nginx serves static HTML/CSS/JS directly; changes apply on browser reload.
- **Vanilla JS** in [html/js/tracker.js](html/js/tracker.js) (126KB, organized by `// SECTION: Name` markers).
- **CSS** split into 10 focused modules under [html/css/modules/](html/css/modules/), imported via [html/css/tracker-main.css](html/css/tracker-main.css). Edit the relevant module (e.g., `modals.css` for dialogs, `dashboard.css` for metrics).
- Tailwind CSS loaded from CDN; MediaRecorder API for audio capture.

## Adding New Features

**New API endpoint:**
1. Add route in `app.py` with `@app.route('/api/<name>', methods=[...])`
2. Use `get_db_connection()` / `client.close()` in finally block
3. Return `jsonify(data)` on success, `jsonify({'error': 'msg'})` with 4xx/5xx on failure

**Schema changes:**
1. Update `init_db()` in `app.py` (runtime source of truth)
2. Update `init_clickhouse.sql` for reference
3. Use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` for migrations
4. Verify with `make clean && make dev-up`

**New LLM prompt:**
- Add inline in service class; use `instructor` + Pydantic model for structured output
- See `_build_categorization_prompt()` in `categorization_service.py` as example

## Configuration

All config via `.env` (see [.env.example](.env.example)); loaded by Pydantic Settings in `src/settings.py`.

Key variables:
- `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` — LLM
- `MINIO_ENDPOINT` (`minio:9000` internal), `MINIO_EXTERNAL_ENDPOINT` (`localhost:9002` for presigned URLs)
- `HOST_TRANSCRIPTION_URL` — `http://host.docker.internal:8083/transcribe` (Docker → Mac host)
- `REDIS_URL` — default `redis://redis:6379/0`
- `N8N_WEBHOOK_ID`, `N8N_HOST` — Telegram notification webhooks
- `ENABLE_BACKGROUND_NOTIFICATIONS` — default `False`; frontend JS timer handles diaper alerts
- `TZ` — default `Asia/Kolkata`

## Logging

```python
from src.log import get_logger
logger = get_logger(__name__)
```

Logs to stdout (captured by Docker). Set level via `LOG_LEVEL` env var (default: INFO).
