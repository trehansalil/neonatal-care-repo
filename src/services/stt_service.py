"""Speech-to-text helpers built around mlx_whisper and S3 storage."""

import os
import tempfile
from typing import Optional


class STTService:
    def __init__(self, storage_client, bucket_name: str):
        """Create a service that can download audio from storage and transcribe it.

        Args:
            storage_client: Object that implements download_to_tmp(object_name, container)
            bucket_name: Bucket/container to pull audio from
        """
        self.storage = storage_client
        self.bucket = bucket_name

    def transcribe_object(self, object_key: str) -> str:
        """Download an object and transcribe it. Returns empty string on failure."""
        tmp_path = None
        try:
            tmp_path = self.storage.download_to_tmp(object_name=object_key, container=self.bucket)
            return self._transcribe_file(tmp_path)
        finally:
            self._cleanup_tmp(tmp_path)

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

    @staticmethod
    def _transcribe_file(local_path: str) -> str:
        """Run on-device Whisper transcription for a local audio file."""
        try:
            import mlx_whisper

            result = mlx_whisper.transcribe(
                local_path,
                path_or_hf_repo="mlx-community/whisper-large-v3-mlx"
            )
            return result.get("text", "") if isinstance(result, dict) else ""
        except Exception as exc:  # noqa: BLE001
            print(f"Transcription failed: {exc}")
            return ""

    @staticmethod
    def _cleanup_tmp(path: Optional[str]):
        if path and os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
