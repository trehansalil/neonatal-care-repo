#!/bin/bash
# Start the native Mac transcription server

echo "Starting Native Mac Transcription Server..."
echo "Make sure mlx-whisper is installed: pip install mlx-whisper"
echo ""

# Set MinIO to localhost (host port mapping)
export HOST_MINIO_ENDPOINT="localhost:9002"

# Run the transcription server using Gunicorn (production WSGI server)
# We use 1 worker because MLX Whisper is memory/compute intensive on the GPU
echo "Starting Gunicorn on port 8083..."
uv run gunicorn \
    --workers 1 \
    --bind 0.0.0.0:8083 \
    --timeout 300 \
    transcription_server:app > transcription_server.log 2>&1 &

echo "Transcription server is running in the background (PID: $!)."
echo "Logs are being written to transcription_server.log"

