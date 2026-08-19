"""Minimal HTTP API for the server-spike mode (Python stdlib only).

Endpoints:
  GET /candles?symbol=BTCUSDT&limit=1000
      -> recent 1-minute candles (ascending by time)
  GET /indicators?symbol=BTCUSDT&interval=233&type=MA&source=close
                   &min=1&max=50&mode=sequential&step=1
      -> computed indicator lines (server-side), each {id, period, values}
  GET /health -> {"ok": true}

The API returns only what the view asks for; the browser renders and never
holds the full series. Responses may be gzip-encoded when the client asks.
"""

import argparse
import gzip
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Dict, List, Optional
from urllib.parse import urlparse, parse_qs

from db import get_conn, init_db
from indicators import compute_indicator
from ingest import fetch_binance, seed_synthetic, ingest

SOURCE_FIELDS = {"open": "open", "high": "high", "low": "low", "close": "close"}


def get_candles(symbol: str, limit: int) -> List[Dict]:
    conn = get_conn()
    init_db(conn)
    cur = conn.execute(
        "SELECT timestamp, open, high, low, close, volume FROM candles "
        "WHERE symbol=? ORDER BY timestamp DESC LIMIT ?",
        (symbol, limit),
    )
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    rows.reverse()
    return rows


def aggregate(candles: List[Dict], interval: int) -> List[Dict]:
    """Group consecutive 1-minute candles into `interval`-minute buckets."""
    if interval <= 1:
        return candles
    out: List[Dict] = []
    for i in range(0, len(candles), interval):
        group = candles[i : i + interval]
        if not group:
            continue
        out.append(
            {
                "timestamp": group[0]["timestamp"],
                "open": group[0]["open"],
                "high": max(c["high"] for c in group),
                "low": min(c["low"] for c in group),
                "close": group[-1]["close"],
                "volume": sum(c["volume"] for c in group),
            }
        )
    return out


def periods_in_range(min_p: int, max_p: int, mode: str, step: int) -> List[int]:
    if mode == "fibonacci":
        fibs = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, 144, 233, 377]
        return [f for f in fibs if min_p <= f <= max_p]
    step = max(1, step)
    return list(range(min_p, max_p + 1, step))


def compute_lines(
    symbol: str,
    interval: int,
    kind: str,
    source: str,
    min_p: int,
    max_p: int,
    mode: str,
    step: int,
) -> Dict:
    candles = aggregate(get_candles(symbol, 50000), interval)
    if not candles:
        return {"lines": []}
    field = SOURCE_FIELDS.get(source, "close")
    series = [c[field] for c in candles]
    lines = []
    for p in periods_in_range(min_p, max_p, mode, step):
        values = compute_indicator(kind, series, p)
        lines.append({"id": f"{kind}-{source}-{p}", "period": p, "values": values})
    return {"candleCount": len(candles), "lines": lines}


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload: Dict, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        accept_gzip = "gzip" in self.headers.get("Accept-Encoding", "")
        if accept_gzip:
            body = gzip.compress(body)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if accept_gzip:
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        route = parsed.path

        if route == "/health":
            self._send({"ok": True})
            return

        if route == "/candles":
            symbol = qs.get("symbol", ["BTCUSDT"])[0]
            limit = int(qs.get("limit", ["1000"])[0])
            self._send({"symbol": symbol, "candles": get_candles(symbol, limit)})
            return

        if route == "/indicators":
            symbol = qs.get("symbol", ["BTCUSDT"])[0]
            interval = int(qs.get("interval", ["1"])[0])
            kind = qs.get("type", ["MA"])[0].upper()
            source = qs.get("source", ["close"])[0].lower()
            min_p = int(qs.get("min", ["1"])[0])
            max_p = int(qs.get("max", ["50"])[0])
            mode = qs.get("mode", ["sequential"])[0]
            step = int(qs.get("step", ["1"])[0])
            try:
                result = compute_lines(symbol, interval, kind, source, min_p, max_p, mode, step)
                self._send(result)
            except ValueError as e:
                self._send({"error": str(e)}, status=400)
            return

        self._send({"error": "not found"}, status=404)

    def log_message(self, *args):  # silence default stderr logging
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="CandleLens server-spike API")
    parser.add_argument("--serve", action="store_true", help="run the HTTP API")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--seed-synthetic", metavar="SYMBOL", help="seed N synthetic 1m candles")
    parser.add_argument("--seed-n", type=int, default=2000)
    parser.add_argument("--fetch", metavar="SYMBOL", help="fetch 1m klines from Binance")
    parser.add_argument("--fetch-limit", type=int, default=1000)
    args = parser.parse_args()

    if args.seed_synthetic:
        n = ingest(seed_synthetic(args.seed_synthetic, args.seed_n))
        print(f"seeded {n} synthetic candles for {args.seed_synthetic}")
    if args.fetch:
        n = ingest(fetch_binance(args.fetch, limit=args.fetch_limit))
        print(f"fetched {n} candles for {args.fetch}")

    if args.serve or not (args.seed_synthetic or args.fetch):
        print(f"serving on http://localhost:{args.port}")
        HTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
