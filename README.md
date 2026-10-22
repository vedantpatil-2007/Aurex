# AUREX — Automated Unified Relative-Value Engine for X-Contracts
> **From raw settlement data to cost-aware commodity contract intelligence.**<br />
> *“Compare correctly. Validate honestly. Act only when the evidence survives costs.”*

[![Team](https://img.shields.io/badge/Team-LONEBYTE-slate.svg)](#15-team-lonebyte)
[![Tests](https://img.shields.io/badge/Vitest-140%2F140_Passed-emerald.svg)](#9-testing--verification)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Checked-blue.svg)](#4-technology-stack)
[![Linter](https://img.shields.io/badge/oxlint-0_Errors-emerald.svg)](#9-testing--verification)
[![Live Deployment](https://img.shields.io/badge/Production-aurex--swart.vercel.app-emerald.svg)](https://aurex-swart.vercel.app)

---

## 1. Project Overview

On the **Multi Commodity Exchange of India (MCX)**, four distinct futures contracts reflect the same underlying physical bullion asset:
- **GOLDM** (Gold Mini)
- **GOLDTEN** (Gold 10 Grams)
- **GOLDGUINEA** (Gold Guinea 8 Grams)
- **GOLDPETAL** (Gold Petal 1 Gram)

### The Problem: Same Metal Does Not Mean Same Contract Economics
Naively comparing raw settlement marks across these contracts creates false arbitrage illusions due to four structural heterogeneities:

1. **Heterogeneous Lot Sizes & Quotation Units**:
   - `GOLDM`: Trades in 100g lots, quoted in ₹ per 10g.
   - `GOLDTEN`: Trades in 10g lots, quoted in ₹ per 10g.
   - `GOLDGUINEA`: Trades in 8g lots, quoted in ₹ per 8g.
   - `GOLDPETAL`: Trades in 1g lots, quoted in ₹ per 1g.
2. **Purity Mismatches**:
   - `GOLDM` settles on a **995 fineness** standard (Ahmedabad/Mumbai delivery basis).
   - `GOLDTEN`, `GOLDGUINEA`, and `GOLDPETAL` settle on **999 fine gold purity**.
3. **Discrete Expiry Horizons & Calendar Asynchrony**:
   - Contracts expire on discrete calendar schedules (e.g. 5th of the month vs end of the month), introducing carry cost, financing differentials, and mechanical roll-down dynamics.
4. **Execution Friction, Liquidity Asymmetry & Delivery Obligations**:
   - Retail contracts (`GOLDPETAL`, `GOLDGUINEA`) exhibit significantly shallower order-book depth and wider bid-ask spreads than institutional `GOLDM`.
   - All MCX gold futures are **Compulsory Physical Delivery** contracts with a mandatory **5-day tender window** carrying delivery margins (up to 25%) and severe delivery failure penalties.

**AUREX** solves these challenges by transforming heterogeneous exchange quotations into a common economic benchmark (₹ / 10g @ 999 purity), analyzing multi-expiry futures term structures and implied carry yields, screening for liquidity bottleneck constraints, deducting comprehensive transaction costs, enforcing strict contract lifecycle rules, and validating strategy performance through zero look-ahead walk-forward backtesting.

---

## 2. Core Capabilities

AUREX is organized into eight integrated quantitative modules:

1. **Contracts Universe & Term Structure**: Inspects structural specifications, discrete expiry horizons, and multi-tenor implied carry rates across MCX gold contracts.
2. **Precision Normalization**: Converts raw exchange prices into an economically comparable benchmark basis: ₹ per 10 grams at 999 fineness.
3. **Relative-Value Analytics**: Calculates contemporaneous spread series $S_t$, single-provenance baseline mean $\mu$, dispersion $\sigma$, and statistical $Z$-score dislocation bands.
4. **Quantitative Validation**: Runs chronological walk-forward out-of-sample backtests with zero look-ahead bias and parameter warm-up quarantines.
5. **Edge Survival Ledger**: A signature 8-stage auditable ledger decomposing observed relative-value opportunities down to net surviving edge after all fees, slippage, and haircut penalties.
6. **Cost Waterfall & Stress Lab**: Models two-legged bid-ask crossing slippage, exchange turnover fees, STT/GST, liquidity haircuts, and safety buffers.
7. **Decision Engine**: Cost-gated execution pipeline enforcing **Gate 0** data-sufficiency rules to prevent unsupported actionable signals on uncalibrated single-day observations.
8. **Data Lab & Provenance Registry**: Multi-format CSV ingestion, OPTFUT option quarantining, composite-key deduplication, SHA-256 digest auditing, and 3-mode provenance isolation.

---

## 3. Architecture & Data Flow

### Directory Structure

```
aurex/
├── public/                     # Static assets (favicons, SVG icons)
├── src/
│   ├── assets/                 # Brand assets
│   ├── components/             # Reusable UI presentation components
│   │   ├── backtest/           # BacktestDashboard & performance visualizers
│   │   ├── cards/              # MetricCard, CentralDecisionCard, DecisionBadge
│   │   ├── charts/             # SpreadTimeSeriesChart, ZScoreBandsChart, etc.
│   │   ├── common/             # DataHealthPanel & shared badges
│   │   ├── contracts/          # ExpiryTimelineVisual, ContractComparabilityCard
│   │   ├── decision/           # FrictionSliders, CostWaterfallChart, StressLab
│   │   ├── guide/              # ProductArchitectureFlow, StartHereGuide
│   │   ├── layout/             # Header, Sidebar, PrototypeBanner
│   │   ├── ledger/             # EdgeSurvivalLedger 8-stage visualizer
│   │   ├── tables/             # ContractUniverseTable, ContractSnapshotTable
│   │   └── termStructure/      # FuturesCurveCard & carry yield views
│   ├── data/                   # Authoritative contract metadata & seed data
│   │   ├── contracts.ts        # Specifications, delivery rules, lot sizes
│   │   ├── sampleOfficialBhavcopy.ts # Illustrative reference records
│   │   ├── seedMarketData.ts   # Calibrated prototype simulation data
│   │   └── team.ts             # Authoritative LONEBYTE team roster
│   ├── engines/                # Pure mathematical & analytical engines
│   │   ├── alertEngine.ts      # Deduplicated notification management
│   │   ├── attributionEngine.ts# Performance attribution & accounting identity
│   │   ├── backtestEngine.ts   # Walk-forward backtester (zero look-ahead)
│   │   ├── comparabilityEngine.ts # Maturity & calendar alignment
│   │   ├── dataSufficiencyEngine.ts # Sample-size capability gates
│   │   ├── decisionEngine.ts   # 3-state cost & Gate 0 execution pipeline
│   │   ├── ledgerEngine.ts     # 8-stage Edge Survival Ledger builder
│   │   ├── lifecycleEngine.ts  # Compulsory delivery tender window rules
│   │   ├── liquidityCostEngine.ts # Composite liquidity score & friction waterfall
│   │   ├── normalizationEngine.ts # Precision unit & purity normalization
│   │   ├── relativeValueEngine.ts # Spread, active contract selector, Z-score
│   │   ├── termStructureEngine.ts # Carry yields & roll-down decomposition
│   │   └── validationEngine.ts # Walk-forward window generator
│   ├── pages/                  # Top-level view modules (Overview, DataLab, etc.)
│   ├── services/               # State & IO services
│   │   ├── csvParserService.ts # Stream tokenization, OPTFUT quarantine, merge
│   │   └── marketDataService.ts# Central dataset repository & 3-mode manager
│   ├── test/                   # Automated Vitest suites (140 tests across 11 files)
│   ├── types/                  # Authoritative TypeScript domain interfaces
│   └── utils/                  # Formatting, calendar, and data quality helpers
├── .env.example                # Safe environment variable template
├── .gitignore                  # Git ignore rules (logs, dist, node_modules, .env)
├── .oxlintrc.json              # oxlint linter configuration
├── index.html                  # HTML entry point
├── package.json                # Project manifest & dependency declarations
├── vite.config.ts              # Vite configuration with React plugin
└── tsconfig.json               # TypeScript project reference configuration
```

### End-to-End Analytical Data Flow

```
[ MCX Bhavcopy CSV / Simulation ]
               │
               ▼
   [ csvParserService ] ──► Quarantines OPTFUT, cleans tokens, validates schema
               │
               ▼
  [ marketDataService ] ──► Mode isolation (ALL | PROTOTYPE | IMPORTED), localStorage
               │
               ├─────────────────────────────────────────┐
               ▼                                         ▼
   [ normalizationEngine ]                    [ comparabilityEngine ]
   ₹ / 10g @ 999 fineness                     DTE & Tender Window Check
               │                                         │
               ├─────────────────────────────────────────┘
               ▼
   [ relativeValueEngine ] ──► getActiveObservation (near-month liquidity heuristic)
               │               calculateSpread, single-provenance calculateZScore
               │
               ├────────────────────────┬────────────────────────┐
               ▼                        ▼                        ▼
     [ decisionEngine ]       [ ledgerEngine ]         [ backtestEngine ]
     Gate 0 Sufficiency       8-Stage Audit Ledger     Walk-Forward (zero look-ahead)
     Hurdle & Liquidity       Gross ➔ Friction ➔ Net   MTM Curves & Accounting Bridge
               │                        │                        │
               └────────────────────────┼────────────────────────┘
                                        ▼
                             [ Central Decision View ]
                        ACTIONABLE | WATCH | NO TRADE
```

---

## 4. Technology Stack

Verified from project dependency manifests (`package.json`, `package-lock.json`):

- **Core Framework**: React 19 (`react` ^19.2.8, `react-dom` ^19.2.8)
- **Language**: TypeScript (~6.0.2) in strict mode
- **Bundler & Dev Server**: Vite (^8.3.0) with `@vitejs/plugin-react` (^6.1.1)
- **Styling**: Tailwind CSS (^3.4.17) with PostCSS (^8.4.49) & Autoprefixer (^10.4.20)
- **Visualization**: Recharts (^3.10.1) for futures curves, spread time series, Z-score bands, and waterfall bridges
- **Icons**: Lucide React (^1.53.0)
- **Test Runner**: Vitest (^2.1.8)
- **Static Analysis**: oxlint (^1.81.0)

---

## 5. Prerequisites

- **Node.js**: v18.0.0 or higher (Node 20+ LTS recommended)
- **Package Manager**: npm (v9 or higher)
- **Modern Web Browser**: Chrome, Edge, Firefox, or Safari supporting modern ECMAScript and Web Crypto API

---

## 6. Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/vedantpatil-2007/Aurex.git
cd Aurex
npm install
```

---

## 7. Local Execution

### Development Server
```bash
npm run dev
```
Starts the local development server at `http://localhost:5173`. Supports instant Hot Module Replacement (HMR).

### Production Build
```bash
npm run build
```
Executes TypeScript compilation (`tsc -b`) followed by Vite production bundling. Output is generated in `dist/`.

### Preview Production Build
```bash
npm run preview
```
Serves the locally built `dist/` directory at `http://localhost:4173` for testing.

---

## 8. Environment Configuration

AUREX is a client-side quantitative decision-support system. No secret API keys, database credentials, or server tokens are required.

A safe template is provided in `.env.example`:

```bash
# Copy example configuration if needed
cp .env.example .env
```

| Variable | Description | Required? | Default |
| :--- | :--- | :---: | :--- |
| `VITE_APP_TITLE` | Application title display | Optional | `AUREX` |
| `VITE_ENABLE_ANALYTICS` | Client analytics flag | Optional | `false` |

---

## 9. Testing & Verification

AUREX maintains 140 automated unit and regression tests across 11 test suites:

```bash
# Run Vitest test suite
npm test

# Run linter
npm run lint

# Run TypeScript compiler check
npx tsc -b

# Verify formatting and whitespace
git diff --check
```

### Test Suite Inventory

| Test Suite | Tests | Verification Scope |
| :--- | :---: | :--- |
| `src/test/crossModuleIntegrity.test.ts` | 22 | Boundary tiers (1, 2, 4, 5, 15 sessions), Gate 0 enforcement, near-month contract selection, Ledger reconciliation, deterministic reproducibility |
| `src/test/provenanceIsolation.test.ts` | 20 | 3-mode data isolation (`ALL`, `PROTOTYPE_ONLY`, `IMPORTED_ONLY`), statistical boundary quarantine, mode switching |
| `src/test/engines.test.ts` | 17 | Core normalization, spread calculation, Z-score, cost waterfall, lifecycle stages, decision states |
| `src/test/bhavcopyAudit.test.ts` | 17 | OPTFUT option quarantining without arbitrary price cuts, FUTCOM acceptance, multi-date accumulation, idempotency, conflict detection |
| `src/test/masterRepairs.test.ts` | 14 | Formula precision, contract comparability, carry yield mathematics, date synchronization |
| `src/test/round2.test.ts` | 14 | Lot size vs quote unit separation, purity scaling, CSV tokenization, duplicate detection, rejection inspector |
| `src/test/lifecycle.test.ts` | 9 | 5-trading-day tender window vs calendar days, MCX holiday calendar exclusion, weekend detection, GOLDTEN launch date check |
| `src/test/termStructure.test.ts` | 8 | Discrete expiry ordering, simple / continuous / geometric carry formulas, contango / backwardation, roll-down decomposition |
| `src/test/attribution.test.ts` | 7 | Leg-level derivations (Leg A + Leg B = Gross), net reconciliation, factor decomposition (Beta vs Alpha), zero residue |
| `src/test/alerts.test.ts` | 6 | Alert deduplication, signal generation, signal downgrade state transition, tender window critical lifecycle alerts |
| `src/test/backtest.test.ts` | 6 | Zero look-ahead bias validation, sample size limitation warnings, trade lifecycle, cost accounting |
| **Total** | **140** | **100% Passed (11 Suites, 0 Failures)** |

---

## 10. Quantitative Methodology

### A. Economic Normalization
All contract prices are converted to a standardized benchmark: **₹ per 10 grams @ 999 fineness**:

$$\text{Price}_{\text{norm}} = \text{Raw Settlement} \times \left(\frac{10}{\text{Quote Unit (g)}}\right) \times \left(\frac{999}{\text{Purity (‰)}}\right)$$

| Contract Symbol | Trading Lot | Quote Unit ($Q$) | Fineness ($P$) | Scaling Factor | Settlement Mode |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **GOLDM** | 100 g | ₹ per 10 g | 995 ‰ | $\times 1.004020$ | Compulsory Physical Delivery |
| **GOLDTEN** | 10 g | ₹ per 10 g | 999 ‰ | $\times 1.000000$ | Compulsory Physical Delivery |
| **GOLDGUINEA** | 8 g | ₹ per 8 g | 999 ‰ | $\times 1.250000$ | Compulsory Physical Delivery |
| **GOLDPETAL** | 1 g | ₹ per 1 g | 999 ‰ | $\times 10.000000$ | Compulsory Physical Delivery |

### B. Spread & Z-Score Formulation
The contemporaneous spread between contract $A$ and contract $B$ is:

$$S_t = \text{Price}_{\text{norm},t}(A) - \text{Price}_{\text{norm},t}(B)$$

The historical $Z$-score measures standard deviations from the historical mean:

$$Z_t = \frac{S_t - \mu}{\sigma}$$

Where:
- $\mu = \frac{1}{N} \sum_{i=1}^N S_i$ is the single-provenance sample mean.
- $\sigma = \sqrt{\frac{1}{N} \sum_{i=1}^N (S_i - \mu)^2}$ is the single-provenance sample standard deviation.

### C. Sample Size Sufficiency Tiers
AUREX enforces four strict mathematical capability tiers:
1. **Single-Date Pricing ($N \ge 1$)**: Price normalization and instantaneous basis measurement are mathematically well-defined on contemporaneous settlement prices.
2. **Point Variance ($N \ge 2$)**: Sample dispersion requires at least 2 sessions in the same provenance. If $N < 2$, $\mu, \sigma$ are undefined and return `N/A`.
3. **Rolling Distribution ($N \ge 5$)**: Statistical dislocation bands require at least 5 single-provenance sessions (target $\ge 20$).
4. **Walk-Forward Backtesting ($N \ge 15$)**: Chronological backtesting requires $\ge 15$ sessions for initial warm-up windows (target $\ge 60$). If $N < 15$, the backtest returns an explicit sufficiency shortfall warning and 0 trades.

### D. Implied Carry & Futures Term Structure
- **Simple Annualized Carry**:
  $$\text{Carry}_{\text{simple}} = 100 \times \left(\frac{F}{S} - 1\right) \times \left(\frac{365}{\Delta D}\right)$$
- **Continuously Compounded Carry**:
  $$\text{Carry}_{\text{continuous}} = 100 \times \ln\left(\frac{F}{S}\right) \times \left(\frac{365}{\Delta D}\right)$$
- **Geometric Carry**:
  $$\text{Carry}_{\text{geometric}} = 100 \times \left[\left(\frac{F}{S}\right)^{\frac{365}{\Delta D}} - 1\right]$$

### E. Contract Lifecycle & 5-Day Tender Window
Under SEBI Master Circulars and MCX delivery specifications, all MCX gold futures are subject to **Compulsory Physical Delivery** with a **5-trading-day tender window** prior to expiry. Active positions entering the tender window face delivery margin escalation (up to 25%) and physical delivery allocation. AUREX strictly blocks opening new spread positions within 5 trading days of expiry (accounting for weekends and MCX gazetted holidays via `exchangeCalendar`).

---

## 11. Data Provenance Framework

AUREX maintains an explicit 3-mode provenance framework:

1. **`PROTOTYPE_ONLY`**: Restricts data exclusively to calibrated demonstration values (2026-07-15 to 2026-10-08; 434 records across 62 sessions). Disclosed clearly as synthetic demo data; never presented as genuine historical exchange observations.
2. **`IMPORTED_ONLY`**: Restricts data exclusively to user-imported MCX Bhavcopy CSV records. Multi-session statistical distributions and backtests are transparently gated until additional dates are uploaded.
3. **`ALL` (Hybrid)**: Retains both datasets in browser storage while enforcing strict provenance boundary segmentation—statistical calibration windows are prohibited from bridging prototype and imported segments.

### Verified Bhavcopy Ingestion Rules
- **Schema Validation**: Validates 15 standard MCX Bhavcopy columns.
- **FUTCOM vs OPTFUT**: Quarantines option records (identified via non-empty `Option Type` or positive `Strike Price`) without arbitrary price heuristics.
- **Idempotency**: Composite natural key (`symbol_date_expiryDate`) prevents duplicate observations on re-importing the same CSV.
- **Conflict Prevention**: Divergent settlement prices on existing expiries halt automatic merge and require explicit user resolution.
- **Client Storage Scope**: Stored locally in browser `localStorage`. Browser-local data does not automatically synchronize to another machine or browser profile.

---

## 12. Known Limitations

- **Order Book Depth**: Daily Bhavcopy data provides aggregate volume and open interest as liquidity proxies. Microstructure analysis (L2/L3 order book queues) requires direct broker WebSocket or exchange co-location feeds.
- **Client-Side Execution**: AUREX runs entirely in the user's web browser. It does not transmit trading orders or execute live market transactions.
- **Authentic History Span**: Historical Bhavcopy downloads from MCX are protected by Akamai Edge Security (`HTTP 403 Forbidden` for automated scrapers). Accumulating the 60-session validation target requires manual CSV downloads from the MCX portal.
- **Friction Estimates**: Transaction fees (STT, GST, MCX turnover) and bid-ask slippage are modeled via institutional default assumptions. Actual broker brokerage plans and market conditions may vary.

---

## 13. Interpretation of Verdicts

AUREX evaluates every trade opportunity through an institutional capital-preservation filter:

| Verdict | Color | Definition & Institutional Meaning |
| :--- | :---: | :--- |
| **`ACTIONABLE`** | Emerald | Observed relative-value spread exceeds all transaction hurdles (slippage, taxes, haircut, buffer) with confirmed order-book depth and valid single-provenance statistical calibration. *Does not imply guaranteed profitability.* |
| **`WATCH`** | Amber | A basis divergence exists, but liquidity is borderline or spread stability requires monitoring before committing capital. |
| **`NO TRADE`** | Rose | **Capital Preserved.** The opportunity fails cost hurdles, violates liquidity filters, enters the 5-day delivery tender window, or lacks sufficient historical calibration (Gate 0). |

---

## 14. Deployment Workflow

- **Hosting Platform**: Vercel Production
- **Public Production URL**: [https://aurex-swart.vercel.app](https://aurex-swart.vercel.app)
- **Deployment Pipeline**: Connected directly to the GitHub repository (`https://github.com/vedantpatil-2007/Aurex`). Every push to `main` triggers automated build (`tsc -b && vite build`) and deployment.
- **Bundle Optimization**: Production assets are minified and hashed for aggressive cache-busting (`/assets/index-[hash].js`).

---

## 15. Team LONEBYTE

| Member | Role | Core Focus |
| :--- | :--- | :--- |
| **Vedant Patil** | Quant Systems | System architecture, analytical engines, term structure, backtesting simulation, CSV parser, and release verification |
| **Vedshree Mhatre** | Quantitative Analysis | Financial systems, Edge Survival Ledger audit trails, accounting identity verification, and walk-forward test integrity |
| **Dhanashree Vaze** | Domain & Derivatives Research | MCX derivative contract specifications, tender window delivery rules, and carry yield mathematics |

---

## 16. Disclaimer

AUREX is a quantitative decision-support research prototype designed for educational, analytical, and developmental evaluation of commodity derivative relative-value relationships. Simulated performance, walk-forward backtests, and cost-waterfall estimates are model-driven calculations and do not constitute investment advice, trading recommendations, or guarantees of achievable trading returns. Real-world futures trading involves substantial risk of capital loss, margin escalation, and compulsory physical delivery obligations.
