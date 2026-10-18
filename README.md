# AUREX — Automated Unified Relative-Value Engine for X-Contracts
> **From raw settlement data to cost-aware contract intelligence.**  
> *“Compare correctly. Validate honestly. Act only when the evidence survives costs.”*

[![Hackathon](https://img.shields.io/badge/Hackathon-Hack_in_Hills_'26-amber.svg)](https://hackinhills.com)
[![Problem Statement](https://img.shields.io/badge/Track-PS03_Commodity_Derivatives_Intelligence-blue.svg)](https://mcxindia.com)
[![Team](https://img.shields.io/badge/Team-LONEBYTE-slate.svg)](#team-lonebyte)
[![Tests](https://img.shields.io/badge/Vitest-29%2F29_Passed-emerald.svg)](#testing--verification)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict_Checked-blue.svg)](#tech-stack)
[![Deployment](https://img.shields.io/badge/Live_Deployment-aurex--swart.vercel.app-emerald.svg)](https://aurex-swart.vercel.app)

---

## 1. Executive Summary & Problem Statement (PS03)

On the **Multi Commodity Exchange of India (MCX)**, four distinct futures contracts represent the same underlying physical gold metal:
- **GOLDM (Gold Mini)**
- **GOLDTEN (Gold 10 Grams)**
- **GOLDGUINEA (Gold Guinea 8 Grams)**
- **GOLDPETAL (Gold Petal 1 Gram)**

### The Core Problem
Although these contracts track the same underlying commodity, **same metal does not mean same contract economics**:
1. **Heterogeneous Lot Sizes & Quotation Units**: GOLDM trades in 100g lots quoted per 10g; GOLDTEN trades in 10g lots quoted per 1g; GOLDGUINEA trades in 8g lots quoted per 8g; GOLDPETAL trades in 1g lots quoted per 1g.
2. **Purity Mismatches**: GOLDM and GOLDTEN settle on 995 fineness standard (Ahmedabad/Mumbai delivery basis), while GOLDGUINEA and GOLDPETAL settle on 999 fine gold purity.
3. **Maturity Asynchrony**: Contracts expire on different calendar schedules (e.g., 3rd–5th of the month vs 27th–31st of the month), introducing carry cost, financing differentials, and roll premiums.
4. **Execution Friction & Liquidity Asymmetry**: A retail contract like GOLDPETAL or GOLDGUINEA has significantly shallower order-book depth and higher bid-ask crossing costs than institutional GOLDM.

Naive comparison of raw settlement marks produces false arbitrage illusions. **AUREX** solves this problem by transforming heterogeneous exchange quotations into a common economic basis, analyzing cross-contract basis, screening for maturity compatibility, filtering through realistic transaction costs, and validating signals through strict out-of-sample walk-forward testing.

---

## 2. Core Product Capabilities

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AUREX ANALYTICAL PIPELINE                       │
└────────────────────────────────────────────────────────────────────────┘
 [ Raw MCX Bhavcopy / CSV ]
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 1: Official Data Ingestion     │ ➔ Parses discrete expiries, validates
 └───────────────────────────────────────┘   OHLC, detects duplicate keys
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 2: Precision Normalization     │ ➔ Converts to ₹ / 10g @ 999 purity
 └───────────────────────────────────────┘   Price_norm = Raw × (10/Q) × (999/P)
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 3: Contract Comparability       │ ➔ Evaluates calendar mismatch (DTE)
 └───────────────────────────────────────┘   Flags term structure carry basis
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 4: Cross-Contract Spread (S_t) │ ➔ S_t = Norm_A - Norm_B, Rolling Mean
 └───────────────────────────────────────┘   Spread Volatility & Z-Score Bands
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 5: Liquidity Screening          │ ➔ Composite 0–100 score based on
 └───────────────────────────────────────┘   the thinner contract leg constraint
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 6: Execution Friction Hurdle    │ ➔ Slippage + Brokerage + STT + GST +
 └───────────────────────────────────────┘   Liquidity Haircut + Margin Buffer
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 7: Signature Edge Ledger        │ ➔ 8-stage transparent audit trail
 └───────────────────────────────────────┘   Proves whether edge survives costs
            │
            ▼
 ┌───────────────────────────────────────┐
 │ Stage 8: Gate Verdict                 │ ➔ ACTIONABLE | WATCH | NO TRADE
 └───────────────────────────────────────┘   (Capital Preservation is a Victory)
```

### A. Precision Normalization Engine
Every contract quotation is mathematically converted into the institutional standard valuation benchmark:
$$\text{Price}_{\text{norm}} = \text{Raw Close} \times \left(\frac{10}{\text{Quote Unit (g)}}\right) \times \left(\frac{999}{\text{Purity (‰)}}\right)$$

| Contract Symbol | Trading Lot | Quote Unit | Purity | Unit Multiplier | Purity Multiplier | Effective Scaling |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **GOLDM** | 100g | 10g | 995‰ | $\times 1.0000$ | $\times 1.004020$ | $\times 1.004020$ |
| **GOLDTEN** | 10g | 1g | 995‰ | $\times 10.0000$ | $\times 1.004020$ | $\times 10.04020$ |
| **GOLDGUINEA** | 8g | 8g | 999‰ | $\times 1.2500$ | $\times 1.000000$ | $\times 1.250000$ |
| **GOLDPETAL** | 1g | 1g | 999‰ | $\times 10.0000$ | $\times 1.000000$ | $\times 10.00000$ |

### B. Contract Comparability Engine
Prevents comparing mismatched maturities as pure-play arbitrage:
- **`COMPARABLE`**: Maturity mismatch $\le 7$ calendar days; contemporaneous trade dates.
- **`COMPARABLE WITH MATURITY DIFFERENCE`**: Maturity mismatch $> 7$ days; alerts the trader that the spread reflects financing, carrying costs, and roll premiums.
- **`INSUFFICIENT DATA`**: Missing simultaneous settlement observations.

### C. Signature Feature: Edge Survival Ledger
An 8-stage auditable breakdown proving every decision step-by-step:
1. **Source Evidence**: Ingested settlement marks, timestamps, and data provenance.
2. **Economic Normalization**: Step-by-step unit and purity conversions.
3. **Relative-Value Measurement**: Spread $S_t(i,j)$, trailing mean, volatility, and z-score.
4. **Expiry and Data Check**: Discrete maturity alignment and calendar warnings.
5. **Liquidity Check**: Volume and Open Interest screening on the bottleneck leg.
6. **Execution Friction**: Itemized slippage, brokerage, STT/GST, liquidity haircut, and safety buffer.
7. **Net Edge**: Gross theoretical edge minus friction hurdle.
8. **Final Decision**: Transparent verdict with triggered rule trail and downloadable JSON audit.

### D. Walk-Forward Validation Engine
- Enforces strict out-of-sample chronological testing.
- Calibrates baseline parameters on in-sample training window $[t-k, t-1]$.
- Evaluates performance strictly on unseen future test window $[t]$ under cost deductions.
- Zero look-ahead bias: future data cannot enter historical parameters.

### E. Cost & Liquidity Stress Lab
- Sensitivity grid testing whether the relative-value opportunity survives across three market regimes:
  - **Lower Friction** (DMA / institutional crossing)
  - **Base Case** (Configured benchmark assumptions)
  - **Higher Friction** (Stressed market conditions with wide spreads and market impact)

---

## 3. Data Provenance & Transparency

AUREX maintains strict data provenance across all views:
1. **`OFFICIAL MCX DATA`**: Ingested official MCX Daily Bhavcopy historical settlement observations.
2. **`USER-IMPORTED MCX DATA`**: Custom user-uploaded MCX Bhavcopy CSV files processed and validated via Data Lab.
3. **`PROTOTYPE SIMULATION`**: Calibrated deterministic simulation based on official MCX PS03 contract parameters and historical gold volatility.

> **Honesty Principle**: Daily settlement marks serve as liquidity proxies; order-book microstructure is estimated. AUREX never manufactures continuous synthetic roll curves by forward-filling missing prices.

---

## 4. Tech Stack

- **Framework**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Charts**: Recharts (consistent quantitative time series, z-score bands, and waterfall charts)
- **Icons**: Lucide React
- **Testing**: Vitest (29 unit tests covering all mathematical engines, CSV ingestion, and look-ahead prevention)

---

## 5. Quick Start & Local Setup

### Prerequisites
- Node.js (v18 or higher recommended)
- npm

### Installation
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
# Run unit tests
npm test

# Run production build (typecheck + minification)
npm run build

# Run linter
npm run lint

# Preview production build locally
npm run preview
```

---

## 6. Testing & Verification

The project includes 29 unit tests in `src/test/` covering all critical mathematical paths:
- `src/test/engines.test.ts` (16 tests: Normalization, spread calculation, z-score, cost waterfall, lifecycle stages, decision states)
- `src/test/round2.test.ts` (13 tests: Lot size vs quote unit separation, purity scaling, CSV tokenization & auto column mapping, duplicate detection, rejection inspector, contract comparability, 8-stage ledger audit trail, walk-forward look-ahead prevention, zero-variance safeguards)

To execute the test suite:
```bash
npm test
```

---

## 7. Recommended 2-Minute Judge Demonstration Script

1. **Step 1 — Overview (`/overview`)**: Review the PS03 problem statement and active monitored contracts.
2. **Step 2 — Data Lab (`/data-lab`)**: Click **"Load Official Sample CSV"** to demonstrate real-time parsing, column auto-detection, duplicate checking, rejection inspection, and discrete contract coverage.
3. **Step 3 — Contract Universe (`/contracts`)**: Inspect the structural difference between GOLDM (100g lot, 10g quote) and GOLDTEN (10g lot, 1g quote), and view the discrete expiry lifecycle timeline.
4. **Step 4 — Normalization Engine (`/normalization`)**: Observe how raw prices are adjusted by quotation multiplier and fineness adjustment into ₹ / 10g @ 999 parity.
5. **Step 5 — Relative Value Lab (`/relative-value`)**: Select pair `GOLDM / GOLDTEN`, explore the 20D rolling Z-Score bands, and inspect the 4-part **Quantitative Interpretation Panel** (*What Moved, Why Might It Matter, What Invalidates, Missing Evidence*).
6. **Step 6 — Edge Survival Ledger (`/ledger`)**: Walk through the 8-stage auditable ledger decomposition and click **"Export Audit Trail"** to download the JSON verification file.
7. **Step 7 — Decision Engine (`/decision`)**: Inspect the Cost & Liquidity Stress Lab (Lower Friction, Base Case, Higher Friction) and click the scenario presets to demonstrate the gate changing between `ACTIONABLE`, `WATCH`, and `NO TRADE`.

---

## 8. Team LONEBYTE

| Name | Role | Responsibilities |
| :--- | :--- | :--- |
| **Vedant Patil** | Lead Quantitative Systems Builder & Full-Stack Engineer | Analytical engines, normalization mathematics, CSV ingestion pipeline, system architecture |
| **Dhanashree Vaze** | Quantitative Research & Domain Analysis | MCX derivative contract specifications, term-structure mechanics, transaction cost modeling |
| **Vedashree Mhatre** | Financial Systems & Verification | Edge Survival Ledger audit trails, walk-forward out-of-sample test design, validation integrity |

---

## 9. Scope & Future Extensions

- **Current Scope (Round 2)**: Complete functional, interactive web prototype with real MCX Bhavcopy ingestion, precision normalization, contract comparability, 8-stage Edge Survival Ledger, walk-forward validation, and cost sensitivity lab.
- **Future Production Scope**: Live WebSocket order-book (L2) integration with MCX broker API, tick-by-tick micro-spread crossing analytics, automated spread order slicing (TWAP/VWAP).
