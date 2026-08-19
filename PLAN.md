# CandleLens — Implementation Plan (Part 1, heatmap deferred)

> Tracing snapshot of the agreed plan. Each functionality ships as its own signed commit; README is updated every commit to describe the *idea*, not the changelog.

## 1. Goal & scope
Build the Part 1 experimental instrument from `Candle Lens — Part 1 Implementation Plan.md`, **excluding Section 30 (intra-candle trade heat map)**. Output is an HTML/TS prototype that ingests Binance 1-min history, aggregates derived candles, computes large MA/EMA/WMA families, renders them as individual lines or a mesh, persists runs, and lets the user inspect candle snap-points against nearby indicator lines.

## 2. Tech stack (confirmed)
- **TypeScript + Vite** (dev server + build)
- **Canvas2D** rendering behind a `Renderer` interface (WebGL swap-in later)
- **IndexedDB** for persistence (base dataset, run raw matrix, render geometry)
- **Web Workers** for off-main-thread indicator computation
- **Binance public klines** (`/api/v3/klines`, no-auth) as the single source
- **npm** as package manager; **Vitest** for tests

## 3. Architecture (maps MD §31)
```
binanceSource → validation → canonical 1-min store → aggregate →
indicator engine (worker) → raw matrix store → geometry gen →
renderer → interactive viewer
```
UI never computes indicators; renderer never computes indicators.

## 4. Directory layout
```
CandleLens/
  README.md
  package.json  tsconfig.json  vite.config.ts  index.html
  src/
    core/      types.ts  config.ts  fingerprint.ts
    data/      binanceSource.ts  validation.ts  storage.ts  assetSelection.ts
    candle/    aggregate.ts  history.ts
    indicators/ ma.ts  ema.ts  wma.ts  periods.ts  engine.ts
    run/       runModel.ts  workload.ts  persistence.ts
    render/    renderer.ts  canvasRenderer.ts  geometry.ts  colors.ts  mesh.ts
    ui/        app.ts  createTab.ts  loadTab.ts  viewer.ts
              controls.ts  snapping.ts  intersection.ts  multiSelect.ts  layers.ts  recolor.ts
    workers/   compute.worker.ts
  tests/       (mirrors src modules)
```

## 5. Commit strategy (modular, signed, README-updated)
Each functionality = **one commit**, signed with `git commit -s` (Signed-off-by trailer) and a real committer identity. I commit as **Candal**; subagents commit under their own agent name for backtrackability. **Every commit also updates `README.md`** to expand the *concept* (purpose, principles, what the new capability enables for research) — never a changelog.

Proposed commit sequence (each its own signed commit + README update + tests where applicable):

**Phase 0 — Scaffold**
- `C0` Repo scaffold: package.json, tsconfig, vite config, index.html, base README (the idea of CandleLens).

**Phase 1A — Data foundation**
- `C1` Core domain + config types (`core/types.ts`, `core/config.ts`)
- `C2` Binance ingestion: paginated 1-min fetch, back-to-gap / 48-month stop (`data/binanceSource.ts`)
- `C3` Validation: continuity, dup/missing/out-of-order, malformed, OHLC rules, report (`data/validation.ts`)
- `C4` Canonical 1-min IndexedDB store + provenance metadata (`data/storage.ts`)
- `C5` Asset selection: BTC/USDT + researched high-volume control asset + rationale doc (`data/assetSelection.ts`)

**Phase 1B — Candle engine**
- `C6` Derived aggregation 1–377 min, deterministic OHLCV (`candle/aggregate.ts`)
- `C7` History-length: max candle count + 0–100% → count mapping, deferred recalc (`candle/history.ts`)
- `C8` Basic candlestick viewer (Canvas) (`render/canvasRenderer.ts` + `ui/createTab.ts` stage 1)

**Phase 1C — Indicator engine**
- `C9` MA / EMA / WMA implementations (`indicators/{ma,ema,wma}.ts`)
- `C10` Period generation: sequential, Fibonacci, divisible (`indicators/periods.ts`)
- `C11` Engine: 3 slots, OHLC sources, range/step, orchestration (`indicators/engine.ts`)
- `C12` Web Worker compute wrapper (`workers/compute.worker.ts`)

**Phase 1D — Rendering**
- `C13` `Renderer` interface + Canvas2D impl (`render/renderer.ts`, `canvasRenderer.ts`)
- `C14` Render geometry generation from raw matrix (`render/geometry.ts`)
- `C15` Color system: gradient / palette / per-line (`render/colors.ts`)
- `C16` Mesh/heat-field renderer + steepness (`render/mesh.ts`)

**Phase 1E — Run system**
- `C17` Run state model + statuses (`run/runModel.ts`)
- `C18` Workload estimation (candles × periods × sources × types) (`run/workload.ts`)
- `C19` Config fingerprint/hash (`core/fingerprint.ts`)
- `C20` Run persistence: raw matrix + render geometry, reload w/o recompute (`run/persistence.ts`)
- `C21` Confirmation dialog + real-progress UI (`ui/controls.ts`)

**Phase 1F — Viewer interaction**
- `C22` Zoom / pan / hover (`ui/viewer.ts`)
- `C23` Five snap points + hover snapping (`ui/snapping.ts`)
- `C24` Tolerance + click-to-reveal nearby lines (`ui/intersection.ts`)
- `C25` Multi-point selection + summary (`ui/multiSelect.ts`)
- `C26` Layer controls: visibility / opacity (`ui/layers.ts`)

**Phase 1G — Load system**
- `C27` Run list + metadata display (`ui/loadTab.ts`)
- `C28` Single + multi-run load (same-interval enforcement) (`ui/loadTab.ts`)
- `C29` Recolor previous run without recalculation (`ui/recolor.ts`)

Tests (MD §35) are added **within** the relevant commit (e.g. `C3` ships validation tests, `C6` ships aggregation tests, `C9` ships indicator correctness tests, etc.).

## 6. Parallelization approach
After `C0`–`C1` (shared types) land, independent leaf modules can be built by parallel subagents:
- One agent: `C3` validation + tests (depends only on `C1`)
- One agent: `C6` aggregation + tests (depends only on `C1`)
- One agent: `C9` MA/EMA/WMA + tests (depends only on `C1`)
- One agent: `C15` colors + tests (depends only on `C1`)
Then integration commits (`C11`, `C13`, `C20`, UI tabs) are done sequentially since they depend on multiple leaves. Each subagent signs its commits with its own name.

## 7. Key risks / notes
- **Binance depth**: 1-min history is deep but fetched 1000 rows/request with rate limits; ingestion paginates backward and stops at first gap or 48 months. Real fetch is a manual/CLI step; tests use synthetic data.
- **Storage size**: 48 months × 2 assets of 1-min data is large (~millions of rows). IndexedDB handles it; initial prototype may cap fetch window for dev speed.
- **GPG signing**: if no GPG key is configured, commits use the `Signed-off-by` trailer + committer identity (Candal / agent name) for backtrackability rather than failing.

## 8. Execution order (post-approval)
1. `gh repo create CandleLens --public` (or via gh), clone, branch `part1`.
2. Land `C0`→`C29` in order, each signed + README-updated + pushed.
3. After each push, README reflects the expanded concept.
