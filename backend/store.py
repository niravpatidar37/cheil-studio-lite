"""SQLite-backed storage for campaigns, generation jobs, and image blobs.

Design notes, since the choices here are deliberate:

* **SQLite, not a service.** This is a prototype that has to run locally with no
  infrastructure. One file, stdlib driver, no container to start. Swapping in
  Postgres later means replacing this module, not the callers.

* **Campaign state is an opaque JSON document.** The wizard's shape is still
  moving; pinning it into columns now would mean a migration per UI tweak for no
  query benefit. Only the fields the campaign *list* needs (name, type, status,
  timestamps) are promoted to real columns.

* **Images are the exception and get their own table.** They are ~1.5 MB each.
  Inlining them as base64 in the state document would bloat every read and write
  of that document, so they are stored as BLOBs and referenced by id. Clients
  fetch them from `/api/images/{id}`, which also lets the browser cache them.

* **Connections are per-call.** Opening a SQLite file is microseconds, and it
  sidesteps the thread-affinity rules that bite when FastAPI runs handlers in a
  threadpool. WAL mode keeps readers from blocking on the writer.
"""

import json
import os
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone

DB_PATH = os.environ.get(
    "STUDIO_DB_PATH",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "studio.db"),
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS campaigns (
    id            TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    campaign_type TEXT NOT NULL,
    status        TEXT NOT NULL DEFAULT 'draft',
    state         TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT,
    kind        TEXT NOT NULL,
    status      TEXT NOT NULL,
    request     TEXT,
    result      TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS images (
    id          TEXT PRIMARY KEY,
    campaign_id TEXT,
    format      TEXT,
    mime        TEXT NOT NULL,
    data        BLOB NOT NULL,
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_campaigns_updated ON campaigns(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_images_campaign   ON images(campaign_id);
"""


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _conn() as c:
        # WAL lets a poll of /api/jobs read while an image write is in flight.
        c.execute("PRAGMA journal_mode=WAL")
        c.executescript(SCHEMA)


# --- Campaigns -------------------------------------------------------------
def save_campaign(
    campaign_id: str | None,
    name: str,
    campaign_type: str,
    state: dict,
    status: str = "draft",
) -> str:
    """Insert or update a campaign. Returns its id."""
    now = _now()
    payload = json.dumps(state)
    with _conn() as c:
        if campaign_id:
            updated = c.execute(
                """UPDATE campaigns
                      SET name = ?, campaign_type = ?, status = ?, state = ?, updated_at = ?
                    WHERE id = ?""",
                (name, campaign_type, status, payload, now, campaign_id),
            ).rowcount
            if updated:
                return campaign_id
            # Fall through: the client held an id we no longer have (deleted, or
            # a fresh database). Recreate it under that id rather than losing
            # the work or silently minting a different one.
        new_id = campaign_id or uuid.uuid4().hex
        c.execute(
            """INSERT INTO campaigns (id, name, campaign_type, status, state, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (new_id, name, campaign_type, status, payload, now, now),
        )
        return new_id


def get_campaign(campaign_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM campaigns WHERE id = ?", (campaign_id,)).fetchone()
    if not row:
        return None
    return {**dict(row), "state": json.loads(row["state"])}


def list_campaigns(limit: int = 50) -> list[dict]:
    """Summaries only — the state document is deliberately not read here."""
    with _conn() as c:
        rows = c.execute(
            """SELECT id, name, campaign_type, status, created_at, updated_at
                 FROM campaigns ORDER BY updated_at DESC LIMIT ?""",
            (limit,),
        ).fetchall()
    return [dict(r) for r in rows]


def delete_campaign(campaign_id: str) -> bool:
    with _conn() as c:
        c.execute("DELETE FROM images WHERE campaign_id = ?", (campaign_id,))
        return c.execute("DELETE FROM campaigns WHERE id = ?", (campaign_id,)).rowcount > 0


# --- Jobs ------------------------------------------------------------------
def create_job(kind: str, campaign_id: str | None, request: dict) -> str:
    job_id = uuid.uuid4().hex
    now = _now()
    with _conn() as c:
        c.execute(
            """INSERT INTO jobs (id, campaign_id, kind, status, request, created_at, updated_at)
               VALUES (?, ?, ?, 'queued', ?, ?, ?)""",
            (job_id, campaign_id, kind, json.dumps(request), now, now),
        )
    return job_id


def update_job(job_id: str, *, status: str, result: dict | None = None, error: str | None = None) -> None:
    with _conn() as c:
        c.execute(
            "UPDATE jobs SET status = ?, result = ?, error = ?, updated_at = ? WHERE id = ?",
            (status, json.dumps(result) if result is not None else None, error, _now(), job_id),
        )


def get_job(job_id: str) -> dict | None:
    with _conn() as c:
        row = c.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not row:
        return None
    job = dict(row)
    job["request"] = json.loads(job["request"]) if job["request"] else None
    job["result"] = json.loads(job["result"]) if job["result"] else None
    return job


# --- Images ----------------------------------------------------------------
def put_image(campaign_id: str | None, fmt: str, mime: str, data: bytes) -> str:
    image_id = uuid.uuid4().hex
    with _conn() as c:
        c.execute(
            "INSERT INTO images (id, campaign_id, format, mime, data, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (image_id, campaign_id, fmt, mime, data, _now()),
        )
    return image_id


def get_image(image_id: str) -> tuple[str, bytes] | None:
    with _conn() as c:
        row = c.execute("SELECT mime, data FROM images WHERE id = ?", (image_id,)).fetchone()
    return (row["mime"], row["data"]) if row else None
