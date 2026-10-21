# AUREX — Automated Unified Relative-Value Engine for X-Contracts
> **From raw settlement data to cost-aware contract intelligence.**  
> *“Compare correctly. Validate honestly. Act only when the evidence survives costs.”*

[![Hackathon](https://img.shields.io/badge/Hackathon-Hack_in_Hills_'26-amber.svg)](https://hackinhills.com)
[![Problem Statement](https://img.shields.io/badge/Track-PS03_Commodity_Derivatives_Intelligence-blue.svg)](https://mcxindia.com)
[![Team](https://img.shields.io/badge/Team-LONEBYTE-slate.svg)](#team-lonebyte)
[![Tests](https://img.shields.io/badge/Vitest-60%2F60_Passed-emerald.svg)](#testing--verification)
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
 [ Official MCX Bhavcopy CSV / User Ingestion ]
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Module 01: Sourcing & Provenance      │ ➔ Multi-format date parsing, OHLC inequality checks,
 └───────────────────────────────────────┘   client-side SHA-256 hashing, localStorage caching
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

AUREX maintains strict data provenance classifications across all views:
1. **`PROTOTYPE SIMULATION`**: Calibrated deterministic simulation based on official MCX PS03 contract parameters and historical gold volatility.
2. **`PROTOTYPE SAMPLE — UNVERIFIED SOURCING`**: Bundled illustrative dataset formatted to MCX Bhavcopy schema for prototype demonstration.
3. **`USER-IMPORTED DATA — SOURCE UNVERIFIED`**: User-provided Bhavcopy CSV files ingested and validated for format and schema, but whose official origin has not been independently verified.
4. **`USER-ATTESTED SOURCE — NOT INDEPENDENTLY VERIFIED`**: Ingested datasets where the user has recorded a source assertion. *Recording an attestation does not independently verify that the file originated from MCX.*
5. **`OFFICIAL MCX DATA — SOURCE VERIFIED`**: Strictly reserved for independent, evidence-backed exchange verification.

### Akamai Edge Security & Ingestion Workflow
- **Automated Scraping Block**: Direct automated background requests to `https://www.mcxindia.com/market-data/bhavcopy` return `HTTP 403 Forbidden` (`Server: AkamaiGHost`) due to exchange bot protection.
- **Manual Ingestion Workflow**: AUREX provides a 30-second manual browser download guide in the Data Lab. Users download official Bhavcopy CSV files and upload them locally.
- **Cryptographic Fingerprinting**: Computes client-side SHA-256 hashes via Web Crypto API.
- **Browser Persistence**: Persists validated datasets across reloads using browser `localStorage` (`aurex_imported_dataset_v2`).

---

## 6. Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Visualization**: Recharts (Futures curves, Z-score bands, Drawdown underwater charts, Waterfall bridge)
- **Icons**: Lucide React
- **Test Framework**: Vitest (49 unit tests across 7 test suites)
- **Linter**: oxlint (0 errors)

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
# Run complete test suite (60 tests)
npm test

# Run linter
npm run lint

# Run production build (typecheck + minification)
npm run build

# Preview production build locally
npm run preview
```

---

## 8. Testing & Verification

AUREX contains 60 automated unit tests across 7 test suites in `src/test/`:

| Test Suite | Tests | Verification Scope |
| :--- | :---: | :--- |
| `src/test/engines.test.ts` | 17 | Normalization, spread calculation, z-score, cost waterfall, lifecycle stages, decision states |
| `src/test/round2.test.ts` | 14 | Lot size vs quote unit separation, purity scaling, CSV tokenization, duplicate detection, rejection inspector, benchmark normalization |
| `src/test/termStructure.test.ts` | 8 | Discrete expiry ordering, simple / continuous / geometric carry formulas, contango / backwardation, edge cases, roll-down decomposition identity |
| `src/test/lifecycle.test.ts` | 8 | 5-trading-day tender window vs calendar days, MCX holiday calendar exclusion, weekend detection, GOLDTEN 2025 launch date check, expired contracts, pair eligibility |
| `src/test/backtest.test.ts` | 4 | Zero look-ahead bias validation, full trade lifecycle, entry/exit cost deductions, portfolio accounting reconciliation |
| `src/test/attribution.test.ts` | 6 | Leg-level derivations (Leg A + Leg B = Gross), net reconciliation, adverse spread with rising gold market, profitable convergence during gold crash, asymmetric exposure beta isolation, single friction accounting |
| `src/test/alerts.test.ts` | 3 | Alert deduplication, state transition alerts, unread counter management |
| **Total** | **60** | **100% Passed** |

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
- **Historical Data Automation**: Automated Bhavcopy downloads are protected by MCX's Akamai Edge Security; manual CSV upload remains the supported, source-verified ingestion pathway.
