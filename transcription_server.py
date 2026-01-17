#!/usr/bin/env python3
"""
Native Mac Transcription Server

Runs MLX Whisper transcription on the host Mac (Apple Silicon required).
The Dockerized backend calls this service via host.docker.internal.
"""

import os

# Set MinIO endpoint for host BEFORE importing services
os.environ.setdefault('MINIO_ENDPOINT', os.environ.get('HOST_MINIO_ENDPOINT', 'localhost:9002'))

from flask import Flask, request, jsonify
from src.settings import get_settings
from src.services.s3_compatible_service import S3StorageService

app = Flask(__name__)
settings = get_settings()

# Create S3 client with host-accessible endpoint
s3_storage = S3StorageService(
    endpoint_url=settings.minio_endpoint,
    access_key=settings.minio_access_key,
    secret_key=settings.minio_secret_key,
    bucket_name=settings.minio_bucket_name,
    secure=settings.minio_secure
)


def transcribe_file_mlx(local_path: str) -> str:
    """Run MLX Whisper transcription on the host Mac."""
    try:
        import mlx_whisper

        print(f"Transcribing {local_path} with MLX Whisper...")
        result = mlx_whisper.transcribe(
            local_path,
            path_or_hf_repo="mlx-community/whisper-large-v3-mlx"
        )
        transcript = result.get("text", "") if isinstance(result, dict) else ""
        print(f"Transcription complete: {len(transcript)} chars")
        return transcript
    except Exception as e:
        print(f"MLX transcription error: {e}")
        return ""

def transcribe_file_mlx_asr(local_path: str) -> str:
    try:
        from mlx_audio.stt.utils import load_model
        from mlx_audio.stt.generate import generate_transcription
        model = load_model("mlx-community/whisper-large-v2-asr-fp16")
        transcription = generate_transcription(
            model=model,
            audio_path=local_path,
            output_path="path_to_output.txt",
            format="txt",
            verbose=True,
        )
        return transcription.text
    except Exception as e:
        print(f"MLX transcription error: {e}")
        return ""

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint."""
    return jsonify({'status': 'healthy', 'service': 'transcription-server'}), 200


@app.route('/transcribe', methods=['POST'])
def transcribe():
    """
    Transcribe audio from MinIO storage.
    
    Request JSON:
        {
            "object_key": "speech/20260111/speech_abc123.webm",
            "bucket": "neonatal-data"  # optional
        }
    
    Response JSON:
        {
            "object_key": "...",
            "transcript": "..."
        }
    """
    data = request.get_json()
    if not data or 'object_key' not in data:
        return jsonify({'error': 'object_key is required'}), 400
    
    object_key = data['object_key']
    bucket = data.get('bucket', settings.minio_bucket_name)
    
    tmp_path = None
    try:
        print(f"Downloading {object_key} from bucket {bucket}...")
        tmp_path = s3_storage.download_to_tmp(object_name=object_key, container=bucket)
        
        transcript = transcribe_file_mlx(tmp_path)
        
        if not transcript:
            return jsonify({'error': 'Transcription returned empty result'}), 500
            
        return jsonify({
            'object_key': object_key,
            'transcript': transcript
        }), 200
        
    except Exception as e:
        print(f"Transcription error: {e}")
        return jsonify({'error': str(e)}), 500
        
    finally:
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass


if __name__ == '__main__':
    print("="*60)
    print("Native Mac Transcription Server")
    print("="*60)
    print(f"MinIO Endpoint: {settings.minio_endpoint}")
    print(f"Bucket: {settings.minio_bucket_name}")
    print("Starting server on http://0.0.0.0:8083")
    print("Backend can reach this via http://host.docker.internal:8083")
    print("="*60)
    
    app.run(host='0.0.0.0', port=8083, debug=False)
