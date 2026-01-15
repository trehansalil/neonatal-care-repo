"""Speech-to-text helpers built around mlx_whisper and S3 storage."""

import os
import tempfile
import requests
from typing import Optional

from ..log import get_logger

logger = get_logger(__name__)
class STTService:
    def __init__(self, storage_client, bucket_name: str, transcription_url: Optional[str] = None):
        """Create a service that can download audio from storage and transcribe it.

        Args:
            storage_client: Object that implements download_to_tmp(object_name, container)
            bucket_name: Bucket/container to pull audio from
            transcription_url: URL of external transcription service (e.g., http://host.docker.internal:8083/transcribe)
                              If None, attempts local MLX transcription
        """
        self.storage = storage_client
        self.bucket = bucket_name
        self.transcription_url = transcription_url
        self._mlx_available = self._check_mlx_availability() if not transcription_url else False
        
    def _check_mlx_availability(self) -> bool:
        """Check if MLX is available (requires Apple Silicon macOS)."""
        try:
            import mlx_whisper  # noqa: F401
            logger.info("MLX Whisper is available for local transcription")
            return True
        except ImportError as e:
            logger.warning(f"MLX Whisper not available: {e}. Use external transcription service or expect placeholders.")
            return False

    def transcribe_object(self, object_key: str) -> str:
        """Download an object and transcribe it. Returns empty string on failure."""
        # Use external transcription service if configured
        if self.transcription_url:
            return self._transcribe_via_api(object_key)
        
        # Otherwise download and transcribe locally
        tmp_path = None
        try:
            logger.info(f"Starting transcription for {object_key}")
            tmp_path = self.storage.download_to_tmp(object_name=object_key, container=self.bucket)
            logger.info(f"File downloaded to {tmp_path}, starting transcription")
            result = self._transcribe_file(tmp_path)
            logger.info(f"Transcription complete, length: {len(result)} chars")
            return result
        except Exception as e:
            logger.error(f"Transcription failed for {object_key}: {e}", exc_info=True)
            raise
        finally:
            self._cleanup_tmp(tmp_path)

    def _transcribe_via_api(self, object_key: str) -> str:
        """Call external transcription service API."""
        try:
            logger.info(f"Calling transcription service at {self.transcription_url}")
            response = requests.post(
                self.transcription_url,
                json={'object_key': object_key, 'bucket': self.bucket},
                timeout=300  # 5 min timeout for long audio
            )
            response.raise_for_status()
            data = response.json()
            transcript = data.get('transcript', '')
            logger.info(f"API transcription complete: {len(transcript)} chars")
            return transcript
        except requests.exceptions.RequestException as e:
            logger.error(f"Transcription API error: {e}")
            raise RuntimeError(f"Transcription service unavailable: {e}") from e

    def transcribe_upload(self, file_storage) -> str:
        """Persist an uploaded FileStorage to tmp and transcribe it."""
        suffix = os.path.splitext(getattr(file_storage, 'filename', '') or '')[1] or '.webm'
        tmp_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
                file_storage.save(tmp.name)
                tmp_path = tmp.name
            return self._transcribe_file(tmp_path)
        finally:
            self._cleanup_tmp(tmp_path)

    def _transcribe_file(self, local_path: str) -> str:
        """Run on-device Whisper transcription for a local audio file."""
        if not self._mlx_available:
            logger.info("MLX not available, returning placeholder transcript")
            return "[Transcription unavailable - MLX requires Apple Silicon macOS. Audio saved to storage.]"
            
        try:
            import mlx_whisper

            result = mlx_whisper.transcribe(
                local_path,
                path_or_hf_repo="mlx-community/whisper-large-v3-mlx"
            )
            return result.get("text", "") if isinstance(result, dict) else ""
        except Exception as exc:  # noqa: BLE001
            logger.error(f"Transcription failed: {exc}")
            return "[Transcription error - see logs]"

    @staticmethod
    def _cleanup_tmp(path: Optional[str]):
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
