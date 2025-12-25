-- Initialize the baby tracker database
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
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_entries_timestamp ON entries(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_entries_date ON entries(DATE(timestamp));

-- Insert some sample data for testing (optional)
-- INSERT INTO entries (temperature, feed_amount, feed_type, susu_count, poti_count, poti_color, notes, timestamp)
-- VALUES 
--     (37.2, 60, 'bottle', 1, 0, NULL, 'Good feeding session', NOW() - INTERVAL '1 hour'),
--     (37.0, 55, 'breast', 0, 1, 'yellow', 'Normal stool', NOW() - INTERVAL '2 hours');
