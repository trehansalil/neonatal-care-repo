from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import clickhouse_connect
from datetime import datetime
import os
import time
import pytz

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
    """Get the next ID for entries table"""
    result = client.query('SELECT MAX(id) as max_id FROM entries')
    max_id = result.result_rows[0][0] if result.result_rows and result.result_rows[0][0] else 0
    return (max_id or 0) + 1

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
        
        client.close()
        return jsonify(entries)
    except Exception as e:
        print(f"Error fetching entries: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries', methods=['POST'])
def create_entry():
    """Create a new entry"""
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
        ]], column_names=[
            'id', 'temperature', 'feed_amount', 'feed_type',
            'susu_count', 'poti_count', 'poti_color', 'weight',
            'notes', 'timestamp', 'created_at'
        ])
        
        client.close()
        return jsonify({'id': entry_id, 'message': 'Entry created successfully'}), 201
    except Exception as e:
        print(f"Error creating entry: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries/<int:entry_id>', methods=['PUT'])
def update_entry(entry_id):
    """Update a specific entry - uses delete + insert pattern for ClickHouse"""
    try:
        data = request.get_json()
        client = get_db_connection()
        
        # First, fetch the existing entry
        try:
            result = client.query('SELECT * FROM entries WHERE id = %(id)s', parameters={'id': entry_id})
        except Exception as db_error:
            client.close()
            print(f"Database error while fetching entry: {db_error}")
            return jsonify({'error': 'Database error occurred while fetching entry'}), 500
        
        if not result.result_rows:
            client.close()
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
        
        # Delete the old entry
        client.command('ALTER TABLE entries DELETE WHERE id = %(id)s', parameters={'id': entry_id})
        
        # Wait briefly for the mutation to be processed
        time.sleep(0.1)
        
        # Insert the updated entry
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
        ]], column_names=[
            'id', 'temperature', 'feed_amount', 'feed_type',
            'susu_count', 'poti_count', 'poti_color', 'weight',
            'notes', 'timestamp', 'created_at'
        ])
        
        client.close()
        return jsonify({'message': 'Entry updated successfully'}), 200
    except Exception as e:
        print(f"Error updating entry: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    """Delete a specific entry"""
    try:
        client = get_db_connection()
        
        # ClickHouse uses ALTER TABLE DELETE for deletes
        client.command('ALTER TABLE entries DELETE WHERE id = %(id)s', parameters={'id': entry_id})
        
        client.close()
        return jsonify({'message': 'Entry deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting entry: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries', methods=['DELETE'])
def delete_all_entries():
    """Delete all entries"""
    try:
        client = get_db_connection()
        
        # Truncate table in ClickHouse
        client.command('TRUNCATE TABLE entries')
        
        client.close()
        return jsonify({'message': 'All entries deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting entries: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get daily statistics"""
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
        
        client.close()
        return jsonify(stats)
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        client = get_db_connection()
        result = client.query('SELECT 1')
        client.close()
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
