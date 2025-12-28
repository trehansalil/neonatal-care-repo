-- Initialize the baby tracker database in ClickHouse
-- Create database
CREATE DATABASE IF NOT EXISTS baby_tracker;

-- Use the database
USE baby_tracker;

-- Create entries table using MergeTree engine for optimal performance
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
    timestamp DateTime DEFAULT now(),
    created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (timestamp, id)
PRIMARY KEY (timestamp, id)
PARTITION BY toYYYYMM(timestamp)
SETTINGS index_granularity = 8192;

-- Create a sequence for auto-incrementing IDs
-- Note: ClickHouse doesn't have native sequences, so we'll handle this in the application layer
