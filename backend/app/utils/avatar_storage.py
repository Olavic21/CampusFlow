"""Validation, compression et stockage des avatars utilisateur."""
import io
import uuid
from pathlib import Path
from typing import Tuple

from fastapi import HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.config import settings

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
BLOCKED_EXTENSIONS = {".exe", ".svg", ".gif", ".pdf", ".bat", ".sh", ".js", ".html"}

MAGIC = {
    b"\xff\xd8\xff": "jpeg",
    b"\x89PNG\r\n\x1a\n": "png",
    b"RIFF": "webp",  # WebP starts with RIFF....WEBP
}


def ensure_avatar_dir() -> Path:
    dest = settings.MEDIA_ROOT / settings.AVATAR_UPLOAD_DIR
    dest.mkdir(parents=True, exist_ok=True)
    return dest


def _detect_format(header: bytes) -> str | None:
    if header[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if header[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WEBP":
        return "webp"
    return None


def _validate_upload(file: UploadFile, raw: bytes) -> None:
    filename = (file.filename or "").lower()
    ext = Path(filename).suffix
    if ext in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non supporté")
    if ext and ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Format non supporté — utilisez JPG, PNG ou WebP")

    content_type = (file.content_type or "").split(";")[0].strip().lower()
    if content_type and content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="Format non supporté")

    if len(raw) > settings.AVATAR_MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image trop volumineuse (5 Mo maximum)")

    if _detect_format(raw[:16]) is None:
        raise HTTPException(status_code=400, detail="Format non supporté")


def _process_image(raw: bytes) -> bytes:
    try:
        img = Image.open(io.BytesIO(raw))
        img.load()
    except UnidentifiedImageError as e:
        raise HTTPException(status_code=400, detail="Format non supporté") from e

    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")

    if img.mode == "RGBA":
        background = Image.new("RGB", img.size, (255, 255, 255))
        background.paste(img, mask=img.split()[3])
        img = background

    w, h = img.size
    max_dim = settings.AVATAR_MAX_DIMENSION
    if max(w, h) > max_dim:
        img.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    # Carré centré
    side = min(img.size)
    left = (img.width - side) // 2
    top = (img.height - side) // 2
    img = img.crop((left, top, left + side, top + side))

    quality = 88
    for _ in range(8):
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=quality, method=6)
        data = buf.getvalue()
        if len(data) <= settings.AVATAR_TARGET_MAX_BYTES or quality <= 50:
            return data
        quality -= 5

    return data


def save_avatar(user_id: int, file: UploadFile, raw: bytes) -> str:
    _validate_upload(file, raw)
    processed = _process_image(raw)
    ensure_avatar_dir()
    name = f"user_{user_id}_{uuid.uuid4().hex[:12]}.webp"
    rel_path = f"{settings.AVATAR_UPLOAD_DIR}/{name}"
    full_path = settings.MEDIA_ROOT / rel_path
    full_path.write_bytes(processed)
    return rel_path.replace("\\", "/")


def delete_avatar_file(rel_path: str | None) -> None:
    if not rel_path:
        return
    if ".." in rel_path or rel_path.startswith("/"):
        return
    full = settings.MEDIA_ROOT / rel_path
    try:
        if full.is_file():
            full.unlink()
    except OSError:
        pass


def build_avatar_url(rel_path: str | None) -> str | None:
    """URL relative /media/... pour le proxy Vite et l'APK Capacitor."""
    if not rel_path:
        return None
    if rel_path.startswith("http://") or rel_path.startswith("https://"):
        return rel_path
    media = settings.MEDIA_URL.rstrip("/")
    if not media.startswith("/"):
        media = f"/{media}"
    if rel_path.startswith(media):
        return rel_path
    return f"{media}/{rel_path.lstrip('/')}"
