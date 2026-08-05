"""Bounded media upload validation shared by public and DM uploads."""

from __future__ import annotations

from io import BytesIO
from typing import NamedTuple

from fastapi import HTTPException, UploadFile
from PIL import Image, ImageSequence, UnidentifiedImageError


READ_CHUNK_SIZE = 64 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MAX_GIF_FRAMES = 100


class ValidatedMedia(NamedTuple):
    data: bytes
    extension: str
    media_type: str


async def _read_bounded(file: UploadFile, max_size: int) -> bytes:
    chunks = bytearray()
    while True:
        chunk = await file.read(READ_CHUNK_SIZE)
        if not chunk:
            break
        chunks.extend(chunk)
        if len(chunks) > max_size:
            raise HTTPException(status_code=413, detail="File is too large")
    if not chunks:
        raise HTTPException(status_code=400, detail="File is empty")
    return bytes(chunks)


def _detect_media(data: bytes) -> tuple[str, str]:
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg", "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png", "image/png"
    if data.startswith((b"GIF87a", b"GIF89a")):
        return ".gif", "image/gif"
    if data.startswith(b"RIFF") and data[8:12] == b"WAVE":
        return ".wav", "audio/wav"
    if data.startswith(b"ID3") or (
        len(data) >= 2 and data[0] == 0xFF and data[1] & 0xE0 == 0xE0
    ):
        return ".mp3", "audio/mpeg"
    if len(data) >= 12 and data[4:8] == b"ftyp":
        return ".mp4", "video/mp4"
    raise HTTPException(status_code=400, detail="File content type is not supported")


def _sanitize_image(data: bytes, extension: str) -> bytes:
    try:
        Image.MAX_IMAGE_PIXELS = MAX_IMAGE_PIXELS
        with Image.open(BytesIO(data)) as image:
            if image.width * image.height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=400, detail="Image dimensions are too large")

            frames = []
            for index, frame in enumerate(ImageSequence.Iterator(image)):
                if index >= MAX_GIF_FRAMES:
                    raise HTTPException(status_code=400, detail="Image has too many frames")
                frames.append(frame.copy())

            output = BytesIO()
            if extension == ".jpg":
                frames[0].convert("RGB").save(output, format="JPEG", quality=90, optimize=True)
            elif extension == ".png":
                frames[0].save(output, format="PNG", optimize=True)
            else:
                first, *remaining = frames
                first.save(
                    output,
                    format="GIF",
                    save_all=bool(remaining),
                    append_images=remaining,
                    loop=image.info.get("loop", 0),
                    duration=image.info.get("duration", 100),
                )
            return output.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as error:
        raise HTTPException(status_code=400, detail="Invalid image file") from error


async def validate_media_upload(file: UploadFile, max_size: int) -> ValidatedMedia:
    data = await _read_bounded(file, max_size)
    extension, media_type = _detect_media(data)

    original_name = file.filename or ""
    original_extension = "." + original_name.rsplit(".", 1)[-1].lower() if "." in original_name else ""
    compatible_extensions = {extension}
    if extension == ".jpg":
        compatible_extensions.add(".jpeg")
    if original_extension not in compatible_extensions:
        raise HTTPException(status_code=400, detail="Filename extension does not match file content")

    if media_type.startswith("image/"):
        data = _sanitize_image(data, extension)
    return ValidatedMedia(data=data, extension=extension, media_type=media_type)
