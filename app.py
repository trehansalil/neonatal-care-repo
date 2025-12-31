from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import clickhouse_connect
from datetime import datetime
import os
import time
import pytz
import uuid

app = Flask(__name__, static_folder='html', static_url_path='')
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'clickhouse'),
    'port': int(os.environ.get('DB_PORT', '8123')),
    'database': os.environ.get('DB_NAME', 'baby_tracker'),
    'username': os.environ.get('DB_USER', 'clickhouse'),
    'password': os.environ.get('DB_PASSWORD', 'clickhouse')
}

# Timezone configuration - set your local timezone
LOCAL_TIMEZONE = pytz.timezone(os.environ.get('TZ', 'Asia/Kolkata'))  # Default to IST

# Mutation verification configuration
MUTATION_VERIFICATION_MAX_RETRIES = int(os.environ.get('MUTATION_VERIFICATION_MAX_RETRIES', '10'))
MUTATION_VERIFICATION_RETRY_DELAY = float(os.environ.get('MUTATION_VERIFICATION_RETRY_DELAY', '0.1'))  # seconds

# Column names for entries table (used in insert operations)
ENTRY_COLUMNS = [
    'id', 'temperature', 'feed_amount', 'feed_type',
    'susu_count', 'poti_count', 'poti_color', 'weight',
    'notes', 'timestamp', 'created_at'
]

def get_db_connection():
    """Create a database connection with retry logic"""
    max_retries = 5
    retry_delay = 2
    
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
    while True:
        result = client.query(
            'SELECT cityHash64(generateUUIDv4()) % 4294967295 AS new_id'
        )
        new_id = result.result_rows[0][0]
        if not entry_exists(client, new_id):
            return new_id

def entry_exists(client, entry_id):
    """Check if an entry exists in the database"""
    result = client.query('SELECT 1 FROM entries WHERE id = %(id)s LIMIT 1', parameters={'id': entry_id})
    return bool(result.result_rows)

def backup_entry(client, entry_data, entry_id):
    """
    Backup an entry to the entries_backup table before modification.
    
    Args:
        client: ClickHouse client connection
        entry_data: Row data from SELECT * FROM entries query
                   Expected column order: id, temperature, feed_amount, feed_type,
                   susu_count, poti_count, poti_color, weight, notes, timestamp, created_at
        entry_id: The ID of the entry being backed up
    
    Returns:
        str or None: The backup_id (UUID) if successful, None otherwise
    """
    try:
        # Generate a unique backup ID for this operation to prevent race conditions
        backup_id = str(uuid.uuid4())
        
        # Column order matches ENTRY_COLUMNS constant, plus backup_id
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
    
    # Create database
    client.command('CREATE DATABASE IF NOT EXISTS baby_tracker')
    client.close()
    
    # Now connect to the baby_tracker database
    client = get_db_connection()
    
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
            timestamp DateTime64(3, '{LOCAL_TIMEZONE.zone}'),
            created_at DateTime64(3, '{LOCAL_TIMEZONE.zone}') DEFAULT now64(3, '{LOCAL_TIMEZONE.zone}'),
            backup_timestamp DateTime64(3, '{LOCAL_TIMEZONE.zone}') DEFAULT now64(3, '{LOCAL_TIMEZONE.zone}'),
            backup_id String NOT NULL
        ) ENGINE = MergeTree()
        ORDER BY (id, backup_timestamp, backup_id)
        PRIMARY KEY (id, backup_timestamp, backup_id)
        TTL backup_timestamp + INTERVAL 1 DAY DELETE
        SETTINGS index_granularity = 8192
    ''')
    
    client.close()
    print("Database initialized successfully")

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

@app.route('/api/entries', methods=['GET'])
def get_entries():
    """Get all entries"""
    client = None
    try:
        client = get_db_connection()
        
        # Optional date filter
        date_filter = request.args.get('date')
        if date_filter:
            query = '''
                SELECT * FROM entries 
                WHERE toDate(timestamp) = toDate(%(date)s)
                ORDER BY timestamp DESC
            '''
            result = client.query(query, parameters={'date': date_filter})
        else:
            # Get last 100 entries
            query = 'SELECT * FROM entries ORDER BY timestamp DESC LIMIT 100'
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
    except Exception as e:
        print(f"Error fetching entries: {e}")
        return jsonify({'error': str(e)}), 500
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
            client.command('ALTER TABLE entries DELETE WHERE id = %(id)s', parameters={'id': entry_id})
        except Exception as delete_error:
            print(f"Error executing DELETE mutation: {delete_error}")
            # Cleanup backup since we didn't proceed with deletion
            try:
                client.command('ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s', parameters={'backup_id': backup_id})
            except Exception as cleanup_error:
                print(f"Warning: Failed to cleanup backup after delete failure: {cleanup_error}")
            return jsonify({'error': 'Failed to delete old entry'}), 500
        
        # Wait for the mutation to be processed and verify deletion
        deletion_verified = False
        
        for attempt in range(MUTATION_VERIFICATION_MAX_RETRIES):
            try:
                verify_result = client.query('SELECT COUNT(*) FROM entries WHERE id = %(id)s', parameters={'id': entry_id})
                count = verify_result.result_rows[0][0]
                if count == 0:
                    deletion_verified = True
                    break
            except Exception as verify_error:
                print(f"Error verifying deletion (attempt {attempt + 1}): {verify_error}")
            
            # Sleep before next retry
            time.sleep(MUTATION_VERIFICATION_RETRY_DELAY)
        
        if not deletion_verified:
            print(f"Deletion verification failed, attempting rollback for entry {entry_id}")
            # Attempt to restore from backup using the specific backup_id
            if restore_entry_from_backup(client, entry_id, backup_id):
                # Cleanup backup since rollback succeeded
                try:
                    client.command('ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s', parameters={'backup_id': backup_id})
                except Exception as cleanup_error:
                    print(f"Warning: Failed to cleanup backup after successful rollback: {cleanup_error}")
                return jsonify({'error': 'Failed to verify deletion of old entry. Original entry restored from backup.'}), 500
            else:
                return jsonify({'error': 'Failed to verify deletion of old entry. Rollback also failed.'}), 500
        
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
                    client.command('ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s', parameters={'backup_id': backup_id})
                    print(f"Backup cleanup successful after rollback for entry {entry_id}")
                except Exception as cleanup_error:
                    print(f"Warning: Failed to cleanup backup after rollback for entry {entry_id}: {cleanup_error}")
                return jsonify({'error': 'Failed to insert updated entry. Original entry restored from backup.'}), 500
            else:
                return jsonify({'error': 'CRITICAL: Failed to insert updated entry and rollback failed. Entry may be lost. Check backup table.'}), 500
        
        # STEP 4: Clean up the backup entry after successful update
        try:
            client.command('ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s', parameters={'backup_id': backup_id})
            print(f"Backup cleanup successful for entry {entry_id}")
        except Exception as cleanup_error:
            # Non-critical error - the update succeeded
            print(f"Warning: Failed to cleanup backup for entry {entry_id}: {cleanup_error}")
        
        return jsonify({'message': 'Entry updated successfully'}), 200
    except Exception as e:
        print(f"Error updating entry: {e}")
        import traceback
        traceback.print_exc()
        
        # Attempt to clean up backup if one was created
        if backup_id and client is not None:
            try:
                print(f"Attempting to cleanup backup for entry {entry_id} after unexpected error")
                client.command('ALTER TABLE entries_backup DELETE WHERE backup_id = %(backup_id)s', parameters={'backup_id': backup_id})
                print(f"Backup cleanup successful after error for entry {entry_id}")
            except Exception as cleanup_error:
                print(f"Warning: Failed to cleanup backup after error for entry {entry_id}: {cleanup_error}")
        
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
        client.command('ALTER TABLE entries DELETE WHERE id = %(id)s', parameters={'id': entry_id})
        
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
    app.run(host='0.0.0.0', port=5000, debug=True)
