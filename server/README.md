# CandleLens — server-spike mode

A **spike** exploring the server-backed data mode (decided post-C31). It is a
separate branch from `master` so the two modes stay clean; switch branches to
pick the mode during the prototype phase.

- **Runtime:** Python 3.10+ (standard library only — no `pip install` needed).
- **Database:** SQLite (a single file, `candlelens.db` by default, overridable
  via the `CANDLELENS_DB` env var).
- **Compute:** indicator lines are computed **server-side** and returned to the
  browser, which only renders. This is the opposite of `master`, where the
  Web Worker computes in the browser.

## What it does
- Stores the canonical 1-minute candles per symbol in SQLite.
- Aggregates 1-minute candles into larger intervals on request.
- Computes MA / EMA / WMA families server-side (matching the browser engine's
  semantics) and returns only the requested lines.
- Serves slices over HTTP; the browser never loads the full series.

## Run it

```bash
# from the server/ directory
cd server

# 1. seed data (offline, synthetic random walk)
python api.py --seed-synthetic BTCUSDT --seed-n 2000

# 1b. or fetch real 1-minute klines from Binance (no auth)
python api.py --fetch BTCUSDT --fetch-limit 1000

# 2. start the API
python api.py --serve --port 8000
```

## Endpoints
- `GET /health` → `{"ok": true}`
- `GET /candles?symbol=BTCUSDT&limit=1000` → recent 1-minute candles
- `GET /indicators?symbol=BTCUSDT&interval=233&type=MA&source=close&min=1&max=50&mode=sequential&step=1`
  → computed lines, each `{id, period, values}` (warm-up positions are `null`)

Responses are gzip-encoded when the client sends `Accept-Encoding: gzip`.
CORS is open (`Access-Control-Allow-Origin: *`) for local prototype use.

## Scope of the spike
This validates the architecture: a thin Python API + SQLite. The TypeScript
client (`src/server/client.ts`) is wired as a proof of concept — it calls
`/indicators` and `/candles` and maps the response into the same
`IndicatorLine` domain type the browser engine produces, so the rest of the
render pipeline is unchanged. `tests/server/client.test.ts` (mocked) and
`tests/server/integration.test.ts` (boots this server and calls it live)
cover it.

It is **not** yet swapped into the UI in place of the Web Worker, does not yet
implement the full period generation modes (only `sequential` and
`fibonacci`), and has no auth, caching layer, or hot/de-cache policy yet —
those are the next steps if this mode is chosen over the browser-only `master`.
