#!/usr/bin/env python3
"""
Migration script to transfer data from PostgreSQL to ClickHouse
"""
import psycopg
import clickhouse_connect
from datetime import datetime
import os

# PostgreSQL configuration
PG_CONFIG = {
    'host': os.environ.get('PG_HOST', 'localhost'),
    'dbname': os.environ.get('PG_DB', 'baby_tracker'),
    'user': os.environ.get('PG_USER', 'postgres'),
    'password': os.environ.get('PG_PASSWORD', 'postgres'),
    'port': os.environ.get('PG_PORT', '5432')
}

# ClickHouse configuration
CH_CONFIG = {
    'host': os.environ.get('CH_HOST', 'localhost'),
    'port': int(os.environ.get('CH_PORT', '8123')),
    'database': os.environ.get('CH_DB', 'baby_tracker'),
    'username': os.environ.get('CH_USER', 'clickhouse'),
    'password': os.environ.get('CH_PASSWORD', 'clickhouse')
}

def migrate_data():
    """Migrate data from PostgreSQL to ClickHouse"""
    
    print("Starting migration from PostgreSQL to ClickHouse...")
    
    # Connect to PostgreSQL
    print(f"\nConnecting to PostgreSQL at {PG_CONFIG['host']}:{PG_CONFIG['port']}...")
    try:
        pg_conn = psycopg.connect(**PG_CONFIG)
        pg_cur = pg_conn.cursor()
        print("✓ Connected to PostgreSQL")
    except Exception as e:
        print(f"✗ Failed to connect to PostgreSQL: {e}")
        return
    
    # Connect to ClickHouse
    print(f"\nConnecting to ClickHouse at {CH_CONFIG['host']}:{CH_CONFIG['port']}...")
    try:
        ch_client = clickhouse_connect.get_client(**CH_CONFIG)
        print("✓ Connected to ClickHouse")
    except Exception as e:
        print(f"✗ Failed to connect to ClickHouse: {e}")
        pg_cur.close()
        pg_conn.close()
        return
    
    # Fetch data from PostgreSQL
    print("\nFetching data from PostgreSQL...")
    try:
        # First, get column information
        pg_cur.execute('''
            SELECT column_name, ordinal_position, data_type
            FROM information_schema.columns
            WHERE table_name = 'entries'
            ORDER BY ordinal_position
        ''')
        columns = pg_cur.fetchall()
        print(f"✓ PostgreSQL table schema:")
        for col in columns:
            print(f"  {col[1]}: {col[0]} ({col[2]})")
        
        # Fetch data with explicit column names
        pg_cur.execute('''
            SELECT id, temperature, feed_amount, feed_type, 
                   susu_count, poti_count, poti_color, weight,
                   notes, timestamp, created_at
            FROM entries
            ORDER BY id
        ''')
        rows = pg_cur.fetchall()
        print(f"✓ Found {len(rows)} entries to migrate")
    except Exception as e:
        print(f"✗ Failed to fetch data from PostgreSQL: {e}")
        import traceback
        traceback.print_exc()
        pg_cur.close()
        pg_conn.close()
        ch_client.close()
        return
    
    if len(rows) == 0:
        print("\nNo data to migrate.")
        pg_cur.close()
        pg_conn.close()
        ch_client.close()
        return
    
    # Insert data into ClickHouse
    print("\nInserting data into ClickHouse...")
    try:
        # Insert in batches
        batch_size = 100
        total_inserted = 0
        
        for i in range(0, len(rows), batch_size):
            batch_rows = rows[i:i+batch_size]
            
            # Prepare data for this batch
            batch_data = []
            for row in batch_rows:
                batch_data.append([
                    row[0],  # id
                    float(row[1]) if row[1] is not None else None,  # temperature
                    int(row[2]) if row[2] is not None else None,  # feed_amount
                    row[3],  # feed_type
                    int(row[4]) if row[4] is not None else 0,  # susu_count
                    int(row[5]) if row[5] is not None else 0,  # poti_count
                    row[6],  # poti_color
                    int(row[7]) if row[7] is not None else None,  # weight
                    row[8],  # notes
                    row[9],  # timestamp
                    row[10]  # created_at
                ])
            
            ch_client.insert('entries', batch_data, column_names=[
                'id', 'temperature', 'feed_amount', 'feed_type',
                'susu_count', 'poti_count', 'poti_color', 'weight',
                'notes', 'timestamp', 'created_at'
            ])
            total_inserted += len(batch_data)
            print(f"  Inserted {total_inserted}/{len(rows)} entries...")
        
        print(f"✓ Successfully migrated {total_inserted} entries")
        
    except Exception as e:
        print(f"✗ Failed to insert data into ClickHouse: {e}")
        import traceback
        traceback.print_exc()
        pg_cur.close()
        pg_conn.close()
        ch_client.close()
        return
    
    # Verify migration
    print("\nVerifying migration...")
    try:
        result = ch_client.query('SELECT COUNT(*) as count FROM entries')
        ch_count = result.result_rows[0][0]
        print(f"✓ ClickHouse now has {ch_count} entries")
        
        if ch_count == len(rows):
            print("\n✓ Migration completed successfully!")
        else:
            print(f"\n⚠ Warning: Expected {len(rows)} entries but found {ch_count}")
            
    except Exception as e:
        print(f"✗ Failed to verify migration: {e}")
    
    # Close connections
    pg_cur.close()
    pg_conn.close()
    ch_client.close()
    
    print("\nMigration script finished.")

if __name__ == '__main__':
    migrate_data()
