# AUREX — Automated Unified Relative-Value Engine for X-Contracts
> **From raw settlement data to cost-aware contract intelligence.**  
> *“Compare correctly. Validate honestly. Act only when the evidence survives costs.”*

[![Hackathon](https://img.shields.io/badge/Hackathon-Hack_in_Hills_'26-amber.svg)](https://hackinhills.com)
[![Problem Statement](https://img.shields.io/badge/Track-PS03_Commodity_Derivatives_Intelligence-blue.svg)](https://mcxindia.com)
[![Team](https://img.shields.io/badge/Team-LONEBYTE-slate.svg)](#team-lonebyte)
[![Tests](https://img.shields.io/badge/Vitest-78%2F78_Passed-emerald.svg)](#testing--verification)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Checked-blue.svg)](#tech-stack)
[![Deployment](https://img.shields.io/badge/Live_Deployment-aurex--swart.vercel.app-emerald.svg)](https://aurex-swart.vercel.app)

---

## 1. Executive Summary & Problem Statement (PS03)

On the **Multi Commodity Exchange of India (MCX)**, four distinct futures contracts represent the same underlying physical gold metal:
- **GOLDM (Gold Mini)**
- **GOLDTEN (Gold 10 Grams)**
- **GOLDGUINEA (Gold Guinea 8 Grams)**
- **GOLDPETAL (Gold Petal 1 Gram)**

### The Core Problem: Same Metal Does Not Mean Same Contract Economics
Naively comparing raw settlement marks across these contracts produces false arbitrage illusions due to four structural heterogeneities:

1. **Heterogeneous Lot Sizes & Quotation Units**:
   - `GOLDM`: Trades in **100g lots**, quoted in **₹ per 10g**.
   - `GOLDTEN`: Trades in **10g lots**, quoted in **₹ per 10g**.
   - `GOLDGUINEA`: Trades in **8g lots**, quoted in **₹ per 8g**.
   - `GOLDPETAL`: Trades in **1g lots**, quoted in **₹ per 1g**.
2. **Purity Mismatches**:
   - `GOLDM` settles on a **995 fineness** standard (Ahmedabad/Mumbai delivery basis).
   - `GOLDTEN`, `GOLDGUINEA`, and `GOLDPETAL` settle on **999 fine gold purity**.
3. **Discrete Expiry Horizons & Calendar Asynchrony**:
   - Contracts expire on discrete calendar schedules (e.g. 5th of the month vs end of the month), introducing carry cost, financing differentials, and mechanical roll-down dynamics.
4. **Execution Friction, Liquidity Asymmetry & Delivery Obligations**:
   - Retail contracts (`GOLDPETAL`, `GOLDGUINEA`) exhibit significantly shallower order-book depth and wider bid-ask spreads than institutional `GOLDM`.
   - All MCX gold futures are **Compulsory Physical Delivery** contracts with a mandatory **5-day tender window** carrying delivery margins (up to 25%) and severe delivery failure penalties.

**AUREX** solves these challenges by transforming heterogeneous exchange quotations into a common economic basis, analyzing multi-expiry futures term structures and implied carry yields, screening for liquidity bottleneck constraints, deducting comprehensive transaction costs, enforcing strict contract lifecycle rules, and validating strategy performance through zero look-ahead walk-forward backtesting.

---

## 2. Core Architecture & System Pipeline

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AUREX ANALYTICAL PIPELINE                       │
└────────────────────────────────────────────────────────────────────────┘
 [ User-Ingested Bhavcopy CSV / Prototype Simulation ]
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 01: Sourcing & Provenance      │ ➔ Multi-format date parsing, OPTFUT option quarantine,
 └───────────────────────────────────────┘   multi-date accumulation, SHA-256 fingerprinting, browser localStorage
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 02: Precision Normalization    │ ➔ Standardizes to ₹ / 10g @ 999 purity basis:
 └───────────────────────────────────────┘   Price_norm = Raw × (10/Q) × (999/P)
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 03: Term Structure & Carry     │ ➔ Discrete futures curves, simple & compounded carry,
 └───────────────────────────────────────┘   constant-maturity interpolation, roll-down decomposition
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 04: Contract Comparability     │ ➔ Calendar mismatch detection (DTE), basis screening,
 └───────────────────────────────────────┘   MCX 5-day compulsory delivery tender window enforcement
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 05: Relative-Value Analytics   │ ➔ Aligned spread S_t, trailing mean, volatility,
 └───────────────────────────────────────┘   Z-Score dislocation bands, and interpretation panel
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 06: Liquidity & Cost Hurdle    │ ➔ Bottleneck leg volume/OI score, itemized frictions:
 └───────────────────────────────────────┘   slippage, brokerage, STT/GST, haircut, margin buffer
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 07: Edge Survival Ledger       │ ➔ 8-stage auditable ledger: Opportunity ➔ Surviving Edge
 └───────────────────────────────────────┘   Strict accounting reconciliation (Net = Gross - Costs)
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 08: Walk-Forward Backtester    │ ➔ Zero look-ahead simulation, 100g physical gold exposure
 └───────────────────────────────────────┘   matching, MTM equity curves, closed trade ledger
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 09: Trader Intelligence & Gate │ ➔ 3-State Verdict: ACTIONABLE | WATCH | NO TRADE
 └───────────────────────────────────────┘   Internal deduplicated alert drawer & notification bell
```

---

## 3. Authoritative Contract Specifications

Authoritative contract specifications based on MCX circulars (including MCX Circular No. `MCX/TRD/134/2025` for GOLDTEN):

| Contract Symbol | Trading Lot | Quotation Unit ($Q$) | Fineness ($P$) | Unit Multiplier ($10/Q$) | Purity Multiplier ($999/P$) | Effective Scaling Factor | Settlement Mode | Tender Period Window |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **GOLDM** | 100 g | ₹ per 10 g | 995 ‰ | $\times 1.0000$ | $\times 1.004020$ | $\mathbf{1.004020}$ | Compulsory Physical Delivery | 5 Trading Days |
| **GOLDTEN** | 10 g | ₹ per 10 g | 999 ‰ | $\times 1.0000$ | $\times 1.000000$ | $\mathbf{1.000000}$ | Compulsory Physical Delivery | 5 Trading Days |
| **GOLDGUINEA** | 8 g | ₹ per 8 g | 999 ‰ | $\times 1.2500$ | $\times 1.000000$ | $\mathbf{1.250000}$ | Compulsory Physical Delivery | 5 Trading Days |
| **GOLDPETAL** | 1 g | ₹ per 1 g | 999 ‰ | $\times 10.0000$ | $\times 1.000000$ | $\mathbf{10.000000}$ | Compulsory Physical Delivery | 5 Trading Days |

### Mathematical Normalization Benchmark
All contract prices are converted to the standard benchmark: **₹ per 10 grams @ 999 purity**:
$$\text{Price}_{\text{norm}} = \text{Raw Close} \times \left(\frac{10}{\text{Quote Unit (g)}}\right) \times \left(\frac{999}{\text{Purity (‰)}}\right)$$

**Benchmark Normalization Examples**:
- **GOLDTEN**: $\text{normalizePrice}(74500, 10, 999) = 74500 \times \left(\frac{10}{10}\right) \times \left(\frac{999}{999}\right) = \mathbf{74,500.00}$
- **GOLDM**: $\text{normalizePrice}(74500, 10, 995) = 74500 \times \left(\frac{10}{10}\right) \times \left(\frac{999}{995}\right) \approx \mathbf{74,799.50}$
- **GOLDGUINEA**: $\text{normalizePrice}(59600, 8, 999) = 59600 \times \left(\frac{10}{8}\right) \times \left(\frac{999}{999}\right) = \mathbf{74,500.00}$
- **GOLDPETAL**: $\text{normalizePrice}(7450, 1, 999) = 7450 \times \left(\frac{10}{1}\right) \times \left(\frac{999}{999}\right) = \mathbf{74,500.00}$

---

## 4. Analytical Modules & Quantitative Methodology

### A. Term Structure, Futures Curves & Implied Carry
- **Discrete Futures Curves**: Plots normalized observed prices against actual Days to Expiry (DTE) for discrete expiries (Near, Next, Far).
- **Annualized Simple Carry**:
  $\text{Carry}_{\text{simple}} = 100 \times \left(\frac{F}{S} - 1\right) \times \left(\frac{365}{\Delta D}\right)$
- **Annualized Continuously Compounded Carry**:
  $\text{Carry}_{\text{continuous}} = 100 \times \ln\left(\frac{F}{S}\right) \times \left(\frac{365}{\Delta D}\right)$
- **Annualized Geometric Compounding (Mathematically Distinct)**:
  $\text{Carry}_{\text{geometric}} = 100 \times \left[\left(\frac{F}{S}\right)^{\frac{365}{\Delta D}} - 1\right]$
  *Note: Continuous compounding uses the natural logarithm $\ln(F/S)$, producing slightly lower values than simple carry in contango, whereas geometric compounding models discrete exponential multi-period compounding.*
- **Constant-Maturity Linear Interpolation**: Reference prices for standard tenors (7D, 14D, 30D, 60D) interpolated strictly within observable bounds. Tenors requiring extrapolation beyond the farthest expiry are explicitly flagged as `OUT_OF_RANGE`.
- **Roll-Down vs. Curve Shift Decomposition**:
  $$\Delta P_{\text{total}} = \text{Mechanical Roll-Down} + \text{Curve Shift}$$

### B. Walk-Forward Backtesting Engine
- **Strict Chronological Simulation**: Iterates day-by-day forward in time ($t_0 \to T$).
- **Zero Look-Ahead Bias**: Parameter calibration uses exclusively $[t - \text{warmUpDays}, t - 1]$. Future prices, volume, or expiries never leak into decision time $t$ (verified by regression test).
- **Physical Gold Exposure Matching**: Spread legs are exposure-matched on a **100g physical gold basis** (e.g. 1 lot GOLDM $\leftrightarrow$ 10 lots GOLDTEN $\leftrightarrow$ 100 lots GOLDPETAL), preventing directional exposure imbalance.
- **Trade Lifecycle**: Models entry triggers, maximum holding period limits, target convergence exit, stop-loss exit, and mandatory tender window forced exit.
- **Cost Accounting**: Deducts itemized slippage, brokerage, STT, and exchange taxes on both entry and exit legs.

### C. Performance Attribution & Accounting Reconciliation
- **Factor Attribution**: Decomposes total trading performance into:
  1. Directional Gold Market Beta drift.
  2. Relative-Value Spread Convergence Alpha.
  3. Mechanical Carry Accrual.
  4. Execution Friction Deductions.
- **Leg-Level Accounting Identity**:
  $\text{Gross Realized P\&L} \equiv \text{Leg A P\&L} + \text{Leg B P\&L}$
  $\text{Net Realized P\&L} \equiv \text{Gross Realized P\&L} - \text{Total Friction Costs}$
- **Economic Factor Decomposition**:
  $\text{Gross Realized P\&L} = \text{Relative-Value Spread Alpha} + \text{Directional Gold Beta} + \text{Residual (0.00)}$
  Where directional beta is isolated from net unhedged physical exposure ($Q_{\text{net}} \times \Delta M$), preventing directional gold price appreciation from being falsely claimed as strategy alpha.
  The engine verifies $|\text{discrepancy}| \le 0.05$ and surfaces a `VERIFIED (0 Residue)` status badge in the UI.
- **Waterfall Bridge**: Recharts bar chart decomposing Gross Realized Spread P&L $\to$ Slippage $\to$ Brokerage & Taxes $\to$ Liquidity Haircut $\to$ Safety Buffer $\to$ Net Realized P&L.

### D. Contract Lifecycle & Compulsory Delivery Tender Intelligence
- Enforces official MCX delivery specifications across all contracts.
- **5-Trading-Day Tender Window Enforcement**: Strictly prohibits opening new spread positions within **5 trading days** (excluding weekends and MCX gazetted holidays via `exchangeCalendar`) prior to contract expiry. Because holidays and weekends fall between entry and expiry, 5 trading days may span 7–8 calendar days. Forces simulated liquidation of active trades entering tender to eliminate compulsory delivery allocation, delivery margin escalation (up to 25%), and physical default penalties under MCX Circular No. `MCX/TRD/134/2025`.
- **Listing Effective Dates**: Automatically checks contract inception dates (e.g. GOLDTEN launch effective `2025-04-01`).

### E. Trader Intelligence & Alert Center
- **3-State Gate Decision System**:
  - `ACTIONABLE / EXECUTE` (Green): Positive net edge surviving all costs, passing liquidity filters.
  - `WATCH / MONITOR` (Amber): Spread dislocation present but edge degraded by friction or wide spreads.
  - `NO TRADE / STAND ASIDE` (Rose): Dislocation fails cost hurdle, tender window blocked, or liquidity score below threshold.
- **Deduplicated Alert Manager**: In-app notification center tracking state transitions, tender warnings, and cost hurdle alerts with timestamping and rule traceability.

---

## 5. Data Provenance & Ingestion Safeguards

AUREX enforces an uncompromised, honest data provenance framework across all views, calculations, and backtests:

1. **`PROTOTYPE SIMULATION`**: Calibrated deterministic simulation based on official MCX PS03 contract parameters and historical gold volatility. Disclosed clearly as synthetic demo data; must never be presented as genuine historical exchange observations.
2. **`PROTOTYPE SAMPLE — UNVERIFIED SOURCING`**: Bundled 108-row illustrative dataset formatted to the MCX Bhavcopy schema for prototype demonstration and testing.
3. **`USER-IMPORTED DATA — SOURCE UNVERIFIED`**: User-provided Bhavcopy CSV files ingested and validated for schema, date formats, and OHLC coherence. *A CSV imported by a user does NOT automatically become independently verified official data.*
4. **`USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED`**: Ingested datasets where the user has recorded a source assertion. *Recording an attestation is a user assertion and does NOT constitute independent official verification inside AUREX.*
5. **`OFFICIAL MCX DATA — SOURCE VERIFIED`**: Strictly reserved for authenticated, cryptographically verified exchange settlement feeds where independent official source confirmation exists.


### Empirical MCX Bhavcopy Dataset Coverage & Verification Audit

An empirical audit of actual files downloaded from the official MCX Bhavcopy portal (`https://www.mcxindia.com/market-data/bhavcopy`) was conducted:

| Filename | File Size | SHA-256 Digest | Line Count | Trading Date | Supported Futures Rows | Option / Other Rows | Deduplication Status |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| `BhavCopyDateWise_20102026.csv` | 22.8 KB | `61774232ae2337bf94af47eb57edbfdd0a3f4268e2bc46265c51b901db8f88ad` | 169 | 20-Oct-2026 | 24 (6 per contract) | 144 non-gold futures | First authentic date |
| `BhavCopyDateWise_22102026.csv` | 2.00 MB | `fede0baa182d4a34ffa09a1e4700b048172c04f362cba7926b6cb04cb7d6d3c5` | 16,237 | 21-Oct-2026 | 24 (6 per contract) | 16,212 (748 options + 15,464 other) | Second authentic date |
| `BhavCopyDateWise_21102026.csv` | 2.00 MB | `fede0baa182d4a34ffa09a1e4700b048172c04f362cba7926b6cb04cb7d6d3c5` | 16,237 | 21-Oct-2026 | 24 | 16,212 | Identical duplicate of `22102026.csv` |
| `BhavCopyDateWise_13102026.csv` | 2.00 MB | `fede0baa182d4a34ffa09a1e4700b048172c04f362cba7926b6cb04cb7d6d3c5` | 16,237 | 21-Oct-2026 | 24 | 16,212 | Redundant export of preloaded 21-Oct date |

**Coverage & Integrity Findings**:
1. **Authentic Coverage**: Exactly **2 distinct trading sessions** (20-Oct & 21-Oct-2026), yielding **48 valid historical futures observations** across the four contracts (`GOLDM`, `GOLDTEN`, `GOLDGUINEA`, `GOLDPETAL`) across 6 expiries.
2. **Quarantine Verification**: 0 option rows leaked into the futures dataset; all 748 `OPTFUT` option records (including the suspicious ₹9,503.50 and ₹957.00 strike premia) were correctly quarantined.
3. **Statistical Sample Size Caveat**: With 2 authentic trading dates, the walk-forward backtester (which requires $\ge 15$ warm-up sessions for rolling $\mu, \sigma$ calibration) explicitly returns **0 trades** and surfaces a **Sample Size Limitation Notice**. AUREX refuses to invent synthetic data or claim that 2 dates validate strategy profitability.
4. **Target of 60 Sessions**: Accumulating the 60-session historical validation target requires downloading the remaining daily Bhavcopy CSV files from the MCX archive using the Data Lab instructions. The multi-date accumulator preserves all past dates deterministically in browser `localStorage`.

### Key Data Integrity & Architecture Disclosures
- **No Automatic Official Verification**: Manual download of a Bhavcopy file from `https://www.mcxindia.com/market-data/bhavcopy` provides real-world context, but uploading the CSV into AUREX does **not** independently verify that the file originated from MCX. AUREX operates without a trusted custodial verification authority; all user-uploaded datasets remain classified as `USER-IMPORTED DATA — SOURCE UNVERIFIED`.
- **Client-Side Persistence Scope**: Validated market observations are stored locally in the user's browser via `localStorage` (`aurex_imported_dataset_v2`). Browser-local data does **not** automatically synchronize to another browser, device, or user. Clearing browser local storage cleanly reverts the active workspace to the deterministic prototype simulation.
- **Provenance Transparency in Analytics**: All analytical modules—including Term Structure curves, Relative-Value Z-scores, Cost Waterfalls, Walk-Forward Backtesting, and Attribution—conspicuously display the active dataset's provenance classification and limitations. Backtest and ledger results must be evaluated in the context of their underlying dataset provenance.
- **Akamai Edge Security Disclosure**: Multi Commodity Exchange of India (MCX) protects its market data portals using Akamai Edge Security / Bot Manager. Direct automated background requests (via `curl`, python `requests`, or headless scrapers) return `HTTP 403 Forbidden` (`Server: AkamaiGHost`). AUREX guides users through manual browser downloads to inspect real market data in the Data Lab.
- **Deterministic Multi-Date Accumulation**: The import engine dynamically accumulates distinct trading dates into a continuous historical time series (e.g., sequentially importing 20-Oct and 21-Oct yields a multi-day dataset).
- **Duplicate Idempotency**: Re-importing the same CSV or redundant date records is strictly idempotent—existing identical observations are detected via natural composite keys (`symbol_date_expiryDate`) and skipped without inflating observation counts.
- **Conflict Prevention (Anti-Tamper)**: If an incoming file contains records with matching contract expiries but divergent settlement prices, AUREX halts ingestion, flags the conflicting fields, and prevents silent overwriting.
- **Strict FUTCOM vs. OPTFUT Quarantining**: To eliminate false observations, the parser validates contract specification metadata, admitting genuine `FUTCOM` commodity futures while strictly quarantining `OPTFUT` options (identified via non-empty option types `CE`/`PE` or positive strike prices) without using arbitrary price heuristics.
- **Client-Side Cryptographic Fingerprinting**: Computes SHA-256 digests via the Web Crypto API to ensure file traceability and verifiable checksum records.

---

## 6. Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Visualization**: Recharts (Futures curves, Z-score bands, Drawdown underwater charts, Waterfall bridge)
- **Icons**: Lucide React
- **Test Framework**: Vitest (71 unit tests across 8 test suites, 100% passing)
- **Linter**: oxlint (0 errors, 103 non-blocking warnings)

---

## 7. Quick Start & Local Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation & Launch
```bash
# Clone the repository
git clone https://github.com/vedantpatil-2007/Aurex.git
cd Aurex

# Install dependencies
npm install

# Run development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Available Scripts
```bash
# Run complete test suite (71 tests across 8 test suites)
npm test

# Run linter (oxlint)
npm run lint

# Run production build (typecheck + minification)
npm run build

# Preview production build locally
npm run preview
```

---

## 8. Testing & Verification

AUREX contains 78 automated unit tests across 8 test suites in `src/test/`:

| Test Suite | Tests | Verification Scope |
| :--- | :---: | :--- |
| `src/test/engines.test.ts` | 17 | Normalization, spread calculation, z-score, cost waterfall, lifecycle stages, decision states |
| `src/test/round2.test.ts` | 14 | Lot size vs quote unit separation, purity scaling, CSV tokenization, duplicate detection, rejection inspector, benchmark normalization |
| `src/test/bhavcopyAudit.test.ts` | 11 | OPTFUT option quarantining without price thresholds, FUTCOM acceptance, multi-date accumulation, idempotency, conflict detection, demo separation, GOLDGUINEA 999 purity, authentic MCX multi-date integration |
| `src/test/termStructure.test.ts` | 8 | Discrete expiry ordering, simple / continuous / geometric carry formulas, contango / backwardation, edge cases, roll-down decomposition identity |
| `src/test/lifecycle.test.ts` | 9 | 5-trading-day tender window vs calendar days, MCX holiday calendar exclusion, weekend detection, GOLDTEN 2025 launch date check, expired contracts, pair eligibility, missing/invalid expiry metadata |
| `src/test/attribution.test.ts` | 7 | Leg-level derivations (Leg A + Leg B = Gross), net reconciliation, adverse spread with rising gold market, profitable convergence during gold crash, asymmetric exposure beta isolation, single friction accounting, invalid/missing input defensibility |
| `src/test/backtest.test.ts` | 6 | Zero look-ahead bias validation, extreme future shock resilience, insufficient sample size warnings, full trade lifecycle, entry/exit cost deductions, portfolio accounting reconciliation |
| `src/test/alerts.test.ts` | 6 | Alert deduplication, signal generation, signal downgrade/invalidation state transition, tender window critical lifecycle alerts, empty dataset anomaly alerts, unread counter management |
| **Total** | **78** | **100% Passed (8 Suites, 0 Failures)** |

Execute the suite:
```bash
npm test
```

---

## 9. Responsive UI & Viewport Verification

All views are fully responsive and verified across key device viewports:
- **Mobile (375 × 812)**: Collapsible hamburger drawer, stacked metric cards, horizontally scrollable data tables.
- **Tablet (768 × 1024)**: Responsive 2-column grid layouts, touch-friendly tab navigation.
- **Laptop (1366 × 768)**: Standard side-by-side analytical panels, responsive chart containers.
- **Desktop (1920 × 1080)**: Full-width data tables, multi-metric performance dashboard cards.

---

## 10. Team LONEBYTE

| Name | Role | Responsibilities |
| :--- | :--- | :--- |
| **Vedant Patil** | Lead Quantitative Systems Builder & Full-Stack Engineer | Analytical engines, term structure, backtesting simulation, CSV parser, system architecture |
| **Dhanashree Vaze** | Quantitative Research & Domain Analysis | MCX derivative contract specifications, tender window delivery rules, carry mathematics |
| **Vedashree Mhatre** | Financial Systems & Verification | Edge Survival Ledger audit trails, accounting identity verification, walk-forward test integrity |

---

## 11. Known Limitations & Future Work

- **Live Order Book Depth**: Daily Bhavcopy data provides trade volumes and open interest as liquidity proxies. Tick-by-tick order book depth (L2/L3) requires direct exchange co-location or broker WebSocket API access.
- **External Webhooks**: In a pure client-side SPA, direct external webhook firing would expose webhook URLs and authorization tokens in browser network traffic. External notifications require a dedicated authenticated backend relay proxy.
- **Historical Data Ingestion & Provenance Scope**: Automated Bhavcopy downloads are blocked by MCX's Akamai Edge Security; manual browser download and local CSV upload is the supported user ingestion pathway. Ingested datasets are stored in browser `localStorage` and classified as `USER-IMPORTED DATA — SOURCE UNVERIFIED`. Manual upload does not constitute independent official exchange verification.
