"""
StorageService — wraps boto3 for S3 / Cloudflare R2
Supports upload, download, presigned GET URLs
"""
import logging
from typing import Optional

import aioboto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    def __init__(self):
        self._session = aioboto3.Session()
        self._kwargs = dict(
            region_name=settings.S3_REGION,
            aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
            aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        )
        if settings.S3_ENDPOINT_URL:
            self._kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL

    def _client(self):
        return self._session.client("s3", **self._kwargs)

    async def upload(
        self,
        key: str,
        data: bytes,
        content_type: str = "audio/mpeg",
    ) -> str:
        """Upload bytes to S3/R2 and return the key"""
        async with self._client() as s3:
            await s3.put_object(
                Bucket=settings.S3_BUCKET,
                Key=key,
                Body=data,
                ContentType=content_type,
                ServerSideEncryption="AES256",
            )
        logger.info(f"Uploaded {len(data):,} bytes to s3://{settings.S3_BUCKET}/{key}")
        return key

    async def download(self, key: str) -> bytes:
        """Download file bytes from S3/R2"""
        async with self._client() as s3:
            try:
                response = await s3.get_object(Bucket=settings.S3_BUCKET, Key=key)
                return await response["Body"].read()
            except ClientError as e:
                if e.response["Error"]["Code"] == "NoSuchKey":
                    raise FileNotFoundError(f"S3 key not found: {key}") from e
                raise

    async def presigned_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate a time-limited presigned GET URL for a recording"""
        async with self._client() as s3:
            url = await s3.generate_presigned_url(
                "get_object",
                Params={"Bucket": settings.S3_BUCKET, "Key": key},
                ExpiresIn=expires_in,
            )
        return url

    async def delete(self, key: str) -> None:
        """Hard delete a file from S3/R2"""
        async with self._client() as s3:
            await s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)
        logger.info(f"Deleted s3://{settings.S3_BUCKET}/{key}")

    async def delete_old_recordings(self, older_than_days: int = 90) -> int:
        """
        Batch-delete recordings older than N days.
        Called by scheduled task when data_retention_days is configured.
        Returns count of deleted objects.
        """
        from datetime import datetime, timedelta, timezone
        cutoff = datetime.now(timezone.utc) - timedelta(days=older_than_days)
        deleted = 0

        async with self._client() as s3:
            paginator = s3.get_paginator("list_objects_v2")
            async for page in paginator.paginate(Bucket=settings.S3_BUCKET, Prefix="recordings/"):
                objects = page.get("Contents", [])
                to_delete = [
                    {"Key": obj["Key"]}
                    for obj in objects
                    if obj["LastModified"] < cutoff
                ]
                if to_delete:
                    await s3.delete_objects(
                        Bucket=settings.S3_BUCKET,
                        Delete={"Objects": to_delete},
                    )
                    deleted += len(to_delete)

        logger.info(f"Deleted {deleted} old recordings (>{older_than_days} days)")
        return deleted
