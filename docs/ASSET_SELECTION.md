# Asset Selection — Control Asset Rationale

CandleLens Part 1 requires two assets:

1. **Bitcoin** — mandatory benchmark/control (BTC/USDT on Binance).
2. **A high-volume control asset** — chosen by an explicit, researchable
   scoring process rather than popularity.

## Selection criteria (MD §3)

For each candidate we score, against the BTC reference:

| Criterion            | Weight | Direction            |
| -------------------- | ------ | -------------------- |
| 24h volume           | 0.30   | higher is better     |
| Continuous history   | 0.30   | longer is better     |
| Gap-free fraction    | 0.20   | higher is better     |
| Difference from BTC  | 0.20   | lower correlation    |

The "difference" term deliberately prefers assets whose return behavior is
*materially different* from Bitcoin, so the two assets form a useful
contrast rather than a redundant pair. All candidates must share BTC's
single data source (Binance), per the one-source rule.

## Process

`selectControlAsset(candidates, btc)` (in `src/data/assetSelection.ts`)
returns `{ symbol, score, rationale }`. The rationale string is persisted
in run metadata and this document.

## Current selection

> To be filled once live Binance metrics (24h volume, obtainable history,
> gap-freeness, and BTC return correlation) are gathered for the candidate
> set. The scoring function is already implemented and tested; only the
> metric gathering remains. Candidate shortlist: ETHUSDT, SOLUSDT, BNBUSDT,
> XRPUSDT, DOGEUSDT.
