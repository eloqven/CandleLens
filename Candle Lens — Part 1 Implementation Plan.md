# Candle Lens — Part 1 Implementation Plan

## 1. Project Purpose

**Candle Lens** is an exploratory visualization and computation prototype for investigating whether moving averages can meaningfully describe price limits, resistance/support-like boundaries, and recurring interaction patterns around candle price points.

The purpose of Part 1 is **not to assume that these relationships exist**. The tool should make it possible to generate large families of moving-average curves, visualize them against historical candles, and interactively inspect where those curves intersect or approach significant candle points.

The system should therefore be designed as an **experimental instrument**, not as a trading-signal engine.

Part 2 will later extend the system toward higher-level analysis, potentially including news and other external factors. Part 2 should remain architecturally separate from the Part 1 indicator/rendering engine.

---

# 2. Core Design Principles

### 2.1 One authoritative data source

Use **one source of historical market data** for the initial implementation.

Do not silently combine exchanges, archives, APIs, or third-party datasets.

Data provenance must be recorded with every run.

### 2.2 Start with the maximum usable history

The system should attempt to obtain as much continuous 1-minute historical data as possible, subject to:

- maximum target: **48 months**
- minimum acceptable condition: no unexplained timestamp gaps
- stop condition: the earliest point where continuity cannot be maintained, or the 48-month boundary is reached

The system should therefore effectively perform:

> newest available candle → backwards through history → stop at first unacceptable gap or 48 months

The actual resulting history length must be recorded rather than assuming exactly 48 months.

### 2.3 One-minute data is the canonical base dataset

The stored base dataset is 1-minute OHLC data.

All larger candle intervals are derived from this base data.

Do **not** independently download 30-minute, 60-minute, 233-minute, etc. candles when those can be deterministically aggregated from the canonical 1-minute dataset.

This gives the application one consistent source of truth.

### 2.4 No fake precision

The system must never infer information that is not contained in the source data.

In particular:

- OHLC candles do not reveal the distribution of individual trades inside the candle.
- A trade-density heat map may only be generated if suitable historical trade/tick data exists.
- Do not manufacture intra-candle trade distributions from OHLC data.

---

# 3. Initial Market Data Selection

## Required assets

The initial experiment should contain at least:

### Asset 1 — Bitcoin

Bitcoin is mandatory because of:

- extremely high liquidity
- large trading volume
- long historical availability
- relatively strong data quality
- usefulness as a benchmark/control asset

Candidate initial market:

- BTC/USDT
- or BTC/USDC

The exact quote asset should be determined by the chosen single data source.

### Asset 2 — high-volume control asset

Select a second crypto asset using explicit criteria:

1. high trading volume
2. long historical availability
3. continuous 1-minute history
4. minimal/no gaps over the maximum obtainable period
5. same source as Bitcoin
6. preferably materially different market behavior from Bitcoin

The selection process should be implemented/researchable rather than hard-coded merely because the asset is popular.

The final selected asset and selection rationale must be saved in the project documentation and data metadata.

---

# 4. Historical Data Validation

The ingestion layer must validate the 1-minute sequence before it is considered usable.

For every candle:

- timestamp
- open
- high
- low
- close
- volume if available
- source symbol
- source name

### Continuity rule

For 1-minute candles:

```text
next_timestamp - current_timestamp == 60 seconds
```

Any deviation must be detected.

The system should distinguish between:

- expected dataset boundary
- duplicated timestamps
- missing timestamps
- malformed rows
- out-of-order rows
- invalid OHLC relationships

The ingestion pipeline should produce a validation report.

A run must never silently proceed while believing the data is continuous if continuity has not actually been verified.

---

# 5. Derived Candle Engine

The UI allows the user to select a candle interval from:

```text
1 ... 377 minutes
```

Every integer in this range is valid.

Examples:

```text
1
2
3
4
5
...
233
...
377
```

The interval selector must therefore **not** be restricted to Fibonacci numbers.

The derived candle engine aggregates the 1-minute base data into the selected interval.

For each derived candle:

- Open = first source candle open
- High = maximum source high
- Low = minimum source low
- Close = final source candle close
- Volume = aggregate volume when available

The aggregation engine must be deterministic and testable.

---

# 6. History-Length Selection

After the user chooses the candle interval, Candle Lens calculates the maximum number of derived candles available from the validated base history.

Example:

```text
Base history:
48 months

Selected interval:
233 minutes

Maximum derived candles:
calculated automatically
```

The user should then be able to select how much of that available history to load.

## UI

Provide:

- percentage slider: **0–100%**
- synchronized actual candle count
- optional numeric entry/edit field if desired by the prototype

The percentage is a UX abstraction; the actual value used by the engine is the resulting candle count.

Example:

```text
0%   → 0 candles
25%  → 25% of available candles
50%  → 50%
100% → all available candles
```

### Important performance behavior

Do **not** recalculate expensive derived data on every keystroke.

Recalculation/commit occurs on:

- input blur
- Enter
- slider release

not continuously while the user is typing or dragging.

---

# 7. Initial UI Structure

The application has two top-level tabs:

```text
[ CREATE ]   [ LOAD ]
```

---

# 8. CREATE Tab

The Create workflow is progressive.

The user should not initially be confronted with every advanced option.

## Stage 1 — Data / Candle Configuration

Controls:

### Candle interval

Integer slider:

```text
1–377 minutes
```

### History size

Percentage-based selection:

```text
0–100%
```

with the resulting actual candle count shown.

### Generate Candles

The user can generate/display the selected candlestick dataset before proceeding to indicator generation.

The workflow should make it possible to inspect the candle chart without forcing the indicator calculation.

---

# 9. Indicator Configuration

Candle Lens initially supports **three main indicator slots**.

Each indicator slot has:

### Indicator type

Dropdown:

```text
MA
EMA
WMA
```

### Price-source selection

Each indicator supports multiple source selections.

Available source types:

```text
Open
High
Low
Close
```

The user may select one or multiple sources.

If multiple sources are selected, each selected source is calculated separately.

The architecture should permit future derived sources such as:

- typical price
- weighted close
- other derived price series

but those are not part of the initial required implementation.

---

# 10. Indicator Range

The indicator-period/range selector has:

### Default mode

```text
0–100
```

with a double-ended range slider.

The user can trim either side independently.

Example:

```text
10–90
```

means periods/lines below 10 and above 90 are not calculated.

### Advanced extension

A small advanced toggle expands the available range from:

```text
0–100
```

to:

```text
0–1000
```

Once expanded, the user can trim either end of the larger range.

This is intentionally an advanced feature because calculating hundreds or thousands of indicator lines can become computationally expensive.

### Important implementation detail

The displayed `0` should be treated as a **range boundary**, not automatically as an actual moving-average period.

The computational engine must validate that every actual indicator period is valid.

---

# 11. Indicator Density / Step

A step control determines how densely the indicator periods are sampled.

Conceptually:

```text
Step 1:
calculate every period

Step 2:
calculate every second period

Step 3:
calculate every third period

...
```

The step control should be restricted to valid positive values.

The UI should display the resulting number of lines before execution.

This makes the computational cost obvious.

The implementation must explicitly define whether the selected range endpoints are included so that the displayed line count and actual computation always agree.

---

# 12. Three-Way Period Selection Mode

The period-generation mode is a three-way toggle.

```text
[ Sequential ] [ Fibonacci ] [ Divisible ]
```

## Mode A — Sequential

Use the selected range and step.

Example:

```text
10–90
step 2
```

→ generate every second valid period in the range.

## Mode B — Fibonacci

Ignore the normal sequential density logic.

Generate only Fibonacci periods falling inside the selected range.

For 0–1000:

```text
1
2
3
5
8
13
21
34
55
89
144
233
377
610
987
```

The subset changes automatically according to the selected lower/upper range.

The initial implementation should use the canonical Fibonacci sequence rather than hard-coding only the larger values.

## Mode C — Divisible

Show an additional numeric input:

```text
Divisor: [ N ]
```

Only periods divisible by `N` are generated.

Example:

```text
Range: 0–1000
Divisor: 25
```

Generated periods:

```text
25, 50, 75, 100, ...
1000
```

This mode also serves as a practical debugging/performance tool for intentionally reducing the number of calculated lines.

---

# 13. Color System

Color configuration changes depending on the period-generation mode.

## Sequential mode

Provide two color pickers:

```text
Start Color
End Color
```

All generated lines receive interpolated colors between those endpoints.

For example:

```text
lowest line → color A
middle lines → interpolated colors
highest line → color B
```

## Fibonacci mode

Because the number of lines is usually small, allow:

- individual colors
- automatically assigned palette

## Divisible mode

Provide three options:

```text
Gradient
Palette
Per-line
```

### Gradient

Two colors define a continuous interpolation.

### Palette

The application automatically assigns colors from a selected/generated palette.

### Per-line

A separate color picker is shown for every generated line.

This option is intentionally available even for large line counts, but should display a warning or workload indication when the number of lines becomes impractical.

---

# 14. Rendering Mode

Before calculation, the user chooses one of two rendering modes.

```text
[ Individual Lines ]
[ Mesh / Heat Field ]
```

## Mode A — Individual Lines

Every calculated indicator is represented as its own renderable element.

This is the default transparent/debug-friendly representation.

## Mode B — Mesh / Heat Field

The system still calculates and stores the underlying individual indicator lines.

However, the initial visible result is only the combined mesh/field.

The user does not initially see all individual lines.

This allows thousands of computed relationships to be represented visually without immediately overwhelming the interface.

---

# 15. Mesh Gradient Steepness

When Mesh mode is selected, expose a gradient-steepness control.

Conceptually:

```text
Low steepness
→ smooth/continuous transitions

High steepness
→ abrupt color changes near indicator lines
```

The steepness parameter modifies the spatial influence/falloff of the line field.

This setting is a rendering parameter and should not require recalculating the underlying moving averages.

---

# 16. Pre-Calculation Confirmation

The Calculate button remains disabled until the configuration is valid.

Once valid, enable it.

Before computation begins, display a confirmation dialog.

The dialog should summarize at minimum:

```text
Asset
Candle interval
Number of candles
Indicator types
Price sources
Period range
Generation mode
Step/divisor where relevant
Number of indicator lines
Rendering mode
Estimated number of calculated data points
Estimated computation time / ETA
```

Example concept:

> This run will calculate 240 indicator lines across 125,000 candles for 233-minute candles.

The user can then:

```text
Cancel
Continue
```

---

# 17. Run / Job Model

A calculation should be treated as a persistent **run**.

A run is not just a temporary computation.

When the user confirms:

1. create the run record
2. save the complete configuration
3. calculate an estimated workload
4. begin computation
5. persist intermediate/progress state where practical
6. persist final raw results
7. persist render-ready results
8. mark the run as completed/failed/cancelled

Each run should receive a unique ID.

---

# 18. Progress UI

The calculation screen must display a progress bar based on **actual completed computation**, not elapsed time.

If:

```text
200 lines total
200 remaining
```

progress:

```text
0%
```

If:

```text
100 lines remaining
```

progress:

```text
50%
```

If:

```text
0 remaining
```

progress:

```text
100%
```

General formula:

```text
progress =
completed_lines / total_lines
```

or equivalently:

```text
progress =
1 - remaining_lines / total_lines
```

The UI should also display useful live information such as:

- lines completed
- lines remaining
- total lines
- candles processed
- elapsed time
- estimated remaining time
- current indicator/source being processed

The system must not fake an ETA. If the estimate is unreliable, display it as an estimate.

---

# 19. Database / Persistence Model

Candle Lens must preserve both the **raw computation** and the **render-ready representation**.

This is essential because a previous run should be reloadable almost instantly without recomputing everything.

## Layer 1 — Run metadata

Store:

- run ID
- creation timestamp
- completion timestamp
- asset
- data source
- source symbol
- base data range
- selected candle interval
- number of candles
- configuration
- indicator definitions
- price-source selections
- range
- step
- generation mode
- divisor if used
- rendering mode
- color configuration
- mesh steepness
- calculation statistics
- estimated workload
- actual workload
- status
- configuration fingerprint/hash

## Layer 2 — Raw computed matrix/data

Store the entire calculated numerical dataset required to reconstruct the analysis.

This is the authoritative computational result.

Do not store only rendered pixels.

The raw matrix should allow the render layer to be regenerated or restyled.

## Layer 3 — Render-ready representation

Store the coordinates / geometry / normalized values needed to display the generated elements quickly.

Examples may include:

- line coordinates
- line IDs
- period
- indicator type
- source type
- candle index/time
- normalized values
- intersection metadata
- mesh representation
- render geometry
- other renderer-specific structures

The exact representation should be chosen based on the rendering technology.

The important requirement is:

> loading an old run should require little or no indicator recomputation.

---

# 20. Recoloring Previous Runs

Because raw and render-ready data are stored separately from presentation styling, a previously calculated run should be loadable with new visual styling.

The user must be able to change:

- line colors
- gradient colors
- palette
- mesh colors
- opacity
- other presentation-level parameters

without recalculating the moving averages.

If a visual change requires actual numerical recomputation, that distinction must be explicit.

---

# 21. LOAD Tab

The Load tab presents a list of previous runs.

Each run should expose enough metadata to identify it quickly:

```text
Run ID
Date
Asset
Candle interval
Candle count
Indicator configuration
Number of lines
Render mode
Status
```

The user can select one or multiple runs.

## Multi-run loading rule

Multiple runs may be loaded together only when they use the **same candle interval**.

For example:

```text
233-minute run
233-minute run
233-minute run
```

may be loaded together.

But:

```text
233-minute run
144-minute run
```

may not be combined in the same comparison set.

The UI should prevent incompatible selections rather than allowing an invalid state.

---

# 22. Configuration Fingerprint

Every run should have a deterministic configuration fingerprint/hash.

The fingerprint should represent the configuration that materially affects the calculation.

This can be used for:

- identifying identical configurations
- preventing accidental duplicate runs
- searching/filtering old runs
- comparing runs
- detecting whether two runs are computationally equivalent

---

# 23. Result Viewer

After calculation, the full visualization is automatically displayed.

The viewer is **read-only** with respect to computational results.

The user may:

- zoom
- pan
- hover
- click
- toggle layers
- change opacity
- change colors
- select points

The user may **not edit or modify the calculated geometry/data** from the viewer.

---

# 24. Layer Controls

A small layer-management UI should be available in the viewer.

Each layer should have:

```text
Visibility toggle
Opacity slider
Color/style controls where applicable
```

Opacity is purely visual and must not cause recalculation.

This allows the user to compare multiple loaded runs or layers without regenerating data.

---

# 25. Candlestick Interaction

Each candle exposes five important snap points.

### 1. Open
### 2. High
### 3. Low
### 4. Close
### 5. Candle-body center

On hover:

- determine the nearest snap point
- visually indicate the snap target
- allow the cursor to snap to it

The fifth point is specifically the center of the candle body.

---

# 26. Point Selection / Indicator Intersection Inspection

When the user clicks one of the five snap points, the application identifies indicator lines that intersect or closely approach that exact point.

Those lines should **not** normally be displayed.

They appear as highlighted/visible overlays only after the user explicitly selects the point.

This keeps the default visualization clean.

---

# 27. Line Proximity Tolerance

The user needs control over how close an indicator line must be to a selected candle point to be considered relevant.

Use a tolerance control rather than exposing raw decimal-place logic.

Conceptually:

```text
Strict  ←────────→  Loose
```

Internally this defines the maximum acceptable distance between:

```text
selected candle point
```

and

```text
candidate indicator line
```

The tolerance must be normalized appropriately for the selected asset/price scale.

This is preferable to a fixed absolute decimal distance because BTC, altcoins, and other assets have radically different price scales.

---

# 28. Multi-Point Selection

The viewer includes a small toggle for multi-point selection.

When enabled, the user can select multiple candle snap points.

The UI should retain all selected points and present a summary of the relevant indicator relationships across those points.

For example, the system may show:

```text
Selected points: 7

Common nearby indicators:
EMA 21
MA 55
WMA 89
...
```

The exact analytical ranking can be expanded later.

The critical Part 1 requirement is that the selected points can be compared without recalculating the underlying indicator dataset.

Provide:

```text
Clear selection
```

and suitable selection feedback.

---

# 29. Indicator Overlay Behavior

For a normal viewer state:

- individual-line mode shows the configured individual lines
- mesh mode shows only the mesh initially

For mesh mode:

- underlying individual lines are still generated and stored
- they are simply hidden by default

When the user clicks a candle snap point, only the relevant indicator lines may be surfaced as overlays.

This preserves the purpose of the mesh as the uncluttered primary visualization while retaining analytical access to its underlying components.

---

# 30. Optional Intra-Candle Trade Heat Map

This is an **optional research requirement**, not a hard dependency.

The goal is to determine whether historical trade-level data is available that allows construction of a price-distribution heat map inside each candle.

Potential concept:

```text
candle vertical price range
        ↓
trade-density bins
        ↓
heat intensity
```

This could reveal cases where:

- most trading occurred near one edge of the candle
- a large burst of activity occurred at an extreme
- an apparently large candle contains very uneven trade distribution

This must only be implemented if historical trade-level data is available from the selected single source.

OHLC data alone is insufficient.

The research step should determine:

1. whether the source provides the required history
2. whether it provides enough granularity
3. whether the storage requirements are reasonable
4. whether a useful visualization can be produced

If the answer is no, the feature should be deferred rather than approximated.

---

# 31. Architecture Requirements

The implementation should be lightweight from the UI perspective but capable of performing heavy computations.

Keep the architecture separated into:

```text
Data ingestion
        ↓
Data validation
        ↓
Canonical 1-minute dataset
        ↓
Candle aggregation
        ↓
Indicator computation
        ↓
Numerical result store
        ↓
Render geometry generation
        ↓
Renderer
        ↓
Interactive viewer
```

The computation layer must not be tightly coupled to the UI.

The renderer must not be responsible for calculating indicators.

The UI must not contain the indicator mathematics.

---

# 32. Prototype Technology Direction

The first prototype should be **HTML-based**, as discussed.

The exact frontend framework is secondary to the architecture.

Priority order:

1. lightweight interaction
2. high-performance rendering
3. ability to handle large datasets
4. separation of UI and computation
5. ability to move computation off the main UI thread/process
6. easy persistence
7. replaceable renderer

Heavy calculations should not freeze the interface.

The implementation should therefore consider:

- worker/background computation
- chunked processing
- incremental persistence
- typed numerical arrays where appropriate
- efficient geometry storage
- avoiding thousands of ordinary DOM nodes for high-density visualizations

The prototype should be designed so that a future Python-based computation/dashboard layer can replace or complement the initial HTML implementation without rewriting the experimental logic.

---

# 33. Performance Philosophy

The system is explicitly allowed to perform expensive calculations.

The user has stated that even a calculation lasting approximately ten minutes is acceptable for advanced configurations.

Therefore:

**Do not sacrifice correctness merely to make every computation instant.**

Instead:

- estimate workload before execution
- show progress
- allow long-running jobs
- persist runs
- make completed runs nearly instant to reload
- avoid unnecessary recomputation
- offer sampling/debug modes through step/divisor controls

The system should optimize for **repeatable research**, not merely immediate responsiveness.

---

# 34. Expected Calculation Strategies

Because the number of candles can be large and the number of indicator periods can reach 1,000, the implementation should avoid naïvely recomputing everything from scratch.

The agent should investigate efficient algorithms for:

- MA
- EMA
- WMA

and determine appropriate computational strategies for large matrices.

The implementation should benchmark:

```text
candle count
×
number of periods
×
number of price sources
×
number of indicator types
```

The pre-run estimate should be derived from the actual selected configuration.

---

# 35. Testing Requirements

The implementation must include tests for:

### Data

- timestamp continuity
- duplicate detection
- gap detection
- malformed data
- historical boundary behavior

### Candle aggregation

- correct Open
- correct High
- correct Low
- correct Close
- correct volume aggregation
- partial/incomplete intervals

### Indicators

- MA correctness
- EMA correctness
- WMA correctness
- multiple price sources
- period-range filtering
- step filtering
- Fibonacci filtering
- divisibility filtering

### Rendering

- line coordinates match indicator values
- mesh represents the underlying lines correctly
- color interpolation
- palette assignment
- per-line colors
- steepness behavior
- opacity behavior

### Interaction

- five snap points
- hover snapping
- tolerance behavior
- line intersection detection
- multi-selection
- layer visibility

### Persistence

- save run
- reload run
- reload without recomputation
- change colors without recalculation
- load multiple compatible runs
- reject incompatible intervals

---

# 36. Suggested Run State Model

A run should have explicit status values such as:

```text
CREATED
QUEUED
RUNNING
COMPLETED
FAILED
CANCELLED
```

Progress should be independently tracked.

A failed run should preserve enough metadata to diagnose what happened.

---

# 37. Phase 1 Milestones

## Phase 1A — Data foundation

Implement:

- single source
- BTC dataset acquisition
- second high-volume dataset selection
- 1-minute historical storage
- gap validation
- 48-month/back-to-gap logic

## Phase 1B — Candle engine

Implement:

- 1–377 minute intervals
- aggregation
- candle-count calculation
- percentage history selection
- basic candlestick viewer

## Phase 1C — Indicator engine

Implement:

- MA
- EMA
- WMA
- Open/High/Low/Close sources
- three indicator slots
- range selection
- sequential mode
- Fibonacci mode
- divisible mode
- step handling

## Phase 1D — Rendering

Implement:

- individual-line renderer
- mesh/heat-field renderer
- gradient
- palette
- per-line colors
- mesh steepness

## Phase 1E — Run system

Implement:

- confirmation dialog
- workload estimation
- progress tracking
- ETA
- persistence
- raw matrix storage
- render geometry storage
- configuration fingerprint

## Phase 1F — Viewer interaction

Implement:

- zoom
- pan
- hover snapping
- five snap points
- tolerance
- click-to-reveal relevant lines
- multi-point selection
- layer toggles
- opacity sliders

## Phase 1G — Load system

Implement:

- run list
- metadata display
- single-run loading
- multiple compatible-run loading
- recoloring without recalculation

## Phase 1H — Optional research

Investigate historical trade-level data and the intra-candle heat map.

---

# 38. Future Part 2 Boundary

Part 2 is intentionally **not implemented as part of this plan**.

The architecture should leave room for future analysis involving:

- news
- external market events
- broader signal analysis
- contextual weighting
- event-driven changes
- other market structure features

The key principle is that these should be additional analytical layers rather than being mixed into the basic moving-average computation engine.

---

# 39. Research Objective

The eventual research question behind Candle Lens is:

> Can moving-average structures reveal recurring boundaries, limits, resistance/support-like behavior, or other meaningful relationships with market price?

The application should make it possible to investigate this systematically across:

- different assets
- different candle intervals
- different MA families
- different price sources
- different period ranges
- different line densities
- different historical windows

The system must not assume that a visible pattern is meaningful merely because it appears visually.

Part 1 is therefore fundamentally a **pattern-discovery and visualization instrument**.

---

# 40. Final Product Concept

At its simplest, Candle Lens should allow the user to:

```text
Choose asset
    ↓
Load maximum validated 1-minute history
    ↓
Choose candle interval (1–377 min)
    ↓
Choose history length
    ↓
Generate candles
    ↓
Choose 3 indicator configurations
    ↓
Choose price sources
    ↓
Choose period range
    ↓
Choose Sequential / Fibonacci / Divisible
    ↓
Choose step/divisor
    ↓
Choose colors
    ↓
Choose Individual / Mesh rendering
    ↓
Confirm workload
    ↓
Run calculation
    ↓
Watch real progress
    ↓
Automatically save the run
    ↓
View result
    ↓
Zoom / pan / inspect candles
    ↓
Snap to Open / High / Low / Close / Center
    ↓
Reveal nearby indicator lines
    ↓
Select multiple points
    ↓
Compare recurring indicator relationships
```

The most important architectural rule is:

> **Calculate once, save everything needed, and make the resulting experiment cheap to revisit.**

That is what allows Candle Lens to become an actual research instrument rather than a disposable charting prototype.