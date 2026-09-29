"""On-demand backups: trigger one now, list what exists, download one as a
zip. The daily automatic backup itself is triggered from main.py on
startup — this router is what the Finances page's Backup panel calls."""
import re
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from backend.backup import create_backup, list_backups, zip_backup

router = APIRouter(tags=["backup"])

# Backup folder names are always "YYYY-MM-DD_HHMMSS" (see backup.py) —
# validated here since the name comes from the URL and is used to build a
# path on disk.
_NAME_RE = re.compile(r"^\d{4}-\d{2}-\d{2}_\d{6}$")


@router.get("/api/backups")
def get_backups():
    return list_backups()


@router.post("/api/backups")
def make_backup():
    name = create_backup()
    if name is None:
        raise HTTPException(400, "Nothing to back up yet — add a car or part first.")
    return {"name": name}


@router.get("/api/backups/{name}/download")
def download_backup(name: str):
    if not _NAME_RE.match(name):
        raise HTTPException(400, "Invalid backup name")
    try:
        zip_path = zip_backup(name)
    except FileNotFoundError:
        raise HTTPException(404, "Backup not found")
    return FileResponse(zip_path, filename=f"garage-ledger-backup-{name}.zip", media_type="application/zip")
