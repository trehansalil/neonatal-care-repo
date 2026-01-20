# Copilot Instructions for Neonatal Management

## Project Overview

Flask-based neonatal care tracking application with speech-to-text integration, LLM-powered categorization, and ClickHouse analytics. Designed for real-time baby care logging via voice/manual entry with HTML/JS frontend.

## Architecture

```
Frontend (HTML/JS) → Flask API → ClickHouse DB
                              → MinIO S3 Storage → Transcription Server (Mac-native)
                              → Azure OpenAI (Categorization & Mapping)
```

### Key Services
- **Flask Backend** ([app.py](app.py)): Main API server (port 5000), CORS-enabled, HTTPS via self-signed certs
- **ClickHouse**: OLAP database for baby entries (port 8123), partitioned by month, timezone-aware (Asia/Kolkata default)
- **MinIO**: S3-compatible audio storage (port 9002 external, 9000 internal)
- **Transcription Server** ([transcription_server.py](transcription_server.py)): Mac-native MLX Whisper server (port 8083), runs on host machine via `host.docker.internal`
- **Azure OpenAI**: LLM categorization/mapping via async background workers

## Development Workflow

### Setup & Running
```bash
# Install dependencies (uses uv package manager)
make setup  # Installs ffmpeg, uv, syncs dependencies

# Start all services (Docker Compose)
make dev-up  # Backend at https://localhost:8082, MinIO console at localhost:9001

# View logs
make dev-logs

# Stop services
make dev-down  # Preserves data
make clean     # Removes volumes (DESTRUCTIVE)
```

### Local Development (No Docker - rarely used)
1. Start native transcription server: `./start_transcription_server.sh` (requires Apple Silicon Mac)
2. Set `DB_HOST=localhost`, `HOST_TRANSCRIPTION_URL=http://localhost:8083/transcribe`
3. Run `uv run python app.py`

**Note**: Docker Compose workflow is preferred for development.

### Testing
- Use [test_categorization.py](test_categorization.py) to validate LLM categorization
- Use [test_entry_mapping.py](test_entry_mapping.py) to test entry mapping
- No formal test suite; manual testing via `/api/health` and HTML UI

## Critical Patterns

### Database Operations (ClickHouse-specific)
- **Mutations are async by default**: Use `SETTINGS mutations_sync=2` for DELETE/UPDATE (set via `MUTATIONS_SYNC_LEVEL` env var)
- **No auto-increment IDs**: Call `get_next_id(client)` before INSERT (uses MAX(id)+1)
- **Timezone handling**: All DateTime64 columns use `LOCAL_TIMEZONE` (pytz object from `TZ` env var)
- **Table structure**: See [init_clickhouse.sql](init_clickhouse.sql) - two tables: `entries` (main), `entries_backup` (TTL 1 day)

Example DELETE pattern:
```python
client.command('''
    ALTER TABLE entries 
    DELETE WHERE id = %(id)s 
    SETTINGS mutations_sync=%(sync)s
''', parameters={'id': entry_id, 'sync': MUTATIONS_SYNC_LEVEL})
```

### Speech Entry Processing Pipeline
1. **Upload audio** → POST `/api/speech_entries` with multipart form data
2. **Store in MinIO** → `s3_storage.upload_bytes()` with `speech/{date}/speech_{uuid}.webm` key
3. **Transcribe** → `stt_service.transcribe_object()` calls external API or local MLX
4. **Insert DB** → Create `speech_entries` row with transcription
5. **Async categorize** → `speech_processor.submit_task()` queues LLM analysis
6. **Update category** → Background worker updates DB via `update_speech_entry_category()`
7. **Map to entry** (optional) → `mapping_service` creates structured `entries` row from speech

### LLM Integration
- Uses **Azure OpenAI (gpt-4.1)** via `instructor` library for structured extraction
- **Categorization**: [categorization_service.py](src/services/speech/llm/categorization_service.py) → returns `CategorizationExtraction` Pydantic model
- **Mapping**: [entry_mapping_service.py](src/services/speech/llm/entry_mapping_service.py) → extracts fields like `feed_amount`, `susu_count`
- **Async workers**: [async_processor.py](src/services/speech/async_processor.py) manages background threads (default 2 workers)
- **Graceful degradation**: LLM failures don't break speech entry creation
- **Prompts**: Currently inline in service classes; planned migration to [src/prompts/](src/prompts/) directory

### Configuration Management
- **Pydantic Settings**: [src/settings.py](src/settings.py) loads from `.env` + environment variables
- **Access via**: `from src.settings import configured_settings`
- **Critical env vars**:
  - `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_KEY`, `AZURE_OPENAI_DEPLOYMENT` (LLM)
  - `MINIO_ENDPOINT` (internal: `minio:9000`), `MINIO_EXTERNAL_ENDPOINT` (presigned URLs: `localhost:9002`)
  - `HOST_TRANSCRIPTION_URL` (Docker → host Mac: `http://host.docker.internal:8083/transcribe`)
  - `TZ` (default: `Asia/Kolkata`)

### Service Clients (src/services/)
- **S3StorageService**: [s3_compatible_service.py](src/services/s3_compatible_service.py)
  - Auto-creates buckets on init
  - `upload_bytes()` for in-memory uploads
  - `get_presigned_url()` for browser playback (uses `MINIO_EXTERNAL_ENDPOINT`)
- **STTService**: [stt_service.py](src/services/stt_service.py)
  - Calls external API or local MLX
  - Returns empty string on failure (non-blocking)

## Data Backup/Restore
```bash
make dev-export-data  # Exports to backups/clickhouse_export_YYYYMMDD_HHMMSS/
make dev-import-data  # Imports latest backup (with --truncate-first flag)
```

## Project-Specific Conventions

### Logging
- Use `from src.log import get_logger` → `logger = get_logger(__name__)`
- Logs to stdout + file ([transcription_server.log](transcription_server.log) for transcription server)

### API Response Patterns
- **Success**: `jsonify(data)` with 200/201
- **Error**: `jsonify({'error': 'message'})` with 400/404/500
- **Health check**: `GET /api/health` returns `{'status': 'healthy', 'database': 'connected'}`

### Frontend Conventions (HTML files in html/)
- Vanilla JS + Tailwind CSS (CDN)
- API calls via `fetch()` with HTTPS
- Audio recording uses MediaRecorder API → Blob → FormData

### File Naming
- Speech audio: `speech_{uuid}.webm` in `speech/YYYYMMDD/` prefix
- Backups: `clickhouse_export_YYYYMMDD_HHMMSS/` with JSONL format

## Common Tasks

### Add a new API endpoint
1. Add route in [app.py](app.py) using `@app.route('/api/<name>', methods=[...])`
2. Use `get_db_connection()` for ClickHouse client (remember `client.close()`)
3. Return `jsonify()` responses with appropriate status codes

### Modify database schema
1. Update [init_clickhouse.sql](init_clickhouse.sql) for reference
2. Update `init_db()` function in [app.py](app.py) (source of truth at runtime)
3. Run migration logic in `init_db()` (ClickHouse supports `ALTER TABLE ADD COLUMN IF NOT EXISTS`)

### Add new LLM prompt
1. Add prompt inline in service class (standard pattern; planned future migration to [src/prompts/](src/prompts/))
2. Use `instructor` library with Pydantic models for structured extraction
3. Example: See `_build_categorization_prompt()` in [categorization_service.py](src/services/speech/llm/categorization_service.py)
4. Configure via `AZURE_OPENAI_DEPLOYMENT` (currently uses gpt-4.1)

### Debug speech transcription
1. Check [transcription_server.log](transcription_server.log)
2. Verify MinIO audio upload: `docker exec -it baby-tracker-minio ls /data/neonatal-data/speech/`
3. Test transcription endpoint: `curl -X POST http://localhost:8083/transcribe -H "Content-Type: application/json" -d '{"object_key":"speech/..."}'`

## Important Notes

- **No PostgreSQL**: Project migrated from PostgreSQL to ClickHouse (legacy references may exist in docs)
- **Medical disclaimer**: Tool is for tracking only, not medical advice (see [README.md](README.md))
- **Self-signed certs**: [cert.pem](cert.pem) and [key.pem](key.pem) for local HTTPS (browser warnings expected)
- **Branch strategy**: Current branch `feat/design_log_pivot_to_speech` focuses on speech integration
