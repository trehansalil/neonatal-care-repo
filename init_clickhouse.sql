-- Initialize the baby tracker database in ClickHouse
-- NOTE: The application (app.py) will automatically create these tables with the correct
-- schema including timezone-aware DateTime64 types. This file is primarily for reference
-- and manual database initialization if needed.

-- Create database
CREATE DATABASE IF NOT EXISTS baby_tracker;

-- Use the database
USE baby_tracker;

-- Create entries table using MergeTree engine for optimal performance
-- Note: If used manually, replace 'Asia/Kolkata' with your timezone (app.py uses LOCAL_TIMEZONE)
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
    timestamp DateTime64(3, 'Asia/Kolkata') DEFAULT now64(3, 'Asia/Kolkata'),
    created_at DateTime64(3, 'Asia/Kolkata') DEFAULT now64(3, 'Asia/Kolkata')
) ENGINE = MergeTree()
ORDER BY (timestamp, id)
PRIMARY KEY (timestamp, id)
PARTITION BY toYYYYMM(timestamp)
SETTINGS index_granularity = 8192;

-- Create backup table for update rollback support
-- This matches the entries table structure for proper data type compatibility
-- Note: If used manually, replace 'Asia/Kolkata' with your timezone (app.py uses LOCAL_TIMEZONE)
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
    timestamp DateTime64(3, 'Asia/Kolkata') DEFAULT now64(3, 'Asia/Kolkata'),
    created_at DateTime64(3, 'Asia/Kolkata') DEFAULT now64(3, 'Asia/Kolkata'),
    backup_timestamp DateTime64(3, 'Asia/Kolkata') DEFAULT now64(3, 'Asia/Kolkata'),
    backup_id String DEFAULT generateUUIDv4()
) ENGINE = MergeTree()
ORDER BY (id, backup_timestamp, backup_id)
PRIMARY KEY (id, backup_timestamp, backup_id)
SETTINGS index_granularity = 8192;

-- Note: IDs are not auto-incremented in ClickHouse; the application layer must provide unique IDs
