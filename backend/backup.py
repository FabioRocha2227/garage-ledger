"""Automatic and on-demand backups of the database and uploaded photos.

Keeps the last N daily backups under backend/backups/, each its own
timestamped folder containing a copy of garage.db and the uploads folder.
This is what makes it safe for someone non-technical to run the app: even
if they never think about backups themselves, one is taken automatically
the first time they open the app each day.
"""
import os
import shutil
import zipfile
from datetime import date, datetime
from typing import List, Optional

from backend.database import DB_PATH, UPLOADS_DIR, BASE_DIR

BACKUPS_DIR = os.path.join(BASE_DIR, "backups")
KEEP_LAST = 14  # about two weeks of daily backups


def _today_str() -> str:
    return date.today().isoformat()


def _existing_backup_dates() -> set:
    if not os.path.isdir(BACKUPS_DIR):
        return set()
    return {
        name.split("_")[0]
        for name in os.listdir(BACKUPS_DIR)
        if os.path.isdir(os.path.join(BACKUPS_DIR, name))
    }


def create_backup() -> Optional[str]:
    """Copies the current database and uploads into a new timestamped
    backup folder. Returns the folder name, or None if there is nothing
    to back up yet (a fresh install with no database file)."""
    if not os.path.exists(DB_PATH):
        return None

    os.makedirs(BACKUPS_DIR, exist_ok=True)
    stamp = datetime.now().strftime("%Y-%m-%d_%H%M%S")
    dest = os.path.join(BACKUPS_DIR, stamp)
    os.makedirs(dest, exist_ok=True)

    shutil.copy2(DB_PATH, os.path.join(dest, "garage.db"))
    if os.path.isdir(UPLOADS_DIR):
        shutil.copytree(UPLOADS_DIR, os.path.join(dest, "uploads"), dirs_exist_ok=True)

    _prune_old_backups()
    return stamp


def run_daily_backup_if_needed() -> None:
    """Called once on server startup. Backs up at most once per calendar
    day, so restarting the app repeatedly doesn't pile up duplicates."""
    try:
        if _today_str() in _existing_backup_dates():
            return
        create_backup()
    except Exception as e:
        # A backup problem should never stop the app itself from starting.
        print(f"Warning: automatic backup failed ({e})")


def _prune_old_backups() -> None:
    if not os.path.isdir(BACKUPS_DIR):
        return
    folders = sorted(
        (f for f in os.listdir(BACKUPS_DIR) if os.path.isdir(os.path.join(BACKUPS_DIR, f))),
        reverse=True,
    )
    for old in folders[KEEP_LAST:]:
        shutil.rmtree(os.path.join(BACKUPS_DIR, old), ignore_errors=True)


def list_backups() -> List[dict]:
    if not os.path.isdir(BACKUPS_DIR):
        return []
    result = []
    for name in sorted(os.listdir(BACKUPS_DIR), reverse=True):
        path = os.path.join(BACKUPS_DIR, name)
        if not os.path.isdir(path):
            continue
        size = 0
        for root, _, files in os.walk(path):
            for f in files:
                size += os.path.getsize(os.path.join(root, f))
        result.append({"name": name, "size_mb": round(size / (1024 * 1024), 2)})
    return result


def zip_backup(name: str) -> str:
    """Zips a given backup folder on demand (cached) so it can be
    downloaded as one file. Returns the zip file's path."""
    folder = os.path.join(BACKUPS_DIR, name)
    if not os.path.isdir(folder):
        raise FileNotFoundError(name)
    zip_path = os.path.join(BACKUPS_DIR, f"{name}.zip")
    if not os.path.exists(zip_path):
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for root, _, files in os.walk(folder):
                for f in files:
                    full = os.path.join(root, f)
                    zf.write(full, os.path.relpath(full, folder))
    return zip_path
