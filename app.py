from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import os
import time

app = Flask(__name__, static_folder='html', static_url_path='')
CORS(app)

# Database configuration
DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'db'),
    'database': os.environ.get('DB_NAME', 'baby_tracker'),
    'user': os.environ.get('DB_USER', 'postgres'),
    'password': os.environ.get('DB_PASSWORD', 'postgres'),
    'port': os.environ.get('DB_PORT', '5432')
}

def get_db_connection():
    """Create a database connection with retry logic"""
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            conn = psycopg2.connect(**DB_CONFIG, cursor_factory=RealDictCursor)
            return conn
        except psycopg2.OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Database connection attempt {attempt + 1} failed. Retrying in {retry_delay}s...")
                time.sleep(retry_delay)
            else:
                print(f"Failed to connect to database after {max_retries} attempts")
                raise

def init_db():
    """Initialize database tables"""
    conn = get_db_connection()
    cur = conn.cursor()
    
    cur.execute('''
        CREATE TABLE IF NOT EXISTS entries (
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
        )
    ''')
    
    conn.commit()
    cur.close()
    conn.close()
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
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Optional date filter
        date_filter = request.args.get('date')
        if date_filter:
            cur.execute(
                'SELECT * FROM entries WHERE DATE(timestamp) = %s ORDER BY timestamp DESC',
                (date_filter,)
            )
        else:
            # Get last 100 entries
            cur.execute('SELECT * FROM entries ORDER BY timestamp DESC LIMIT 100')
        
        entries = cur.fetchall()
        cur.close()
        conn.close()
        
        return jsonify(entries)
    except Exception as e:
        print(f"Error fetching entries: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries', methods=['POST'])
def create_entry():
    """Create a new entry"""
    try:
        data = request.json
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('''
            INSERT INTO entries (
                temperature, feed_amount, feed_type, 
                susu_count, poti_count, poti_color, 
                notes, timestamp
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            data.get('temperature'),
            data.get('feed_amount'),
            data.get('feed_type'),
            data.get('susu_count', 0),
            data.get('poti_count', 0),
            data.get('poti_color'),
            data.get('notes'),
            data.get('timestamp', datetime.now())
        ))
        
        entry_id = cur.fetchone()['id']
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'id': entry_id, 'message': 'Entry created successfully'}), 201
    except Exception as e:
        print(f"Error creating entry: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries/<int:entry_id>', methods=['DELETE'])
def delete_entry(entry_id):
    """Delete a specific entry"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('DELETE FROM entries WHERE id = %s', (entry_id,))
        
        if cur.rowcount == 0:
            cur.close()
            conn.close()
            return jsonify({'error': 'Entry not found'}), 404
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': 'Entry deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting entry: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/entries', methods=['DELETE'])
def delete_all_entries():
    """Delete all entries"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute('DELETE FROM entries')
        deleted_count = cur.rowcount
        
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({'message': f'{deleted_count} entries deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting entries: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Get daily statistics"""
    try:
        date = request.args.get('date', datetime.now().strftime('%Y-%m-%d'))
        
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Get daily stats
        cur.execute('''
            SELECT 
                COUNT(CASE WHEN feed_amount > 0 THEN 1 END) as feed_count,
                COALESCE(SUM(feed_amount), 0) as total_feed_volume,
                COALESCE(SUM(susu_count), 0) as total_susu,
                COALESCE(SUM(poti_count), 0) as total_poti,
                ROUND(AVG(temperature)::numeric, 1) as avg_temperature,
                MAX(temperature) as max_temperature,
                MIN(temperature) as min_temperature
            FROM entries
            WHERE DATE(timestamp) = %s
        ''', (date,))
        
        stats = cur.fetchone()
        cur.close()
        conn.close()
        
        return jsonify(stats)
    except Exception as e:
        print(f"Error fetching stats: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute('SELECT 1')
        cur.close()
        conn.close()
        return jsonify({'status': 'healthy', 'database': 'connected'}), 200
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
