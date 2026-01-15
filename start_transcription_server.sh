#!/bin/bash
# Start the native Mac transcription server

echo "Starting Native Mac Transcription Server..."
echo "Make sure mlx-whisper is installed: pip install mlx-whisper"
echo ""

# Set MinIO to localhost (host port mapping)
export HOST_MINIO_ENDPOINT="localhost:9002"

# Run the transcription server
uv run python transcription_server.py > transcription_server.log 2>&1 &
