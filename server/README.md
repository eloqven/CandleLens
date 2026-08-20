# CandleLens — server-spike mode

A **spike** exploring the server-backed data mode (decided post-C31). It lives on
the `server-spike` branch, separate from `master`, so the two modes stay clean;
switch branches to pick the mode during the prototype phase.

- **Runtime:** Python 3.10+ (standard library only — no `pip install` needed).
- **Database:** SQLite (a single file, `candlelens.db` by default, overridable
  via the `CANDLELENS_DB` env var).
- **Compute:** indicator lines are computed **server-side** and returned to the
  browser, which only renders. This is the opposite of `master`, where the Web
  Worker computes in the browser.

## What it does
- Stores the canonical 1-minute candles per symbol in SQLite, with asset
  metadata (source, time range, candle count, status).
- Aggregates 1-minute candles into larger intervals on request (the "history %"
  dial selects the most recent slice).
- Computes MA / EMA / WMA families server-side across **multiple slots**, each
  with several price sources, and **all three period modes** (`sequential`,
  `fibonacci`, `divisible`) — matching the browser engine's semantics.
- Keeps a bounded **LRU cache** (the "load what's needed, drop what isn't"
  layer) keyed by aggregation and by indicator set, with prefix invalidation.
- Persists **runs server-side** (meta + zlib-compressed payload) so experiments
  are saved and reloaded without recomputation.
- Serves slices over HTTP; the browser never loads the full series.

## Run it

```bash
# from the server/ directory
cd server

# 1. seed data (offline, synthetic random walk)
python api.py --seed-synthetic BTCUSDT --seed-n 2000

# 1b. or fetch real 1-minute klines from Binance (no auth, paginated, 48-month cap)
python api.py --fetch BTCUSDT --fetch-months 48

# 1c. or ingest a control asset (same fetch path)
python api.py --control ETHUSDT --fetch-months 48

# 2. start the API
python api.py --serve --port 8000
```

The browser app (`src/ui/app.ts`) expects the API at `http://localhost:8000`
(override with `window.CANDLELENS_API_BASE`).

## Endpoints
- `GET /health` → `{"ok": true}`
- `GET /assets` → available ingested symbols with metadata
- `GET /candles?symbol=BTCUSDT&limit=1000` → recent 1-minute candles
- `GET /indicators?symbol=BTCUSDT&interval=233&history=1&slots=<json>&min=1&max=50&mode=divisible&divisor=2&step=1`
  → `{candles, lines, candleCount}`; each line is
  `{id, type, source, period, values}` (warm-up positions are `null`).
  `slots` is JSON: `[{"type":"MA","sources":["close","open"]},{"type":"EMA","sources":["close"]}]`.
- `GET /cache/stats` → cache occupancy
- `POST /cache/invalidate?prefix=...` → drop matching cache entries
- `GET /runs` → saved run metadata
- `POST /runs` (body `{meta, payload}`) → save a run
- `GET /runs/:id` → `{meta, payload}`
- `DELETE /runs/:id` → remove a run

Responses are gzip-encoded when the client sends `Accept-Encoding: gzip`.
CORS is open (`Access-Control-Allow-Origin: *`) for local prototype use.

## TypeScript side
- `src/server/client.ts` — `CandleLensClient`: thin HTTP client (injectable
  `fetch`) covering indicators, assets, and run persistence.
- `src/server/serverCompute.ts` — `computeIndicatorsServer(config, client)`:
  maps a `RunConfig` to the API and returns `{candles, lines, candleCount}`,
  mirroring the browser `computeIndicators` shape so the rest of the render
  pipeline (geometry, colors, renderer) is unchanged.
- `src/ui/app.ts` — the application shell: controls panel, interactive viewer,
  run save/load, and settings persistence. It wires the MD §22–§31
  interactions (zoom/pan, five-point snapping, click-to-reveal, multi-point
  common lines, layer visibility, OHLC source filtering, recolor) against the
  server-computed data.

## Tests
- `tests/server/client.test.ts` — mocked client (indicators, assets, runs).
- `tests/server/serverCompute.test.ts` — mapping from config to server response.
- `tests/server/integration.test.ts` — boots this server (seeded) and calls it
  live, including the full `serverCompute → geometry → colors` pipeline.

## Scope notes
This validates the architecture: a thin Python API + SQLite + an LRU cache, with
the browser only rendering. There is **no auth**, no production hot/de-cache
policy beyond the LRU, and ingestion is a CLI setup step (not in-UI realtime
fetch). Those are the next steps if this mode is chosen over the browser-only
`master`.
