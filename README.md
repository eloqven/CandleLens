# CandleLens

> An experimental instrument for investigating whether moving averages can meaningfully describe price limits, resistance/support-like boundaries, and recurring interaction patterns around candle price points.

CandleLens is **not** a trading-signal engine. It is a research tool built on a single, deliberately narrow question:

> Can moving-average structures reveal recurring boundaries, limits, resistance/support-like behavior, or other meaningful relationships with market price?

The system is designed so that this question can be investigated **systematically** across different assets, candle intervals, MA families, price sources, period ranges, line densities, and historical windows — without assuming in advance that any visible pattern is meaningful.

## Why it exists

Most charting tools either hide the moving-average machinery behind a few presets, or drown the user in lines with no way to reason about them. CandleLens takes the opposite stance:

- Generate **large families** of moving-average curves (hundreds to thousands of periods).
- Visualize them against historical candles as **individual lines** or as a combined **mesh / heat field**.
- Inspect, interactively, where those curves intersect or approach significant candle points (open, high, low, close, body center).
- Persist every run so an experiment is **cheap to revisit** — calculate once, save everything needed, reload almost instantly.

## Design philosophy

1. **One authoritative data source.** A single historical market dataset, with provenance recorded on every run. No silent merging of exchanges or APIs.
2. **Canonical 1-minute base.** All larger candle intervals are deterministically aggregated from 1-minute OHLC data. One source of truth.
3. **No fake precision.** The system never infers information not contained in the source. (An intra-candle trade heat map is explicitly deferred until suitable trade-level data exists.)
4. **Calculate once, revisit cheaply.** Raw computation and render-ready geometry are stored separately from presentation styling, so runs reload fast and can be recolored without recomputation.
5. **Correctness over instant response.** Expensive calculations are allowed; the system estimates workload, shows real progress, persists runs, and avoids unnecessary recomputation.

## A run is a hypothesis, written as configuration

CandleLens does not ask "what indicator should I show you?" It asks you to *specify an experiment*: which asset, which candle interval, how much history, which moving-average families, which price sources, which period range, and how densely. That full description — the **run configuration** — is the unit of work. It is serializable, hashable, and reproducible, so two people (or the same person, weeks apart) can ask "was this the same experiment?" and get a definite answer.

This matters because the research question is not "does MA(50) look interesting?" but "across many assets, intervals, and MA families, do recurring boundaries emerge?" Treating configuration as first-class data is what makes that question answerable instead of anecdotal.

## One source of truth, taken seriously

A pattern "discovered" by silently blending two exchanges is not a pattern — it is an artifact of the blend. CandleLens therefore commits to a single historical data source per experiment, and records that source's identity and the exact window obtained as provenance on every run. The ingestion walks backward from the newest available candle and stops at the first unacceptable timestamp gap or the 48-month boundary, whichever comes first; the *actual* length retrieved is stored rather than assumed. The instrument is only as honest as its inputs, so provenance is not metadata decoration — it is part of the result.

## Continuity is verified, never assumed

Before any candle is trusted, the sequence is validated: timestamp continuity, duplicate and missing minutes, out-of-order rows, malformed values, and impossible OHLC relationships (a low above the close, a high below the open) are all detected and reported. A run must never proceed while quietly believing the data is continuous. The validation report distinguishes an expected dataset boundary from a real gap, because only the latter should abort an experiment.

## One canonical dataset, derived everywhere else

The validated 1-minute history is stored as the single source of truth. Every larger candle interval — 2 minutes, 233 minutes, 377 minutes — is *derived* from it by deterministic aggregation, never re-downloaded. This keeps the instrument internally consistent: the same base always yields the same derived candle, so an experiment is reproducible down to the pixel. Persistence is not an afterthought; the base dataset, once verified, is kept so that revisiting an asset does not mean re-fetching and re-validating the past.

## A benchmark and a contrast

Bitcoin is the mandatory benchmark: liquid, long-lived, high-quality. The second asset is not picked because it is fashionable. It is chosen by an explicit scoring process — volume, obtainable history, gap-freeness, and, crucially, *behavioral difference* from Bitcoin. A control asset that merely mirrors BTC would teach nothing; the point of having two is to see where moving-average structure is universal and where it is asset-specific. The choice and its rationale are recorded, not implied.

## The candle interval is a lens, not a preset

Any integer interval from 1 to 377 minutes is valid — not only the familiar Fibonacci numbers. Larger intervals are *aggregated*, never re-fetched, so the choice of interval is a free experimental dial: compress 233 minutes of history into one candle and the same moving averages describe a different rhythm. The interval selector is deliberately unrestricted because the research question is about structure across scales, not about a handful of conventional chart settings.

## How much of the past to look at

Once an interval is chosen, the instrument offers not "load everything" or "load a bit," but a continuous fraction of the available history — 0 to 100%. The percentage is only a handle; what the engine actually consumes is a candle count, the most recent slice of the series. This keeps the experiment honest about scale: a 10% window of 233-minute candles and a 100% window are different experiments, and the count is what gets recorded and reproduced.

## See the candles before the math

The workflow is progressive on purpose. A user can generate and inspect the candlestick chart *before* committing to any indicator calculation. This matters because the question is not "what do my indicators say?" but "does the price structure itself suggest something worth overlaying indicators on?" The candles are the ground truth; everything computed later is a lens laid on top of them, and the lens should never obscure the ground.

## Three families of moving average

CandleLens computes three kinds of moving average — simple, exponential, and weighted — not because one is "correct," but because they weight the recent past differently. A simple average treats every candle equally; an exponential average leans on the newest; a weighted average scales linearly by recency. If a boundary appears under all three, it is more interesting than one that survives only a particular weighting. The instrument is built to compute families, not single lines, precisely so that such cross-family agreement (or disagreement) becomes visible.

## Status

Part 1 is under active construction (see `PLAN.md` for the phased implementation roadmap). This document describes the *idea*; the codebase grows into it one capability at a time.
