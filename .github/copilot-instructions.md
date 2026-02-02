# Copilot Instructions for Neonatal Management

## Project Overview

Flask-based neonatal care tracking application with speech-to-text integration, LLM-powered categorization, and ClickHouse analytics. Designed for real-time baby care logging via voice/manual entry with HTML/JS frontend.

## Architecture

```
                    ┌──────────────┐
                    │   Nginx      │ :80/:443 (HTTPS gateway)
                    │  Reverse     │
                    │   Proxy      │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   ┌─────────┐      ┌──────────┐      ┌──────────┐
   │ Static  │      │  Flask   │      │  MinIO   │
   │  HTML   │      │ Backend  │      │   S3     │
   │  Files  │      │(Gunicorn)│      │ Storage  │
   └─────────┘      └────┬─────┘      └────┬─────┘
                         │                  │
                ┌────────┼──────────────────┤
                │        │                  │
                ▼        ▼                  ▼
         ┌──────────┐ ┌──────────┐  ┌───────────────┐
         │ClickHouse│ │  Redis   │  │Transcription  │
         │    DB    │ │  Pubsub  │  │Server (Host)  │
         └──────────┘ └──────────┘  └───────────────┘
                         │
                         ▼
                  ┌──────────────┐
                  │ Azure OpenAI │
                  │     LLM      │
                  └──────────────┘
```

### Key Services
- **Nginx** ([nginx.conf](nginx.conf)): Reverse proxy serving static HTML, proxies `/api/*` to Flask backend, HTTPS on port 443, HTTP redirect from port 80
- **Flask Backend** ([app.py](app.py)): Main API server (4 Gunicorn workers with Gevent), CORS-enabled, HTTPS via self-signed certs, port 5000 (exposed as 8082)
- **ClickHouse**: OLAP database for baby entries (HTTP interface port 8123, native protocol port 9000), partitioned by month, timezone-aware (Asia/Kolkata default)
- **MinIO**: S3-compatible audio storage (API port 9002 external, 9000 internal, console port 9001), CORS enabled for audio playback
- **Redis**: Pub/sub for SSE (Server-Sent Events) across Gunicorn workers (port 6379)
- **Transcription Server** ([transcription_server.py](transcription_server.py)): Mac-native MLX Whisper server (port 8083), runs on host machine via `host.docker.internal`
- **Azure OpenAI**: LLM categorization/mapping via async background workers (2 threads per worker)
- **n8n**: Webhook automation for notifications (port 5678)

## Development Workflow

### Setup & Running
```bash
# Install dependencies (uses uv package manager)
make setup  # Installs ffmpeg, uv via pip, syncs dependencies

# Start all services (Docker Compose)
make dev-up  # Starts all containers in detached mode
# Access points: 
# - Nginx: http://localhost (redirects to https://localhost)
# - Backend (direct): https://localhost:8082
# - MinIO console: http://localhost:9001
# - ClickHouse HTTP: http://localhost:8123
# - n8n: http://localhost:5678

# View logs (follows all services)
make dev-logs

# Restart all services without rebuilding
make dev-restart

# Stop services (preserves volumes)
make dev-down

# Nuclear option: remove all containers, networks, volumes
make clean
```

### Data Backup & Restore
```bash
# Export to backups/clickhouse_export_YYYYMMDD_HHMMSS/
make dev-export-data

# Import latest backup (with --truncate-first flag)
make dev-import-data
```

### Production Deployment Pattern
- **Nginx** serves as HTTPS gateway (port 80→443 redirect), proxies `/api/*` to Gunicorn backend
- **Gunicorn** runs 4 workers with gevent async workers (300s timeout for long-running transcriptions)
- **Redis** enables SSE (Server-Sent Events) across Gunicorn workers for real-time transcription updates
- **Single notification checker**: Uses file-based lock (`/tmp/baby_tracker_notification_checker.lock`) to ensure only one Gunicorn worker runs background notification thread

### Local Development (No Docker - rarely used)
1. Start native transcription server: `./start_transcription_server.sh` (requires Apple Silicon Mac)
2. Set `DB_HOST=localhost`, `HOST_TRANSCRIPTION_URL=http://localhost:8083/transcribe`
3. Run `uv run python app.py`

**Note**: Docker Compose workflow is preferred for development.

### Testing
- Use [test_categorization.py](test_categorization.py) to validate LLM categorization
- Use [test_entry_mapping.py](test_entry_mapping.py) to test entry mapping logic
- Use [test_notifications.py](test_notifications.py) to test notification webhooks
- No formal test suite; manual testing via `/api/health` and HTML UI

## Critical Patterns

### Real-Time Updates: SSE (Server-Sent Events)
- **Multi-worker challenge**: Gunicorn runs 4 workers; client connections stick to one worker
- **Redis pub/sub solution**: `broadcast_sse_event()` publishes to Redis channel, all workers subscribe and forward to connected clients
- **Fallback**: In-memory `sse_queues` dict if Redis unavailable (single-worker only)
- **Client endpoint**: `GET /api/events/transcription` streams `text/event-stream` with heartbeats every 30s
- **Nginx config**: `X-Accel-Buffering: no` header disables proxy buffering for streaming
- **Event types**: `transcription_complete`, `mapping_complete`, `categorization_update`

Example SSE broadcast:
```python
broadcast_sse_event('transcription_complete', {
    'entry_id': entry_id,
    'transcription': text
})
```

### Database Operations (ClickHouse-specific)
- **Mutations are async by default**: Use `SETTINGS mutations_sync=2` for DELETE/UPDATE (set via `MUTATIONS_SYNC_LEVEL` env var, default 2)
- **No auto-increment IDs**: Call `get_next_id(client)` before INSERT (uses `MAX(id)+1` with table locking)
- **Timezone handling**: All DateTime64 columns use `LOCAL_TIMEZONE` (pytz object from `TZ` env var, default Asia/Kolkata)
- **Table structure**: See [init_clickhouse.sql](init_clickhouse.sql) - three tables: `entries` (main), `entries_backup` (TTL 1 day), `speech_entries`
- **Connection pattern**: Always use `client = get_db_connection()` followed by `client.close()` in finally block

Example DELETE pattern:
```python
client.command('''
    ALTER TABLE entries 
    DELETE WHERE id = %(id)s 
    SETTINGS mutations_sync=%(sync)s
''', parameters={'id': entry_id, 'sync': MUTATIONS_SYNC_LEVEL})
```

### Speech Entry Processing Pipeline
1. **Upload audio** → POST `/api/speech_entries` with multipart form data (webm/wav/mp3)
2. **Store in MinIO** → `s3_storage.upload_bytes()` with `speech/{date}/speech_{uuid}.webm` key
3. **Transcribe** → `stt_service.transcribe_object()` calls external API or local MLX
4. **Insert DB** → Create `speech_entries` row with transcription, status 'pending_categorization'
5. **Async categorize** → `speech_processor.submit_task()` queues LLM analysis
6. **Update category** → Background worker updates DB via `update_speech_entry_category()`
7. **Map to entry** (optional) → `mapping_service` creates structured `entries` row from speech

### LLM Integration
- Uses **Azure OpenAI (gpt-4.1)** via `instructor` library for structured extraction
- **Categorization**: [categorization_service.py](src/services/speech/llm/categorization_service.py) → returns `CategorizationExtraction` Pydantic model
- **Mapping**: [entry_mapping_service.py](src/services/speech/llm/entry_mapping_service.py) → extracts fields like `feed_amount`, `susu_count`, `poti_color`
- **Async workers**: [async_processor.py](src/services/speech/async_processor.py) manages background threads (default 2 workers per Gunicorn process)
- **Graceful degradation**: LLM failures don't break speech entry creation; entries remain in pending state
- **Prompts**: Currently inline in service classes; planned migration to [src/prompts/](src/prompts/) directory

### Configuration Management
- **Pydantic Settings**: [src/settings.py](src/settings.py) loads from `.env` + environment variables
- **Access via**: `from src.settings import configured_settings`
- **Critical env vars** (see [.env.example](.env.example)):
  - `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` (LLM)
  - `MINIO_ENDPOINT` (internal: `minio:9000`), `MINIO_EXTERNAL_ENDPOINT` (presigned URLs: `localhost:9002`)
  - `HOST_TRANSCRIPTION_URL` (Docker → host Mac: `http://host.docker.internal:8083/transcribe`)
  - `TZ` (default: `Asia/Kolkata`)
  - `REDIS_URL` (default: `redis://redis:6379/0` for SSE pub/sub)
  - `N8N_WEBHOOK_ID`, `N8N_HOST` (notification webhooks)
  - `ENABLE_BACKGROUND_NOTIFICATIONS` (bool, default: False - frontend timer handles alerts)
  - `DIAPER_ALERT_HOURS` (default: 4)
  - `NOTIFICATION_CHECK_INTERVAL_MINUTES` (default: 60)

### Service Clients (src/services/)
- **S3StorageService**: [s3_compatible_service.py](src/services/s3_compatible_service.py)
  - Auto-creates buckets on init
  - `upload_bytes()` for in-memory uploads
  - `get_presigned_url()` for browser playback (uses `MINIO_EXTERNAL_ENDPOINT`)
- **STTService**: [stt_service.py](src/services/stt_service.py)
  - Calls external API or local MLX transcription server
  - Returns empty string on failure (non-blocking)

### Frontend Notification Pattern
- **Client-side timer**: JavaScript updates diaper change timer every 30 seconds in browser
- **Visual states**: Card changes color based on elapsed time (green → amber at 75% → red at 100%)
- **Webhook integration**: Frontend sends notifications to n8n webhook at threshold (default: 4 hours)
- **LocalStorage deduplication**: Tracks `lastNotifiedTimestamp` to prevent duplicate alerts
- **Backdating support**: Calculates elapsed time from entry timestamp (not creation time)
- **Backend alternative**: `ENABLE_BACKGROUND_NOTIFICATIONS=True` enables server-side checking (disabled by default to reduce DB load)
- **Implementation**: See `updateDiaperNappyTimerDisplay()` and `sendDiaperNappyNotification()` in [tracker.html](html/tracker.html)

## Project-Specific Conventions

### Logging
- Use `from src.log import get_logger` → `logger = get_logger(__name__)`
- Logs to stdout (captured by Docker) + file ([transcription_server.log](transcription_server.log) for transcription server only)
- Log levels: DEBUG for development, INFO for production

### API Response Patterns
- **Success**: `jsonify(data)` with 200/201
- **Error**: `jsonify({'error': 'message'})` with 400/404/500
- **Health check**: `GET /api/health` returns `{'status': 'healthy', 'database': 'connected'}`
- **CORS**: Enabled via Flask-CORS for all origins (production should restrict)

### Frontend Conventions (HTML files in html/)
- Vanilla JS + Tailwind CSS (CDN)
- API calls via `fetch()` with HTTPS
- Audio recording uses MediaRecorder API → Blob → FormData
- No build step required; served directly by Nginx

### File Naming
- Speech audio: `speech_{uuid}.webm` in `speech/YYYYMMDD/` prefix
- Backups: `clickhouse_export_YYYYMMDD_HHMMSS/` with JSONL format

## Common Tasks

### Add a new API endpoint
1. Add route in [app.py](app.py) using `@app.route('/api/<name>', methods=[...])`
2. Use `get_db_connection()` for ClickHouse client (remember `client.close()` in finally block)
3. Return `jsonify()` responses with appropriate status codes
4. Add CORS headers if needed (Flask-CORS handles most cases)

### Modify database schema
1. Update [init_clickhouse.sql](init_clickhouse.sql) for reference documentation
2. Update `init_db()` function in [app.py](app.py) (source of truth at runtime)
3. Run migration logic in `init_db()` (ClickHouse supports `ALTER TABLE ADD COLUMN IF NOT EXISTS`)
4. Test with `make clean && make dev-up` to verify fresh database initialization

### Add new LLM prompt
1. Add prompt inline in service class (standard pattern; planned future migration to [src/prompts/](src/prompts/))
2. Use `instructor` library with Pydantic models for structured extraction
3. Example: See `_build_categorization_prompt()` in [categorization_service.py](src/services/speech/llm/categorization_service.py)
4. Configure via `AZURE_OPENAI_DEPLOYMENT` (currently uses gpt-4.1)
5. Test with [test_categorization.py](test_categorization.py) or [test_entry_mapping.py](test_entry_mapping.py)

### Debug speech transcription
1. Check [transcription_server.log](transcription_server.log)
2. Verify MinIO audio upload: `docker exec -it baby-tracker-minio ls /data/neonatal-data/speech/`
3. Test transcription endpoint: `curl -X POST http://localhost:8083/transcribe -H "Content-Type: application/json" -d '{"object_key":"speech/..."}'`
4. Check backend logs: `docker compose logs backend`
5. Verify SSE events in browser console (tracker.html listens to `/api/events/transcription`)

### Access database directly
```bash
# Connect to ClickHouse
docker exec -it baby-tracker-clickhouse clickhouse-client --user clickhouse --password clickhouse

# View entries
SELECT * FROM entries ORDER BY timestamp DESC LIMIT 10;

# Count entries
SELECT COUNT(*) FROM entries;

# Daily summary
SELECT 
  toDate(timestamp) as date,
  COUNT(*) as total_entries,
  SUM(susu_count) as total_wet_diapers,
  SUM(poti_count) as total_soiled_diapers
FROM entries
GROUP BY date
ORDER BY date DESC;
```

## Important Notes

- **No PostgreSQL**: Project migrated from PostgreSQL to ClickHouse (legacy references may exist in older docs)
- **Medical disclaimer**: Tool is for tracking only, not medical advice (see [README.md](README.md))
- **Self-signed certs**: [cert.pem](cert.pem) and [key.pem](key.pem) for local HTTPS (browser warnings expected)
- **Current branch**: `feat/design_imporvements_dashboard` - design improvements for dashboard UI
- **Gunicorn pattern**: File-based locks in `/tmp/` used to coordinate single-instance background tasks across workers
- **uv package manager**: Project uses `uv` for fast Python dependency management; see [pyproject.toml](pyproject.toml) for dependencies
- **MTU setting**: Docker network MTU set to 1000 in docker-compose.yml for better compatibility with certain network environments
