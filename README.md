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

## Status

Part 1 is under active construction (see `PLAN.md` for the phased implementation roadmap). This document describes the *idea*; the codebase grows into it one capability at a time.
