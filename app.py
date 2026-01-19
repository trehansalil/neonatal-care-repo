from flask import Flask, jsonify, request, send_from_directory, Response
from flask_cors import CORS
import clickhouse_connect
from clickhouse_connect.driver.exceptions import OperationalError
from datetime import datetime
import os
import time
import pytz
import uuid
from typing import Optional

from src.log import get_logger
from src.settings import configured_settings
from src.services.s3_compatible_service import S3StorageService
from src.services.stt_service import STTService
from src.services.speech.llm.categorization_service import CategorizationService
from src.services.speech.llm.entry_mapping_service import EntryMappingService
from src.services.speech.async_processor import AsyncSpeechProcessor

logger = get_logger(__name__)

app = Flask(__name__, static_folder='html', static_url_path='')
CORS(app)

# Database configuration
DB_CONFIG = {
    # Default to localhost for easy local dev; docker-compose passes DB_HOST=clickhouse
    'host': os.environ.get('DB_HOST', 'localhost'),
    'port': int(os.environ.get('DB_PORT', '8123')),
    'database': os.environ.get('DB_NAME', 'baby_tracker'),
    'username': os.environ.get('DB_USER', 'clickhouse'),
    'password': os.environ.get('DB_PASSWORD', 'clickhouse'),
    # Improve resilience against transient HTTP disconnects
    'http_retries': int(os.environ.get('DB_HTTP_RETRIES', '3')),
    'connect_timeout': int(os.environ.get('DB_CONNECT_TIMEOUT', '5')),
    'send_receive_timeout': int(os.environ.get('DB_SEND_RECV_TIMEOUT', '30')),
}

# Timezone configuration - set your local timezone
try:
    tz_string = os.environ.get('TZ', 'Asia/Kolkata')
    LOCAL_TIMEZONE = pytz.timezone(tz_string)
    # pytz.timezone() already validates the timezone string and raises an exception for invalid zones
    # The zone attribute is safe to use in SQL as it comes from pytz's validated timezone database
except Exception as e:
    print(f"Error setting timezone: {e}. Falling back to Asia/Kolkata")
    LOCAL_TIMEZONE = pytz.timezone('Asia/Kolkata')

# Column names for entries table (used in insert operations)
ENTRY_COLUMNS = [
    'id', 'temperature', 'feed_amount', 'feed_type',
    'susu_count', 'poti_count', 'poti_color', 'weight',
    'notes', 'timestamp', 'created_at'
]

# Mutation sync settings for DELETE operations
# mutations_sync=2 forces synchronous execution and waits for all replicas to complete.
# This ensures strong consistency but can cause latency in replicated setups.
# In single-node deployments, this provides immediate consistency.
# Set to 0 for async (no wait), 1 for wait on initiator replica, 2 for wait on all replicas.
try:
    MUTATIONS_SYNC_LEVEL = int(os.environ.get('MUTATIONS_SYNC_LEVEL', '2'))
except (ValueError, TypeError) as e:
    print(f"Invalid MUTATIONS_SYNC_LEVEL value: {os.environ.get('MUTATIONS_SYNC_LEVEL')}. "
          f"Falling back to default 2. Error: {e}")
    MUTATIONS_SYNC_LEVEL = 2

# Settings and storage clients

s3_storage = S3StorageService()

# Transcription service - use native Mac server if HOST_TRANSCRIPTION_URL is set
# Default to http://host.docker.internal:8083/transcribe for Docker
transcription_url = os.environ.get('HOST_TRANSCRIPTION_URL', 'http://host.docker.internal:8083/transcribe')
stt_service = STTService(
    storage_client=s3_storage,
    bucket_name=configured_settings.minio_bucket_name,
    transcription_url=transcription_url
)

# LLM Categorization service - uses Azure OpenAI
# Configure via environment variables:
# AZURE_OPENAI_ENDPOINT: Azure OpenAI endpoint URL
# AZURE_OPENAI_KEY: Azure OpenAI API key
# AZURE_OPENAI_DEPLOYMENT: Model deployment name
# AZURE_OPENAI_API_VERSION: API version (default: 2024-02-15-preview)
try:
    categorization_service = CategorizationService()
    if categorization_service.is_available():
        logger.info("LLM categorization service initialized with Azure OpenAI")
    else:
        logger.warning("LLM categorization service initialized but Azure OpenAI not configured")
except Exception as e:
    logger.error(f"Failed to initialize LLM service: {e}")
    categorization_service = None

# Entry Mapping service - uses Azure OpenAI to map transcriptions to structured entries
try:
    mapping_service = EntryMappingService()
    if mapping_service.is_available():
        logger.info("Entry mapping service initialized with Azure OpenAI")
    else:
        logger.warning("Entry mapping service initialized but Azure OpenAI not configured")
except Exception as e:
    logger.error(f"Failed to initialize entry mapping service: {e}")
    mapping_service = None

# Async categorization processor (now includes mapping)
if categorization_service:
    speech_processor = AsyncSpeechProcessor(
        categorization_service=categorization_service,
        mapping_service=mapping_service,
        max_workers=int(os.environ.get('CATEGORIZATION_WORKERS', '2'))
    )
    # Start the processor when app starts
    speech_processor.start()
    logger.info("Async categorization processor started")
else:
    speech_processor = None
    logger.warning("Categorization processor not started (LLM service unavailable)")


def update_speech_entry_category(result: dict):
    """Callback to update the database with categorization results.
    
    Args:
        result: Dict containing entry_id, category, and optional metadata
    """
    entry_id = result.get('entry_id')
    category = result.get('category', 'unclear')

    logger.info(f"Updating entry {entry_id} with category '{category}'")
    
    try:
        client = get_db_connection()
        try:
            # Update the category in the database
            client.command('''
                ALTER TABLE speech_entries 
                UPDATE category = %(category)s 
                WHERE id = %(id)s 
                SETTINGS mutations_sync=%(sync)s
            ''', parameters={
                'category': category,
                'id': entry_id,
                'sync': MUTATIONS_SYNC_LEVEL
            })
            logger.info(f"Updated entry {entry_id} with category '{category}'")
        finally:
            client.close()
    except Exception as e:
        logger.error(f"Failed to update category for entry {entry_id}: {e}", exc_info=True)


def create_entry_from_mapping(mapping_data: dict):
    """Callback to create a structured entry from mapped speech data.
    
    Args:
        mapping_data: Dict containing:
            - entry_id: Speech entry ID
            - category: Entry category
            - mapped_fields: Extracted structured fields
            - transcription: Original transcription
    """
    speech_entry_id = mapping_data.get('entry_id')
    category = mapping_data.get('category')
    mapped_fields = mapping_data.get('mapped_fields', {})
    transcription = mapping_data.get('transcription', '')
    
    logger.info(f"Creating entry from speech entry {speech_entry_id} (category: {category})")
    
    # Skip if there was an error in mapping
    if 'error' in mapped_fields:
        logger.warning(f"Skipping entry creation for speech entry {speech_entry_id}: {mapped_fields.get('error')}")
        return
    
    try:
        client = get_db_connection()
        try:
            # Generate a new ID for the entry
            entry_id = get_next_id(client)
            
            # Get speech entry to use its timestamp
            speech_result = client.query(
                'SELECT timestamp FROM speech_entries WHERE id = %(id)s',
                parameters={'id': speech_entry_id}
            )
            
            if not speech_result.result_rows:
                logger.warning(f"Speech entry {speech_entry_id} not found, cannot create mapped entry")
                return
            
            speech_timestamp = speech_result.result_rows[0][0]
            
            # Build the entry data based on category
            entry_data = {
                'id': entry_id,
                'temperature': mapped_fields.get('temperature'),
                'feed_amount': mapped_fields.get('feed_amount'),
                'feed_type': mapped_fields.get('feed_type'),
                'susu_count': mapped_fields.get('susu_count', 0),
                'poti_count': mapped_fields.get('poti_count', 0),
                'poti_color': mapped_fields.get('poti_color'),
                'weight': mapped_fields.get('weight'),
                'notes': mapped_fields.get('notes', transcription),
                'timestamp': speech_timestamp,
                'created_at': datetime.now(LOCAL_TIMEZONE)
            }
            
            # Insert the entry
            client.insert('entries', [[
                entry_data['id'],
                entry_data['temperature'],
                entry_data['feed_amount'],
                entry_data['feed_type'],
                entry_data['susu_count'],
                entry_data['poti_count'],
                entry_data['poti_color'],
                entry_data['weight'],
                entry_data['notes'],
                entry_data['timestamp'],
                entry_data['created_at']
            ]], column_names=ENTRY_COLUMNS)
            
            logger.info(f"Created entry {entry_id} from speech entry {speech_entry_id}")
            
            # Update speech entry to add a note about the created entry
            client.command('''
                ALTER TABLE speech_entries 
                UPDATE notes = concat(ifNull(notes, ''), %(note)s)
                WHERE id = %(id)s 
                SETTINGS mutations_sync=%(sync)s
            ''', parameters={
                'note': f' [Auto-mapped to entry #{entry_id}]',
                'id': speech_entry_id,
                'sync': MUTATIONS_SYNC_LEVEL
            })
            
        finally:
            client.close()
    except Exception as e:
        logger.error(f"Failed to create entry from speech entry {speech_entry_id}: {e}", exc_info=True)


def get_db_connection():
    """Create a database connection with retry logic"""
    max_retries = 10
    retry_delay = 3
    
    for attempt in range(max_retries):
        try:
            client = clickhouse_connect.get_client(**DB_CONFIG)
            return client
        except Exception as e:
            if attempt < max_retries - 1:
                print(f"Database connection attempt {attempt + 1} failed. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                print(f"Failed to connect to database after {max_retries} attempts")
                raise

def get_next_id(client):
    """Generate a new unique ID for the entries table without using MAX(id)."""
    # Use ClickHouse to generate a random UInt32-compatible ID derived from a UUID,
    # and verify that it is not already used to avoid collisions.
    # Generate IDs from 1 to 4294967295 (avoiding 0)
    max_retries = 1000
    for attempt in range(max_retries):
        result = client.query(
            'SELECT cityHash64(generateUUIDv4()) % 4294967295 + 1 AS new_id'
        )
        new_id = result.result_rows[0][0]
        if not entry_exists(client, new_id):
            return new_id
    # If we exhausted all retries, raise an error
    raise RuntimeError(f"Failed to generate unique ID after {max_retries} attempts")

def entry_exists(client, entry_id):
    """Check if an entry exists in the database"""
    result = client.query('SELECT 1 FROM entries WHERE id = %(id)s LIMIT 1', parameters={'id': entry_id})
    return bool(result.result_rows)


def is_audio_extension_allowed(filename: str) -> bool:
    if not filename:
        return False
    ext = os.path.splitext(filename)[1].lower()
    return ext in [fmt.lower() for fmt in configured_settings.allowed_audio_formats_list]


def backup_entry(client, entry_data, entry_id):
    """
    Backup an entry to the entries_backup table before modification.
    
    Args:
        client: ClickHouse client connection
        entry_data: Row data from SELECT * FROM entries query.
                   Must contain exactly 11 columns matching ENTRY_COLUMNS constant:
                   id, temperature, feed_amount, feed_type, susu_count, poti_count, 
                   poti_color, weight, notes, timestamp, created_at.
                   The backup_id and backup_timestamp are generated separately.
        entry_id: The ID of the entry being backed up
    
    Returns:
        str or None: The backup_id (UUID) if successful, None otherwise
    
    Note:
        The entries_backup table has 13 columns total: the 11 columns from ENTRY_COLUMNS
        (id, temperature, feed_amount, feed_type, susu_count, poti_count, poti_color,
        weight, notes, timestamp, created_at) plus backup_id and backup_timestamp.
        The backup_timestamp column uses DEFAULT now64() and is automatically set by
        ClickHouse, so we don't include it in the INSERT; we only insert the 11 original
        columns plus backup_id.
    """
    try:
        # Generate a unique backup ID for this operation to prevent race conditions
        backup_id = str(uuid.uuid4())
        
        # Insert 11 original columns from entry_data plus backup_id (12 total)
        # Column order matches ENTRY_COLUMNS constant, plus backup_id
        # backup_timestamp is auto-generated by ClickHouse DEFAULT
        client.insert('entries_backup', [[
            entry_data[0], entry_data[1], entry_data[2], entry_data[3],
            entry_data[4], entry_data[5], entry_data[6], entry_data[7],
            entry_data[8], entry_data[9], entry_data[10], backup_id
        ]], column_names=ENTRY_COLUMNS + ['backup_id'])
        print(f"Backup created successfully for entry {entry_id} with backup_id {backup_id}")
        return backup_id
    except Exception as backup_error:
        print(f"Error creating backup: {backup_error}")
        return None

def restore_entry_from_backup(client, entry_id, backup_id):
    """
    Restore an entry from the backup table using a specific backup_id.
    
    Args:
        client: ClickHouse client connection
        entry_id: The ID of the entry to restore
        backup_id: The unique backup identifier to restore from
    
    Returns:
        bool: True if restore successful, False otherwise
    """
    try:
        # Select only the original entry columns using the specific backup_id
        backup_result = client.query(
            '''SELECT id, temperature, feed_amount, feed_type, susu_count, poti_count, 
               poti_color, weight, notes, timestamp, created_at 
               FROM entries_backup 
               WHERE id = %(id)s AND backup_id = %(backup_id)s
               LIMIT 1''',
            parameters={'id': entry_id, 'backup_id': backup_id}
        )
        if backup_result.result_rows:
            backup_data = backup_result.result_rows[0]
            # Column order matches ENTRY_COLUMNS constant (11 columns)
            client.insert('entries', [[
                backup_data[0], backup_data[1], backup_data[2], backup_data[3],
                backup_data[4], backup_data[5], backup_data[6], backup_data[7],
                backup_data[8], backup_data[9], backup_data[10]
            ]], column_names=ENTRY_COLUMNS)
            print(f"Rollback successful: restored entry {entry_id} from backup {backup_id}")
            return True
        else:
            print(f"No backup found for entry {entry_id} with backup_id {backup_id}")
            return False
    except Exception as rollback_error:
        print(f"Error during rollback: {rollback_error}")
        return False


def init_db():
    """Initialize database tables"""
    # First connect without specifying database to create it
    temp_config = DB_CONFIG.copy()
    temp_config['database'] = 'default'
    client = clickhouse_connect.get_client(**temp_config)
    
    try:
        # Create database
        client.command(f"CREATE DATABASE IF NOT EXISTS {DB_CONFIG['database']}")
    finally:
        client.close()
    
    # Now connect to the baby_tracker database
    client = get_db_connection()
    
    try:
        # Create entries table with timezone-aware DateTime
        client.command(f'''
            CREATE TABLE IF NOT EXISTS entries (
                id UInt32,
                temperature Nullable(Decimal32(1)),
                feed_amount Nullable(UInt16),
                feed_type Nullable(String),
                susu_count UInt16 DEFAULT 0,
                poti_count UInt16 DEFAULT 0,
                poti_color Nullable(String),
                weight Nullable(UInt16),
                notes Nullable(String),
                timestamp DateTime64(3, '{LOCAL_TIMEZONE.zone}'),
                created_at DateTime64(3, '{LOCAL_TIMEZONE.zone}')
            ) ENGINE = MergeTree()
            ORDER BY (timestamp, id)
            PRIMARY KEY (timestamp, id)
            PARTITION BY toYYYYMM(timestamp)
            SETTINGS index_granularity = 8192
        ''')

        # Speech entries table
        client.command(f'''
            CREATE TABLE IF NOT EXISTS speech_entries (
                id UInt32,
                object_key String,
                audio_url Nullable(String),
                transcription Nullable(String),
                category Nullable(String),
                mode Nullable(String),
                duration_ms Nullable(UInt32),
                notes Nullable(String),
                timestamp DateTime64(3, '{LOCAL_TIMEZONE.zone}'),
                created_at DateTime64(3, '{LOCAL_TIMEZONE.zone}')
            ) ENGINE = MergeTree()
            ORDER BY (timestamp, id)
            PRIMARY KEY (timestamp, id)
            PARTITION BY toYYYYMM(timestamp)
            SETTINGS index_granularity = 8192
        ''')
        
        # Create backup table for update rollback support
        client.command(f'''
            CREATE TABLE IF NOT EXISTS entries_backup (
                id UInt32,
                temperature Nullable(Decimal32(1)),
                feed_amount Nullable(UInt16),
                feed_type Nullable(String),
                susu_count UInt16 DEFAULT 0,
                poti_count UInt16 DEFAULT 0,
                poti_color Nullable(String),
                weight Nullable(UInt16),
                notes Nullable(String),
                timestamp DateTime64(3, '{LOCAL_TIMEZONE.zone}') DEFAULT now64(3, '{LOCAL_TIMEZONE.zone}'),
                created_at DateTime64(3, '{LOCAL_TIMEZONE.zone}') DEFAULT now64(3, '{LOCAL_TIMEZONE.zone}'),
                backup_timestamp DateTime64(3, '{LOCAL_TIMEZONE.zone}') DEFAULT now64(3, '{LOCAL_TIMEZONE.zone}'),
                backup_id String NOT NULL
            ) ENGINE = MergeTree()
            ORDER BY (id, backup_timestamp, backup_id)
            PRIMARY KEY (id, backup_timestamp, backup_id)
            TTL backup_timestamp + INTERVAL 1 DAY
            SETTINGS index_granularity = 8192
        ''')
        
        print("Database initialized successfully")
    finally:
        client.close()

# Initialize database on startup
try:
    init_db()
except Exception as e:
    print(f"Error initializing database: {e}")

# Routes

@app.route('/')
def index():
    """Serve the main page"""
    return send_from_directory('html', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    """Serve static files"""
    return send_from_directory('html', path)

@app.route('/api/speech/upload', methods=['POST'])
def upload_speech():
    """Upload a speech recording blob to S3/MinIO and return the object key + presigned URL."""
    file = request.files.get('file')
    if not file:
        return jsonify({'error': 'Missing audio file'}), 400

    filename = file.filename or 'speech.webm'
    if not is_audio_extension_allowed(filename):
        return jsonify({'error': f'Unsupported audio format. Allowed: {configured_settings.allowed_audio_formats}'}), 400

    data = file.read()
    if not data:
        return jsonify({'error': 'Empty audio payload'}), 400

    max_bytes = configured_settings.max_upload_size_mb * 1024 * 1024
    if len(data) > max_bytes:
        return jsonify({'error': f'File too large. Limit: {configured_settings.max_upload_size_mb} MB'}), 413

    ext = os.path.splitext(filename)[1] or '.webm'
    object_key = f"speech/{datetime.utcnow().strftime('%Y%m%d')}/speech_{uuid.uuid4().hex}{ext}"

    try:
        # Upload using internal endpoint (for server-side operations)
        s3_storage.upload_bytes(
            data=data,
            object_name=object_key,
            content_type=file.mimetype or 'audio/webm',
            container=configured_settings.minio_bucket_name,
            overwrite=True,
            with_sas=False  # Don't need presigned URL from internal endpoint
        )
        # Instead of a direct MinIO URL (which might trigger mixed-content or CORS issues),
        # return a proxy URL that serves the audio through the backend's HTTPS.
        proxy_url = f"/api/speech/audio/{object_key}"
        
        duration_ms = request.form.get('duration_ms') or request.args.get('duration_ms')
        return jsonify({
            'object_key': object_key,
            'url': proxy_url,
            'content_type': file.mimetype,
            'size_bytes': len(data),
            'duration_ms': int(duration_ms) if duration_ms else None
        })
    except Exception as e:
        print(f"Upload failed: {e}")
        return jsonify({'error': 'Upload failed'}), 500


@app.route('/api/speech/transcribe', methods=['POST'])
def transcribe_speech():
    """Download an audio object from S3/MinIO and return the transcript.
    
    If entry_id is provided, triggers async categorization after successful transcription.
    """
    payload = request.get_json(silent=True) or {}
    print(f"DEBUG: Received transcription request: {payload}", flush=True)
    object_key = payload.get('object_key') or request.form.get('object_key')
    entry_id = payload.get('entry_id')  # Optional: for triggering categorization
    
    if not object_key:
        print("DEBUG: missing object_key", flush=True)
        return jsonify({'error': 'object_key is required'}), 400

    try:
        logger.info(f"Fetching transcription for Audio obj key: {object_key}")
        transcript = stt_service.transcribe_object(object_key)
        if not transcript:
            logger.warning(f"Transcription returned empty result for {object_key}")
            return jsonify({'error': 'Transcription failed'}), 500
        
        # Trigger async categorization if entry_id is provided and processor is available
        if entry_id and speech_processor:
            speech_processor.submit_task(
                entry_id=entry_id,
                object_key=object_key,
                transcription=transcript,
                callback=update_speech_entry_category
            )
            logger.info(f"Submitted categorization task for entry {entry_id}")
        
        # Return success even for placeholder transcripts
        return jsonify({'object_key': object_key, 'transcript': transcript})
    except Exception as e:
        logger.error(f"Transcription error for {object_key}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/speech/audio/<path:object_key>')
def proxy_audio(object_key):
    """Proxy audio files from MinIO through HTTPS to avoid mixed content issues.
    
    When the frontend is served over HTTPS but MinIO serves over HTTP,
    browsers block the audio as 'mixed content'. This endpoint proxies
    the audio through the backend, serving it over HTTPS.
    """
    try:
        # Download the audio file from MinIO
        tmp_path = s3_storage.download_to_tmp(object_key, container=configured_settings.minio_bucket_name)
        
        # Determine content type based on extension
        ext = os.path.splitext(object_key)[1].lower()
        content_types = {
            '.webm': 'audio/webm',
            '.mp3': 'audio/mpeg',
            '.mp4': 'audio/mp4',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.wav': 'audio/wav',
        }
        content_type = content_types.get(ext, 'audio/webm')
        
        # Read and return the file
        with open(tmp_path, 'rb') as f:
            audio_data = f.read()
        
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except Exception as e:
            # Best-effort cleanup: log and continue if temp file deletion fails
            logger.warning(f"Failed to delete temporary file %s: %s", tmp_path, e)
        
        return Response(
            audio_data,
            mimetype=content_type,
            headers={
                'Accept-Ranges': 'bytes',
                'Cache-Control': 'public, max-age=86400',
            }
        )
    except Exception as e:
        logger.error(f"Error proxying audio {object_key}: {e}")
        return jsonify({'error': 'Audio not found'}), 404


@app.route('/api/entries', methods=['GET'])
def get_entries():
    """Get all entries"""
    # Simple reconnect-and-retry to tolerate transient HTTP disconnects
    for attempt in range(2):
        client = None
        try:
            client = get_db_connection()

            # Optional date/time range filters
            start_param = request.args.get('start')
            end_param = request.args.get('end')

            def parse_ts(value):
                """Parse a timestamp string and return a naive datetime in local time.

                ClickHouse stores the `timestamp` column with a timezone, and the Python
                client will convert timezone-aware datetimes to UTC before sending. If we
                pass tz-aware values here, the comparison window shifts by the timezone
                offset (e.g., IST +05:30), which was causing end-of-day filters to miss
                late-evening records. By returning a naive datetime already in local
                wall time, we align with the column's timezone and avoid double shifts.
                """
                if not value:
                    return None
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    return dt  # already local wall time
                # Convert to local timezone, then drop tzinfo so comparisons stay in local wall time
                return dt.astimezone(LOCAL_TIMEZONE).replace(tzinfo=None)

            start_ts = parse_ts(start_param)
            end_ts = parse_ts(end_param)

            if start_ts or end_ts:
                query = '''
                    SELECT * FROM entries 
                    WHERE (%(start)s IS NULL OR timestamp >= %(start)s)
                      AND (%(end)s IS NULL OR timestamp <= %(end)s)
                    ORDER BY timestamp DESC
                    LIMIT 1000
                '''
                result = client.query(query, parameters={'start': start_ts, 'end': end_ts})
            else:
                # Get last 500 entries by default
                query = 'SELECT * FROM entries ORDER BY timestamp DESC LIMIT 500'
                result = client.query(query)
            
            # Convert result to list of dictionaries
            entries = []
            for row in result.result_rows:
                entries.append({
                    'id': row[0],
                    'temperature': float(row[1]) if row[1] is not None else None,
                    'feed_amount': row[2],
                    'feed_type': row[3],
                    'susu_count': row[4],
                    'poti_count': row[5],
                    'poti_color': row[6],
                    'weight': row[7],
                    'notes': row[8],
                    'timestamp': row[9].isoformat() if row[9] else None,
                    'created_at': row[10].isoformat() if row[10] else None
                })
            
            return jsonify(entries)
        except OperationalError as e:
            logger.warning("Retrying entries fetch after OperationalError (attempt %d): %s", attempt + 1, e)
            time.sleep(0.5)
        except Exception as e:
            print(f"Error fetching entries: {e}")
            return jsonify({'error': str(e)}), 500
        finally:
            if client is not None:
                client.close()

    # If we exhausted retries, surface a 500
    return jsonify({'error': 'Failed to fetch entries after retry'}), 500


@app.route('/api/speech_entries', methods=['GET'])
def get_speech_entries():
    """Get speech entries with optional date/time filters."""
    for attempt in range(2):
        client = None
        try:
            client = get_db_connection()

            start_param = request.args.get('start')
            end_param = request.args.get('end')

            def parse_ts(value):
                if not value:
                    return None
                dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    return dt
                return dt.astimezone(LOCAL_TIMEZONE).replace(tzinfo=None)

            start_ts = parse_ts(start_param)
            end_ts = parse_ts(end_param)

            if start_ts or end_ts:
                query = '''
                    SELECT * FROM speech_entries
                    WHERE (%(start)s IS NULL OR timestamp >= %(start)s)
                      AND (%(end)s IS NULL OR timestamp <= %(end)s)
                    ORDER BY timestamp DESC
                    LIMIT 1000
                '''
                result = client.query(query, parameters={'start': start_ts, 'end': end_ts})
            else:
                query = 'SELECT * FROM speech_entries ORDER BY timestamp DESC LIMIT 500'
                result = client.query(query)

            entries = []
            for row in result.result_rows:
                object_key = row[1]
                
                # Use the proxy URL to avoid CORS and Mixed Content issues over the network
                fresh_audio_url = f"/api/speech/audio/{object_key}" if object_key else row[2]
                
                entries.append({
                    'id': row[0],
                    'object_key': object_key,
                    'audio_url': fresh_audio_url,
                    'transcription': row[3],
                    'category': row[4],
                    'mode': row[5],
                    'duration_ms': row[6],
                    'notes': row[7],
                    'timestamp': row[8].isoformat() if row[8] else None,
                    'created_at': row[9].isoformat() if row[9] else None,
                    'type': 'speech'
                })

            return jsonify(entries)
        except OperationalError as e:
            logger.warning("Retrying speech entries fetch after OperationalError (attempt %d): %s", attempt + 1, e)
            time.sleep(0.6)
        except Exception as e:
            print(f"Error fetching speech entries: {e}")
            return jsonify({'error': str(e)}), 500
        finally:
            if client is not None:
                client.close()

    return jsonify({'error': 'Failed to fetch speech entries after retry'}), 500


def parse_local_timestamp(value: Optional[str]) -> datetime:
    if not value:
        return datetime.now(LOCAL_TIMEZONE)
    dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
    if dt.tzinfo is None:
        return LOCAL_TIMEZONE.localize(dt)
    return dt.astimezone(LOCAL_TIMEZONE)


@app.route('/api/speech_entries', methods=['POST'])
def create_speech_entry():
    client = None
    try:
        data = request.get_json() or {}
        object_key = data.get('object_key')
        if not object_key:
            return jsonify({'error': 'object_key is required'}), 400

        timestamp = parse_local_timestamp(data.get('timestamp'))
        client = get_db_connection()
        entry_id = get_next_id(client)
        
        transcription = data.get('transcription')

        client.insert('speech_entries', [[
            entry_id,
            object_key,
            data.get('audio_url'),
            transcription,
            data.get('category'),
            data.get('mode'),
            data.get('duration_ms'),
            data.get('notes'),
            timestamp,
            datetime.now(LOCAL_TIMEZONE)
        ]], column_names=[
            'id', 'object_key', 'audio_url', 'transcription', 'category', 'mode',
            'duration_ms', 'notes', 'timestamp', 'created_at'
        ])
        
        # Trigger async categorization if transcription is available
        if transcription and speech_processor:
            speech_processor.submit_task(
                entry_id=entry_id,
                object_key=object_key,
                transcription=transcription,
                callback=update_speech_entry_category,
                mapping_callback=create_entry_from_mapping,
                enable_mapping=True
            )
            logger.info(f"Submitted categorization and mapping task for new entry {entry_id}")

        return jsonify({
            'id': entry_id,
            'object_key': object_key,
            'audio_url': data.get('audio_url'),
            'transcription': transcription,
            'category': data.get('category'),
            'mode': data.get('mode'),
            'duration_ms': data.get('duration_ms'),
            'notes': data.get('notes'),
            'timestamp': timestamp.isoformat(),
            'created_at': datetime.now(LOCAL_TIMEZONE).isoformat(),
            'type': 'speech'
        })
    except Exception as e:
        print(f"Error creating speech entry: {e}")
        return jsonify({'error': 'Failed to create speech entry'}), 500
    finally:
        if client is not None:
            client.close()


@app.route('/api/speech_entries/<int:entry_id>/retranscribe', methods=['POST'])
def retranscribe_speech_entry(entry_id):
    """Re-trigger transcription for an existing entry and update the database."""
    client = None
    try:
        client = get_db_connection()
        # Fetch existing entry to get object_key
        result = client.query(
            'SELECT object_key FROM speech_entries WHERE id = %(id)s LIMIT 1',
            parameters={'id': entry_id}
        )
        if not result.result_rows:
            return jsonify({'error': 'Speech entry not found'}), 404
        
        object_key = result.result_rows[0][0]
        if not object_key:
            return jsonify({'error': 'No audio file associated with this entry'}), 400
            
        logger.info(f"Re-triggering transcription for entry {entry_id} (key: {object_key})")
        
        # 1. Call transcription service
        transcript = stt_service.transcribe_object(object_key)
        if not transcript:
            return jsonify({'error': 'Transcription failed'}), 500
            
        # 2. Update database
        # We use ALTER TABLE ... UPDATE for simple field updates in ClickHouse
        client.command('''
            ALTER TABLE speech_entries 
            UPDATE transcription = %(t)s 
            WHERE id = %(id)s 
            SETTINGS mutations_sync=%(sync)s
        ''', parameters={
            't': transcript, 
            'id': entry_id, 
            'sync': MUTATIONS_SYNC_LEVEL
        })
        
        # 3. Trigger async categorization with the new transcript
        if speech_processor:
            speech_processor.submit_task(
                entry_id=entry_id,
                object_key=object_key,
                transcription=transcript,
                callback=update_speech_entry_category,
                mapping_callback=create_entry_from_mapping,
                enable_mapping=True
            )
            logger.info(f"Submitted re-categorization and mapping task for entry {entry_id}")
        
        return jsonify({
            'id': entry_id,
            'transcription': transcript,
            'status': 'success'
        })
    except Exception as e:
        logger.error(f"Error re-transcribing entry {entry_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()


@app.route('/api/speech_entries/<int:entry_id>', methods=['PUT'])
def update_speech_entry(entry_id):
    client = None
    try:
        data = request.get_json() or {}
        client = get_db_connection()

        # Fetch existing entry
        result = client.query('SELECT * FROM speech_entries WHERE id = %(id)s LIMIT 1', parameters={'id': entry_id})
        if not result.result_rows:
            return jsonify({'error': 'Speech entry not found'}), 404
        existing = result.result_rows[0]

        updated = {
            'id': existing[0],
            'object_key': data.get('object_key', existing[1]),
            'audio_url': data.get('audio_url', existing[2]),
            'transcription': data.get('transcription', existing[3]),
            'category': data.get('category', existing[4]),
            'mode': data.get('mode', existing[5]),
            'duration_ms': data.get('duration_ms', existing[6]),
            'notes': data.get('notes', existing[7]),
            'timestamp': parse_local_timestamp(data.get('timestamp')) if data.get('timestamp') else existing[8],
            'created_at': existing[9]
        }

        client.command('''
            ALTER TABLE speech_entries DELETE WHERE id = %(id)s SETTINGS mutations_sync=%(sync)s
        ''', parameters={'id': entry_id, 'sync': MUTATIONS_SYNC_LEVEL})

        client.insert('speech_entries', [[
            updated['id'], updated['object_key'], updated['audio_url'], updated['transcription'],
            updated['category'], updated['mode'], updated['duration_ms'], updated['notes'],
            updated['timestamp'], updated['created_at']
        ]], column_names=[
            'id', 'object_key', 'audio_url', 'transcription', 'category', 'mode',
            'duration_ms', 'notes', 'timestamp', 'created_at'
        ])

        return jsonify({
            **updated,
            'timestamp': updated['timestamp'].isoformat() if hasattr(updated['timestamp'], 'isoformat') else updated['timestamp'],
            'created_at': updated['created_at'].isoformat() if hasattr(updated['created_at'], 'isoformat') else updated['created_at'],
            'type': 'speech'
        })
    except Exception as e:
        print(f"Error updating speech entry: {e}")
        return jsonify({'error': 'Failed to update speech entry'}), 500
    finally:
        if client is not None:
            client.close()


@app.route('/api/speech_entries/<int:entry_id>', methods=['DELETE'])
def delete_speech_entry(entry_id):
    client = None
    try:
        client = get_db_connection()
        client.command(
            'ALTER TABLE speech_entries DELETE WHERE id = %(id)s SETTINGS mutations_sync=%(sync)s',
            parameters={'id': entry_id, 'sync': MUTATIONS_SYNC_LEVEL}
        )
        return jsonify({'status': 'deleted'})
    except Exception as e:
        print(f"Error deleting speech entry: {e}")
        return jsonify({'error': 'Failed to delete speech entry'}), 500
    finally:
        if client is not None:
            client.close()

@app.route('/api/entries', methods=['POST'])
def create_entry():
    """Create a new entry"""
    client = None
    try:
        data = request.json
        
        client = get_db_connection()
        entry_id = get_next_id(client)
        
        # Parse timestamp and ensure it's timezone-aware
        timestamp = data.get('timestamp')
        if timestamp:
            if isinstance(timestamp, str):
                # Parse ISO format and convert to local timezone
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    timestamp = LOCAL_TIMEZONE.localize(dt)
                else:
                    timestamp = dt.astimezone(LOCAL_TIMEZONE)
            elif isinstance(timestamp, datetime):
                if timestamp.tzinfo is None:
                    timestamp = LOCAL_TIMEZONE.localize(timestamp)
                else:
                    timestamp = timestamp.astimezone(LOCAL_TIMEZONE)
        else:
            timestamp = datetime.now(LOCAL_TIMEZONE)
        
        # Insert into ClickHouse
        client.insert('entries', [[
            entry_id,
            data.get('temperature'),
            data.get('feed_amount'),
            data.get('feed_type'),
            data.get('susu_count', 0),
            data.get('poti_count', 0),
            data.get('poti_color'),
            data.get('weight'),
            data.get('notes'),
            timestamp,
            datetime.now(LOCAL_TIMEZONE)
        ]], column_names=ENTRY_COLUMNS)
        
        return jsonify({'id': entry_id, 'message': 'Entry created successfully'}), 201
    except Exception as e:
        print(f"Error creating entry: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()

@app.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    """Update a specific entry - uses backup-before-delete pattern with automatic rollback for data safety"""
    client = None
    backup_id = None
    try:
        data = request.get_json()
        client = get_db_connection()
        
        # First, fetch the existing entry
        try:
            result = client.query('SELECT * FROM entries WHERE id = %(id)s', parameters={'id': entry_id})
        except Exception as db_error:
            print(f"Database error while fetching entry: {db_error}")
            return jsonify({'error': 'Database error occurred while fetching entry'}), 500
        
        if not result.result_rows:
            return jsonify({'error': 'Entry not found'}), 404
        
        existing = result.result_rows[0]
        
        # Prepare updated values (use existing if not provided)
        updated_id = existing[0]
        updated_temp = data.get('temperature', float(existing[1]) if existing[1] is not None else None)
        updated_feed_amount = data.get('feed_amount', existing[2])
        updated_feed_type = data.get('feed_type', existing[3])
        updated_susu = data.get('susu_count', existing[4])
        updated_poti = data.get('poti_count', existing[5])
        updated_poti_color = data.get('poti_color', existing[6])
        updated_weight = data.get('weight', existing[7])
        updated_notes = data.get('notes', existing[8])
        
        # Handle timestamp
        if 'timestamp' in data:
            timestamp = data['timestamp']
            if isinstance(timestamp, str):
                dt = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                if dt.tzinfo is None:
                    updated_timestamp = LOCAL_TIMEZONE.localize(dt)
                else:
                    updated_timestamp = dt.astimezone(LOCAL_TIMEZONE)
            elif isinstance(timestamp, datetime):
                if timestamp.tzinfo is None:
                    updated_timestamp = LOCAL_TIMEZONE.localize(timestamp)
                else:
                    updated_timestamp = timestamp.astimezone(LOCAL_TIMEZONE)
            else:
                updated_timestamp = existing[9]
        else:
            updated_timestamp = existing[9]
        
        updated_created_at = existing[10]
        
        # STEP 1: Backup the original entry before making any changes
        # The backup_id uniquely identifies this backup to prevent race conditions
        print(f"Creating backup for entry {entry_id} before update")
        backup_id = backup_entry(client, existing, entry_id)
        if not backup_id:
            return jsonify({'error': 'Failed to create backup before update'}), 500
        
        # STEP 2: Delete the old entry
        # Note: We must delete before inserting because the ID is part of the primary key
        # and ClickHouse doesn't allow duplicate primary keys. However, we have a backup
        # ready for rollback if the subsequent insert fails.
        try:
            # Wait for mutation to finish so we can safely insert updated row
            client.command(
                f'ALTER TABLE entries DELETE WHERE id = %(id)s SETTINGS mutations_sync={MUTATIONS_SYNC_LEVEL}',
                parameters={'id': entry_id}
            )
        except Exception as delete_error:
            print(f"Error executing DELETE mutation: {delete_error}")
            # Cleanup backup since we didn't proceed with deletion
            try:
                client.command(
                    f'ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s SETTINGS mutations_sync={MUTATIONS_SYNC_LEVEL}',
                    parameters={'backup_id': backup_id}
                )
            except Exception as cleanup_error:
                print(f"Warning: Failed to cleanup backup after delete failure: {cleanup_error}")
            return jsonify({'error': 'Failed to delete old entry'}), 500
        
        # STEP 3: Insert the updated entry
        try:
            client.insert('entries', [[
                updated_id,
                updated_temp,
                updated_feed_amount,
                updated_feed_type,
                updated_susu,
                updated_poti,
                updated_poti_color,
                updated_weight,
                updated_notes,
                updated_timestamp,
                updated_created_at
            ]], column_names=ENTRY_COLUMNS)
            print(f"Successfully inserted updated entry {entry_id}")
        except Exception as insert_error:
            print(f"Error inserting updated entry: {insert_error}. Attempting rollback from backup.")
            # ROLLBACK: Restore the original entry from backup using the specific backup_id
            if restore_entry_from_backup(client, entry_id, backup_id):
                # Cleanup backup after successful rollback to avoid orphaned backup entries
                try:
                    client.command(
                        f'ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s SETTINGS mutations_sync={MUTATIONS_SYNC_LEVEL}',
                        parameters={'backup_id': backup_id}
                    )
                    print(f"Backup cleanup successful after rollback for entry {entry_id}")
                except Exception as cleanup_error:
                    # If cleanup fails, the backup will remain until TTL expires (1 day)
                    print(f"Warning: Failed to cleanup backup after rollback for entry {entry_id}: {cleanup_error}")
                    print(f"The backup will be automatically deleted by TTL after 1 day")
                return jsonify({'error': 'Failed to insert updated entry. Original entry restored from backup.'}), 409
            else:
                # CRITICAL: Both insert and rollback failed. Do NOT delete the backup here.
                # The backup row in entries_backup is intentionally retained so that an
                # administrator can manually restore the original entry using backup_id.
                print(
                    f"CRITICAL: Failed to insert updated entry and rollback failed for entry {entry_id}. "
                    f"Backup retained with backup_id={backup_id} for manual recovery."
                )
                return jsonify({
                    'error': 'CRITICAL: Failed to insert updated entry and rollback failed. '
                             'Original entry may be missing, but a backup has been retained for manual recovery.',
                    'entry_id': entry_id,
                    'backup_id': backup_id
                }), 500
        
        # STEP 4: Clean up the backup entry after successful update
        try:
            client.command(
                f'ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s SETTINGS mutations_sync={MUTATIONS_SYNC_LEVEL}',
                parameters={'backup_id': backup_id}
            )
            print(f"Backup cleanup successful for entry {entry_id}")
        except Exception as cleanup_error:
            # Non-critical error - the update succeeded
            # If cleanup fails, the backup will remain in the database until TTL expires (1 day)
            # This is acceptable because: 1) The update was successful, 2) TTL will auto-delete the backup
            print(f"Warning: Failed to cleanup backup for entry {entry_id}: {cleanup_error}")
            print(f"The backup will be automatically deleted by TTL after 1 day")
        
        return jsonify({'message': 'Entry updated successfully'}), 200
    except Exception as e:
        print(f"Error updating entry: {e}")
        import traceback
        traceback.print_exc()
        
        # Attempt to clean up backup if one was created
        if backup_id and client is not None:
            try:
                print(f"Attempting to cleanup backup for entry {entry_id} after unexpected error")
                client.command(
                    f'ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s SETTINGS mutations_sync={MUTATIONS_SYNC_LEVEL}',
                    parameters={'backup_id': backup_id}
                )
                print(f"Backup cleanup successful after error for entry {entry_id}")
            except Exception as cleanup_error:
                # If cleanup fails, the backup will remain until TTL expires (1 day)
                print(f"Warning: Failed to cleanup backup after error for entry {entry_id}: {cleanup_error}")
                print(f"The backup will be automatically deleted by TTL after 1 day")
        
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()

@app.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    """Delete a specific entry"""
    client = None
    try:
        client = get_db_connection()
        
        # Check if entry exists before attempting deletion
        if not entry_exists(client, entry_id):
            return jsonify({'error': 'Entry not found'}), 404
        
        # ClickHouse uses ALTER TABLE DELETE for deletes
        client.command(
            f'ALTER TABLE entries DELETE WHERE id = %(id)s SETTINGS mutations_sync={MUTATIONS_SYNC_LEVEL}',
            parameters={'id': entry_id}
        )
        
        return jsonify({'message': 'Entry deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting entry: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()

@app.route('/api/entries', methods=['DELETE'])
def delete_all_entries():
    """Delete all entries - requires confirmation header for safety"""
    # Safety check: require special confirmation header
    confirmation_header = request.headers.get('X-Confirm-Delete-All')
    if confirmation_header != 'I-understand-this-is-permanent':
        return jsonify({
            'error': 'Confirmation required',
            'message': 'To delete all entries, include header: X-Confirm-Delete-All: I-understand-this-is-permanent'
        }), 400
    
    client = None
    try:
        client = get_db_connection()
        
        # Truncate table in ClickHouse
        client.command('TRUNCATE TABLE entries')
        
        return jsonify({'message': 'All entries deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting entries: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get daily statistics"""
    client = None
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        client = get_db_connection()
        
        # Get daily stats
        query = '''
            SELECT 
                countIf(feed_amount > 0) as feed_count,
                sum(feed_amount) as total_feed_volume,
                round(avgIf(feed_amount, feed_amount > 0), 0) as avg_feed_amount,
                sum(susu_count) as total_susu,
                sum(poti_count) as total_poti,
                round(avg(temperature), 1) as avg_temperature,
                max(temperature) as max_temperature,
                min(temperature) as min_temperature,
                argMax(weight, timestamp) as latest_weight
            FROM entries
            WHERE toDate(timestamp) = toDate(%(date)s)
        '''
        
        result = client.query(query, parameters={'date': date})
        
        if result.result_rows:
            row = result.result_rows[0]
            stats = {
                'feed_count': row[0],
                'total_feed_volume': row[1] or 0,
                'avg_feed_amount': row[2],
                'total_susu': row[3] or 0,
                'total_poti': row[4] or 0,
                'avg_temperature': float(row[5]) if row[5] is not None else None,
                'max_temperature': float(row[6]) if row[6] is not None else None,
                'min_temperature': float(row[7]) if row[7] is not None else None,
                'latest_weight': row[8]
            }
        else:
            stats = {}
        
        return jsonify(stats)
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    client = None
    try:
        client = get_db_connection()
        client.query('SELECT 1')
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500
    finally:
        if client is not None:
            client.close()

if __name__ == '__main__':
    import atexit
    import signal
    
    # Register cleanup handler for graceful shutdown
    def cleanup():
        '''Clean up resources on shutdown.'''
        if speech_processor:
            logger.info('Shutting down categorization processor...')
            speech_processor.stop()
    
    atexit.register(cleanup)
    signal.signal(signal.SIGTERM, lambda sig, frame: cleanup())
    signal.signal(signal.SIGINT, lambda sig, frame: cleanup())
    
    use_https = os.environ.get('ENABLE_HTTPS', 'false').lower() == 'true'
    ssl_context = None

    if use_https:
        if os.path.exists('cert.pem') and os.path.exists('key.pem'):
            ssl_context = ('cert.pem', 'key.pem')
            print("\n" + "="*50)
            print("Running with STATIC self-signed HTTPS certificates.")
            print("="*50 + "\n")
        else:
            ssl_context = 'adhoc'
            print("\n" + "="*50)
            print("WARNING: Running with AD-HOC self-signed HTTPS certificate.")
            print("You must accept the security warning in your browser.")
            print("="*50 + "\n")
    
    app.run(host='0.0.0.0', port=5000, debug=True, ssl_context=ssl_context)
