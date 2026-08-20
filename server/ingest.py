"""Ingestion for the server-spike mode (stdlib only)."""

import json
import random
import time
import urllib.request
from typing import List, Tuple

from db import get_conn, init_db, upsert_asset

BINANCE_KLINES = "https://api.binance.com/api/v3/klines"
MINUTE_MS = 60_000
MONTH_MS = 30.4375 * 24 * 60 * 60 * 1000
CandleRow = Tuple[str, int, float, float, float, float, float]


def _fetch_batch(symbol: str, interval: str, end_time: int, limit: int) -> List[list]:
    url = f"{BINANCE_KLINES}?symbol={symbol}&interval={interval}&endTime={end_time}&limit={limit}"
    with urllib.request.urlopen(url, timeout=30) as resp:
        return json.load(resp)


def fetch_binance_paginated(symbol: str, interval: str = "1m", months: int = 48, limit: int = 1000) -> List[CandleRow]:
    now = int(time.time() * 1000)
    cutoff = now - months * MONTH_MS
    end = now
    rows: List[CandleRow] = []
    while True:
        batch = _fetch_batch(symbol, interval, end, limit)
        if not batch:
            break
        batch_rows: List[CandleRow] = [
            (symbol, int(k[0]), float(k[1]), float(k[2]), float(k[3]), float(k[4]), float(k[5]))
            for k in batch
        ]
        rows = batch_rows + rows
        earliest = batch_rows[0][1]
        if earliest <= cutoff:
            break
        if len(rows) >= 2 and (rows[0][1] - rows[1][1]) > MINUTE_MS:
            rows = rows[1:]
            break
        end = earliest - 1
        if len(batch_rows) < limit:
            break
    return rows


def seed_synthetic(symbol: str, n: int = 2000, start_price: float = 100.0) -> List[CandleRow]:
    rows: List[CandleRow] = []
    price = start_price
    ts = 1_600_000_000_000
    for i in range(n):
        o = price
        c = o + random.uniform(-1, 1)
        h = max(o, c) + abs(random.uniform(0, 1))
        l = min(o, c) - abs(random.uniform(0, 1))
        v = random.uniform(10, 100)
        rows.append((symbol, ts, o, h, l, c, v))
        ts += MINUTE_MS
        price = c
    return rows


def ingest_symbol(symbol: str, source_name: str = "Binance", months: int = 48, rows: List[CandleRow] = None) -> int:
    if rows is None:
        rows = fetch_binance_paginated(symbol, months=months)
    conn = get_conn()
    init_db(conn)
    conn.executemany(
        "INSERT OR REPLACE INTO candles "
        "(symbol, timestamp, open, high, low, close, volume) VALUES (?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    if rows:
        upsert_asset(conn, symbol, source_name, min(r[1] for r in rows), max(r[1] for r in rows), len(rows), "ready")
    conn.close()
    return len(rows)
