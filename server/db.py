"""SQLite storage for the server-spike mode of CandleLens.

Holds the canonical 1-minute candles per symbol. The browser never loads this
directly; the API reads slices and returns only what the view needs.
"""

import os
import sqlite3

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
    conn.commit()
