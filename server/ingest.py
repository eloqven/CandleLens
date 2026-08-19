"""Ingestion for the server-spike mode.

Two sources, both dependency-free (Python stdlib only):
- fetch_binance: pulls public 1-minute klines from Binance (no auth).
- seed_synthetic: generates a random-walk series for offline testing.

Rows are upserted into SQLite keyed by (symbol, timestamp).
"""

import json
import random
import urllib.request
from typing import List, Tuple

from db import get_conn, init_db

BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
CandleRow = Tuple[str, int, float, float, float, float, float]


def fetch_binance(symbol: str, interval: str = "1m", limit: int = 1000) -> List[CandleRow]:
    url = f"{BINANCE_KLINES}?symbol={symbol}&interval={interval}&limit={limit}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        raw = json.load(resp)
    rows: List[CandleRow] = []
    for k in raw:
        rows.append(
            (
                symbol,
                int(k[0]),
                float(k[1]),
                float(k[2]),
                float(k[3]),
                float(k[4]),
                float(k[5]),
            )
        )
    return rows


def seed_synthetic(symbol: str, n: int = 2000, start_price: float = 100.0) -> List[CandleRow]:
    rows: List[CandleRow] = []
    price = start_price
    ts = 1_600_000_000_000  # arbitrary fixed epoch ms
    step_ms = 60_000
    for i in range(n):
        o = price
        c = o + random.uniform(-1, 1)
        h = max(o, c) + abs(random.uniform(0, 1))
        l = min(o, c) - abs(random.uniform(0, 1))
        v = random.uniform(10, 100)
        rows.append((symbol, ts, o, h, l, c, v))
        ts += step_ms
        price = c
    return rows


def ingest(rows: List[CandleRow]) -> int:
    conn = get_conn()
    init_db(conn)
    conn.executemany(
        "INSERT OR REPLACE INTO candles "
        "(symbol, timestamp, open, high, low, close, volume) "
        "VALUES (?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    conn.commit()
    count = len(rows)
    conn.close()
    return count
