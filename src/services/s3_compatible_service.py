"""MinIO/S3 Compatible Object Storage Service

Provides document processing helpers on S3-compatible backends (MinIO).
- Multi-bucket operations (mapped from containers)
- In-memory uploads
- JSON download and temp legacy support
- Listing by prefix
- Presigned URLs for secure access
"""

import os
import json
from pathlib import Path
import tempfile
import re
from typing import Optional, List, Dict, Any
from datetime import datetime
import boto3
from botocore.client import Config
from botocore.exceptions import ClientError
from ..settings import get_settings

settings = get_settings()

def remove_consecutive_underscores(s: str) -> str:
    """Replace multiple consecutive underscores with a single underscore."""
    return re.sub(r'_+', '_', s)


class S3StorageService:
    """Service for S3/MinIO object storage operations."""
    
    def __init__(
        self,
        endpoint_url: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        bucket_name: Optional[str] = None,
        secure: Optional[bool] = None,
    ):

        self.endpoint_url = endpoint_url or settings.minio_endpoint
        secure = settings.minio_secure if secure is None else secure

        # Ensure http/https prefix based on the secure flag
        if self.endpoint_url and not self.endpoint_url.startswith("http"):
            protocol = "https" if secure else "http"
            self.endpoint_url = f"{protocol}://{self.endpoint_url}"

        self.access_key = access_key or settings.minio_access_key
        self.secret_key = secret_key or settings.minio_secret_key
        self.bucket_name = bucket_name or settings.minio_bucket_name

        self.s3_client = boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(
                signature_version="s3v4",
                s3={"addressing_style": "path"},  # MinIO prefers path-style addressing
            ),
            region_name="us-east-1",
            use_ssl=secure,
        )

        if self.bucket_name:
            self._ensure_bucket_exists(self.bucket_name)

    def _ensure_bucket_exists(self, bucket_name: str):
        try:
            self.s3_client.head_bucket(Bucket=bucket_name)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code in {"404", "NoSuchBucket", "NotFound"}:
                try:
                    self.s3_client.create_bucket(Bucket=bucket_name)
                except Exception:
                    # Bucket may have been created concurrently or user lacks perms; ignore.
                    pass
            # Other error codes (403, etc.) are ignored so caller can still proceed if bucket exists.

    def _sanitize_object_key(self, key: str) -> str:
        sanitized = key.replace(" ", "_")
        sanitized = remove_consecutive_underscores(sanitized)
        sanitized = sanitized.strip("_").strip()
        return sanitized

    def _get_bucket_and_key(self, container: Optional[str], object_name: str):
        bucket = container or self.bucket_name
        if not bucket:
            raise ValueError("No bucket/container specified.")
            
        if container and container != self.bucket_name:
            # On-demand bucket creation if a specific container is requested
            self._ensure_bucket_exists(bucket)
            
        return bucket, self._sanitize_object_key(object_name)

    # -----------------
    # File-path uploads
    # -----------------
    def upload_file(self, file_path: str, object_name: Optional[str] = None, overwrite: bool = True, container: Optional[str] = None, with_sas: bool = True) -> str:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"File not found: {file_path}")
        
        if not object_name:
            timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
            file_ext = os.path.splitext(file_path)[1]
            object_name = f"file_{timestamp}{file_ext}"
            
        bucket, key = self._get_bucket_and_key(container, object_name)
        
        if not overwrite:
            try:
                self.s3_client.head_object(Bucket=bucket, Key=key)
                return self._object_url(key, bucket, with_sas=with_sas)
            except ClientError:
                # Object does not exist; proceed to upload.
                pass

        with open(file_path, "rb") as data:
            self.s3_client.upload_fileobj(data, bucket, key)
            
        return self._object_url(key, bucket, with_sas=with_sas)

    # -----------------
    # Bytes/JSON uploads
    # -----------------
    def upload_bytes(self, data: bytes, object_name: str, container: Optional[str] = None, content_type: str = "application/octet-stream", overwrite: bool = True, with_sas: bool = True) -> str:
        bucket, key = self._get_bucket_and_key(container, object_name)
        self.s3_client.put_object(
            Body=data,
            Bucket=bucket,
            Key=key,
            ContentType=content_type
        )
        return self._object_url(key, bucket, with_sas=with_sas)

    def upload_json(self, data: Dict[str, Any], object_name: str, container: Optional[str] = None, overwrite: bool = True, with_sas: bool = True) -> str:
        payload = json.dumps(data, ensure_ascii=False, indent=2).encode("utf-8")
        return self.upload_bytes(payload, object_name, container=container, content_type="application/json", overwrite=overwrite, with_sas=with_sas)

    # ---------------
    # Download helpers
    # ---------------
    def download_to_tmp(self, object_name: str, container: Optional[str] = None) -> str:
        bucket, key = self._get_bucket_and_key(container, object_name)
        suffix = os.path.splitext(object_name)[1] or ""
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            self.s3_client.download_fileobj(bucket, key, tmp)
            return tmp.name

    def download_json(self, object_name: str, container: Optional[str] = None) -> Optional[Dict[str, Any]]:
        bucket, key = self._get_bucket_and_key(container, object_name)
        try:
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            data = response['Body'].read()
            return json.loads(data.decode("utf-8"))
        except Exception:
            return None

    # --------
    # Listing
    # --------
    def list_objects(self, prefix: str = "", container: Optional[str] = None) -> List[str]:
        bucket = container or self.bucket_name
        if not bucket:
            return []
        
        # Ensure bucket exists before listing to avoid 404
        self._ensure_bucket_exists(bucket)
        
        try:
            paginator = self.s3_client.get_paginator('list_objects_v2')
            pages = paginator.paginate(Bucket=bucket, Prefix=prefix)
            keys = []
            for page in pages:
                if 'Contents' in page:
                    for obj in page['Contents']:
                        keys.append(obj['Key'])
            return keys
        except Exception:
            return []

    # ----------
    # URL / SAS
    # ----------
    def _object_url(self, object_name: str, container: Optional[str], with_sas: bool = True) -> str:
        bucket = container or self.bucket_name
        
        if with_sas:
            try:
                return self.s3_client.generate_presigned_url(
                    "get_object",
                    Params={"Bucket": bucket, "Key": object_name},
                    ExpiresIn=86400,  # 24 hours
                )
            except ClientError:
                pass

        return f"{self.endpoint_url}/{bucket}/{object_name}"

    # -----------------------------
    # Legacy convenience wrappers
    # -----------------------------
    def download_file(self, object_url: str, destination_path: Optional[str] = None) -> str:
        try:
            object_name, container_name = self._parse_object_url(object_url)
            bucket = container_name
            
            if not destination_path:
                file_ext = os.path.splitext(object_name)[1] or ''
                with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as temp_file:
                    destination_path = temp_file.name
            
            self.s3_client.download_file(bucket, object_name, destination_path)
            return destination_path
        except Exception as e:
            raise ValueError(f"Could not download from URL: {object_url}. Error: {e}")

    def _parse_object_url(self, object_url: str) -> tuple[str, Optional[str]]:
        url_clean = object_url.split("?")[0]
        if "://" in url_clean:
            url_clean = url_clean.split("://")[1]
        
        parts = url_clean.split("/")
        # host/bucket/key...
        # If parts[0] contains 'minio' or 'localhost' or typical S3 host
        if len(parts) >= 3:
            container_name = parts[1]
            object_name = "/".join(parts[2:])
            return object_name, container_name
        return "", None


# -------------------
# Module-level helpers
# -------------------
_service = S3StorageService()


def upload_file_to_s3(file_path: str, object_name: Optional[str] = None) -> str:
    """Path-based upload using default bucket."""
    return _service.upload_file(file_path=file_path, object_name=object_name)


def download_file_from_s3(object_url: str, destination_path: Optional[str] = None) -> str:
    """URL-based download using default bucket."""
    return _service.download_file(object_url, destination_path)


# New helpers for document processing flows

def upload_bytes(container: str, object_name: str, data: bytes, content_type: str = "application/octet-stream", overwrite: bool = True) -> str:
    return _service.upload_bytes(data=data, object_name=object_name, container=container, content_type=content_type, overwrite=overwrite)


def upload_json(container: str, object_name: str, data: Dict[str, Any], overwrite: bool = True) -> str:
    return _service.upload_json(data=data, object_name=object_name, container=container, overwrite=overwrite)


def download_to_tmp(container: str, object_name: str) -> str:
    return _service.download_to_tmp(object_name=object_name, container=container)


def download_json(container: str, object_name: str) -> Optional[Dict[str, Any]]:
    return _service.download_json(object_name=object_name, container=container)


def list_objects(container: str, prefix: str) -> List[str]:
    return _service.list_objects(prefix=prefix, container=container)


def upload_graph_pages(doc_id: str, local_out_dir: Path) -> str | None:
    """
    Uploads all files in local_out_dir/graph_pages to storage.
    Returns the URL prefix for all uploaded page-wise graphs.
    """
    PROCESSED_CT = os.getenv("PROCESSED_CT", _service.bucket_name)
    gp = local_out_dir / "graph_pages"
    if not gp.exists():
        return None
    base_prefix = f"{doc_id}/graph_pages/"
    for p in gp.rglob("*"):
        if p.is_file():
            rel = p.relative_to(gp).as_posix()
            object_name = base_prefix + rel
            with open(p, "rb") as f:
                upload_bytes(PROCESSED_CT, object_name, f.read(), content_type=None)
    
    return f"{_service.endpoint_url}/{PROCESSED_CT}/{base_prefix}"

