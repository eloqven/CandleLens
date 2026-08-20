"""HTTP API for the server-spike mode (Python stdlib only)."""

import argparse
import gzip
import json
import zlib
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Any, Dict, List
from urllib.parse import urlparse, parse_qs

from db import get_conn, init_db, get_assets, save_run, get_run, list_runs, delete_run
from indicators import compute_all
from ingest import fetch_binance_paginated, seed_synthetic, ingest_symbol
from cache import Cache

SOURCE_FIELDS = {"open": "open", "high": "high", "low": "low", "close": "close"}
MAX_ONE_MIN_CANDLES = 500_000
CACHE = Cache(max_bytes=200 * 1024 * 1024)


def get_candles(symbol: str, limit: int) -> List[Dict]:
    conn = get_conn()
    init_db(conn)
    cur = conn.execute(
        "SELECT timestamp, open, high, low, close, volume FROM candles "
        "WHERE symbol=? ORDER BY timestamp DESC LIMIT ?", (symbol, limit))
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    rows.reverse()
    return rows


def aggregate(candles: List[Dict], interval: int) -> List[Dict]:
    if interval <= 1:
        return candles
    out: List[Dict] = []
    for i in range(0, len(candles), interval):
        group = candles[i:i + interval]
        if not group:
            continue
        out.append({
            "timestamp": group[0]["timestamp"],
            "open": group[0]["open"],
            "high": max(c["high"] for c in group),
            "low": min(c["low"] for c in group),
            "close": group[-1]["close"],
            "volume": sum(c["volume"] for c in group),
        })
    return out


def compute(symbol, interval, history, slots_json, min_p, max_p, mode, step, divisor):
    slots = json.loads(slots_json) if slots_json else []
    agg_key = f"agg:{symbol}:{interval}:{history:.4f}"
    candles = CACHE.get(agg_key)
    if candles is None:
        window = get_candles(symbol, MAX_ONE_MIN_CANDLES)
        n = max(1, int(history * len(window))) if window else 0
        candles = aggregate(window[-n:] if n else window, interval)
        CACHE.put(agg_key, candles, len(candles) * 56)
    if not candles:
        return {"candles": [], "lines": [], "candleCount": 0}
    ind_key = f"ind:{symbol}:{interval}:{history:.4f}:{slots_json}:{min_p}:{max_p}:{mode}:{step}:{divisor}"
    lines = CACHE.get(ind_key)
    if lines is None:
        lines = compute_all(candles, slots, min_p, max_p, mode, step, divisor)
        size = sum(len(l["values"]) * 8 for l in lines) + len(lines) * 64
        CACHE.put(ind_key, lines, size)
    return {"candles": candles, "lines": lines, "candleCount": len(candles)}


def _compress_payload(payload: Dict) -> bytes:
    return zlib.compress(json.dumps(payload).encode("utf-8"))


def _decompress_payload(blob: bytes) -> Dict:
    return json.loads(zlib.decompress(blob).decode("utf-8"))


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload: Any, status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        if "gzip" in self.headers.get("Accept-Encoding", ""):
            body = gzip.compress(body)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if "gzip" in self.headers.get("Accept-Encoding", ""):
            self.send_header("Content-Encoding", "gzip")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> Dict:
        length = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(length) or b"{}")

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        route = parsed.path
        if route == "/health":
            return self._send({"ok": True})
        if route == "/candles":
            symbol = qs.get("symbol", ["BTCUSDT"])[0]
            limit = int(qs.get("limit", ["1000"])[0])
            return self._send({"symbol": symbol, "candles": get_candles(symbol, limit)})
        if route == "/assets":
            conn = get_conn(); init_db(conn)
            return self._send({"assets": get_assets(conn)})
        if route == "/indicators":
            symbol = qs.get("symbol", ["BTCUSDT"])[0]
            interval = int(qs.get("interval", ["1"])[0])
            history = float(qs.get("history", ["1"])[0])
            slots = qs.get("slots", ["[]"])[0]
            min_p = int(qs.get("min", ["1"])[0])
            max_p = int(qs.get("max", ["50"])[0])
            mode = qs.get("mode", ["sequential"])[0]
            step = int(qs.get("step", ["1"])[0])
            divisor = int(qs.get("divisor", ["0"])[0]) or None
            try:
                self._send(compute(symbol, interval, history, slots, min_p, max_p, mode, step, divisor))
            except ValueError as e:
                self._send({"error": str(e)}, status=400)
            return
        if route == "/cache/stats":
            return self._send(CACHE.stats())
        if route == "/runs":
            conn = get_conn(); init_db(conn)
            return self._send({"runs": list_runs(conn)})
        if route.startswith("/runs/"):
            run_id = route.split("/")[-1]
            conn = get_conn(); init_db(conn)
            rec = get_run(conn, run_id)
            if not rec:
                return self._send({"error": "not found"}, status=404)
            meta, blob = rec
            return self._send({"meta": meta, "payload": _decompress_payload(blob)})
        self._send({"error": "not found"}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        route = parsed.path
        if route == "/runs":
            body = self._body()
            run_id = body["meta"]["id"]
            blob = _compress_payload(body["payload"])
            conn = get_conn(); init_db(conn)
            save_run(conn, run_id, json.dumps(body["meta"]), blob)
            return self._send({"ok": True, "id": run_id})
        if route == "/cache/invalidate":
            prefix = parse_qs(parsed.query).get("prefix", [""])[0]
            return self._send({"removed": CACHE.invalidate_prefix(prefix)})
        self._send({"error": "not found"}, status=404)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.startswith("/runs/"):
            run_id = parsed.path.split("/")[-1]
            conn = get_conn(); init_db(conn)
            delete_run(conn, run_id)
            return self._send({"ok": True, "id": run_id})
        self._send({"error": "not found"}, status=404)

    def log_message(self, *args):
        pass


def main() -> None:
    parser = argparse.ArgumentParser(description="CandleLens server-spike API")
    parser.add_argument("--serve", action="store_true", help="run the HTTP API")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--seed-synthetic", metavar="SYMBOL", help="seed N synthetic 1m candles")
    parser.add_argument("--seed-n", type=int, default=2000)
    parser.add_argument("--fetch", metavar="SYMBOL", help="fetch 1m klines from Binance (48mo)")
    parser.add_argument("--fetch-months", type=int, default=48)
    parser.add_argument("--control", metavar="SYMBOL", help="fetch + ingest a control asset (48mo)")
    args = parser.parse_args()
    if args.seed_synthetic:
        n = ingest_symbol(args.seed_synthetic, rows=seed_synthetic(args.seed_synthetic, args.seed_n))
        print(f"seeded {n} synthetic candles for {args.seed_synthetic}")
    if args.fetch:
        n = ingest_symbol(args.fetch, months=args.fetch_months)
        print(f"fetched {n} candles for {args.fetch}")
    if args.control:
        n = ingest_symbol(args.control, months=args.fetch_months)
        print(f"fetched {n} control-asset candles for {args.control}")
    if args.serve or not (args.seed_synthetic or args.fetch or args.control):
        print(f"serving on http://localhost:{args.port}")
        HTTPServer(("0.0.0.0", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
