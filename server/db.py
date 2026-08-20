"""SQLite storage for the server-spike mode of CandleLens (stdlib only)."""

import json
import os
import sqlite3
from typing import Any, Dict, List, Optional

DB_PATH = os.environ.get("CANDLELENS_DB", "candlelens.db")


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS candles (
            symbol    TEXT    NOT NULL,
            timestamp INTEGER NOT NULL,
            open      REAL    NOT NULL,
            high      REAL    NOT NULL,
            low       REAL    NOT NULL,
            close     REAL    NOT NULL,
            volume    REAL    NOT NULL,
            PRIMARY KEY (symbol, timestamp)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS assets (
            symbol      TEXT PRIMARY KEY,
            sourceName  TEXT NOT NULL,
            startTime   INTEGER NOT NULL,
            endTime     INTEGER NOT NULL,
            candleCount INTEGER NOT NULL,
            status      TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS runs (
            id      TEXT PRIMARY KEY,
            meta    TEXT NOT NULL,
            payload BLOB NOT NULL
        )
        """
    )
    conn.commit()


def upsert_asset(conn, symbol, source_name, start_time, end_time, candle_count, status):
    conn.execute(
        "INSERT OR REPLACE INTO assets "
        "(symbol, sourceName, startTime, endTime, candleCount, status) VALUES (?, ?, ?, ?, ?, ?)",
        (symbol, source_name, start_time, end_time, candle_count, status),
    )
    conn.commit()


def get_assets(conn):
    cur = conn.execute(
        "SELECT symbol, sourceName, startTime, endTime, candleCount, status FROM assets ORDER BY symbol"
    )
    return [dict(r) for r in cur.fetchall()]


def save_run(conn, run_id, meta_json, payload_bytes):
    conn.execute(
        "INSERT OR REPLACE INTO runs (id, meta, payload) VALUES (?, ?, ?)",
        (run_id, meta_json, payload_bytes),
    )
    conn.commit()


def get_run(conn, run_id):
    cur = conn.execute("SELECT meta, payload FROM runs WHERE id=?", (run_id,))
    row = cur.fetchone()
    return (json.loads(row["meta"]), row["payload"]) if row else None


def list_runs(conn):
    cur = conn.execute("SELECT meta FROM runs ORDER BY json_extract(meta, '$.createdAt') DESC")
    return [json.loads(r["meta"]) for r in cur.fetchall()]


def delete_run(conn, run_id):
    conn.execute("DELETE FROM runs WHERE id=?", (run_id,))
    conn.commit()
