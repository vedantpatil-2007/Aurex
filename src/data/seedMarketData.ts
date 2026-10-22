import { MarketObservation } from '../types/market';

/**
 * PROTOTYPE SIMULATION SEED DATA
 *
 * Generated based on official MCX PS03 contract parameters, multi-expiry term structure,
 * and historical Indian gold volatility.
 * Standard Indian gold price range: ₹73,000 - ₹77,500 per 10g benchmark.
 *
 * Contracts & Discrete Expiries:
 * - GOLDM: 100g contract, 10g quote, 995 purity (Expiries: 2026-11-05 near, 2026-12-05 next, 2027-02-05 far)
 * - GOLDTEN: 10g contract, 10g quote, 999 purity (Expiries: 2026-10-30 near, 2026-11-27 next)
 * - GOLDGUINEA: 8g contract, 8g quote, 999 purity (Expiry: 2026-10-30)
 * - GOLDPETAL: 1g contract, 1g quote, 999 purity (Expiry: 2026-10-30)
 */

function generateDeterministicSeedData(): MarketObservation[] {
  const records: MarketObservation[] = [];
  const tradingDates: string[] = [];

  const pushRecord = (item: {
    date: string;
    symbol: MarketObservation['symbol'];
    expiryDate: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    openInterest: number;
  }) => {
    records.push({
      ...item,
      provenance: 'PROTOTYPE SIMULATION',
      sourceFile: 'seed_prototype_simulation.internal',
      sourceSha256: 'sim_deterministic_seed_f7c9e0114a8b29f0'
    });
  };

  // Generate 60 trading days leading up to 2026-10-08
  const startDate = new Date('2026-07-15');
  const endDate = new Date('2026-10-08');

  const curr = new Date(startDate);
  while (curr <= endDate) {
    const dayOfWeek = curr.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Skip weekends
      const yyyy = curr.getFullYear();
      const mm = String(curr.getMonth() + 1).padStart(2, '0');
      const dd = String(curr.getDate()).padStart(2, '0');
      tradingDates.push(`${yyyy}-${mm}-${dd}`);
    }
    curr.setDate(curr.getDate() + 1);
  }

  // Base gold price trajectory (realistic upward drift with macroeconomic mean-reverting fluctuations)
  let baseGold10g999 = 73800;

  tradingDates.forEach((date, index) => {
    // Deterministic pseudo-random fluctuation
    const sinFactor = Math.sin(index * 0.22) * 180;
    const cosFactor = Math.cos(index * 0.11) * 220;
    const trend = index * 42; // gradual upward drift over ~60 days
    const noise = ((index * 37) % 100) - 50;

    baseGold10g999 = 73800 + trend + sinFactor + cosFactor + noise;

    // Relative value spread nuances (realistic basis dislocations)
    // GOLDM vs GOLDTEN basis difference (financing / delivery / liquidity differential)
    const m_ten_dislocation = 45 + Math.sin(index * 0.35) * 85 + Math.cos(index * 0.15) * 40;
    // GOLDGUINEA fabrication / retail coin basis
    const guinea_dislocation = -25 + Math.cos(index * 0.28) * 60;
    // GOLDPETAL retail granularity premium
    const petal_dislocation = 30 + Math.sin(index * 0.19) * 50;

    // 1. GOLDM Near (Quote 10g, Purity 995, Expiry 2026-11-05)
    // Formula: Raw = Benchmark * (10 / 10) * (995 / 999) + small basis
    const goldmNormTarget = baseGold10g999;
    const goldmRaw = Number(((goldmNormTarget * (10 / 10) * (995 / 999))).toFixed(2));
    const goldmClose = goldmRaw;
    const goldmOpen = Number((goldmClose - 40 + ((index * 13) % 80)).toFixed(2));
    const goldmHigh = Number((Math.max(goldmOpen, goldmClose) + 65 + ((index * 7) % 50)).toFixed(2));
    const goldmLow = Number((Math.min(goldmOpen, goldmClose) - 60 - ((index * 11) % 40)).toFixed(2));
    const goldmVol = 9500 + Math.floor(Math.sin(index * 0.5) * 3200) + ((index * 109) % 2000);
    const goldmOI = 15200 + index * 60 + ((index * 73) % 1500);

    pushRecord({
      date,
      symbol: 'GOLDM',
      expiryDate: '2026-11-05',
      open: goldmOpen,
      high: goldmHigh,
      low: goldmLow,
      close: goldmClose,
      volume: goldmVol,
      openInterest: goldmOI
    });

    // 1b. GOLDM Next Month Expiry (2026-12-05) - ~30 calendar days forward carry (~7% p.a.)
    const carryNext30d = Number((goldmClose * 0.07 * (30 / 365)).toFixed(2));
    const goldmNextClose = Number((goldmClose + carryNext30d).toFixed(2));
    const goldmNextOpen = Number((goldmNextClose - 35 + ((index * 11) % 70)).toFixed(2));
    const goldmNextHigh = Number((Math.max(goldmNextOpen, goldmNextClose) + 55).toFixed(2));
    const goldmNextLow = Number((Math.min(goldmNextOpen, goldmNextClose) - 50).toFixed(2));
    const goldmNextVol = Math.floor(goldmVol * 0.32);
    const goldmNextOI = Math.floor(goldmOI * 0.42);

    pushRecord({
      date,
      symbol: 'GOLDM',
      expiryDate: '2026-12-05',
      open: goldmNextOpen,
      high: goldmNextHigh,
      low: goldmNextLow,
      close: goldmNextClose,
      volume: goldmNextVol,
      openInterest: goldmNextOI
    });

    // 1c. GOLDM Far Expiry (2027-02-05) - ~92 calendar days forward carry (~7.2% p.a.)
    const carryFar92d = Number((goldmClose * 0.072 * (92 / 365)).toFixed(2));
    const goldmFarClose = Number((goldmClose + carryFar92d).toFixed(2));
    const goldmFarOpen = Number((goldmFarClose - 45 + ((index * 9) % 80)).toFixed(2));
    const goldmFarHigh = Number((Math.max(goldmFarOpen, goldmFarClose) + 65).toFixed(2));
    const goldmFarLow = Number((Math.min(goldmFarOpen, goldmFarClose) - 60).toFixed(2));
    const goldmFarVol = Math.floor(goldmVol * 0.12);
    const goldmFarOI = Math.floor(goldmOI * 0.20);

    pushRecord({
      date,
      symbol: 'GOLDM',
      expiryDate: '2027-02-05',
      open: goldmFarOpen,
      high: goldmFarHigh,
      low: goldmFarLow,
      close: goldmFarClose,
      volume: goldmFarVol,
      openInterest: goldmFarOI
    });

    // 2. GOLDTEN Near (Quote 10g, Purity 999, Expiry 2026-10-30)
    // Raw = Benchmark (10g @ 999) - dislocation
    const goldtenNormTarget = baseGold10g999 - m_ten_dislocation;
    const goldtenRaw = Number(((goldtenNormTarget * (10 / 10) * (999 / 999))).toFixed(2));
    const goldtenClose = goldtenRaw;
    const goldtenOpen = Number((goldtenClose - 35 + ((index * 13) % 70)).toFixed(2));
    const goldtenHigh = Number((Math.max(goldtenOpen, goldtenClose) + 60 + ((index * 5) % 45)).toFixed(2));
    const goldtenLow = Number((Math.min(goldtenOpen, goldtenClose) - 55 - ((index * 7) % 35)).toFixed(2));
    const goldtenVol = 3200 + Math.floor(Math.sin(index * 0.4) * 900) + ((index * 53) % 700);
    const goldtenOI = 4800 + index * 25 + ((index * 31) % 500);

    pushRecord({
      date,
      symbol: 'GOLDTEN',
      expiryDate: '2026-10-30',
      open: goldtenOpen,
      high: goldtenHigh,
      low: goldtenLow,
      close: goldtenClose,
      volume: goldtenVol,
      openInterest: goldtenOI
    });

    // 2b. GOLDTEN Next Month Expiry (2026-11-27) - ~28 calendar days forward carry (~6.8% p.a.)
    const carryTen28d = Number((goldtenClose * 0.068 * (28 / 365)).toFixed(2));
    const goldtenNextClose = Number((goldtenClose + carryTen28d).toFixed(2));
    const goldtenNextOpen = Number((goldtenNextClose - 30 + ((index * 7) % 50)).toFixed(2));
    const goldtenNextHigh = Number((Math.max(goldtenNextOpen, goldtenNextClose) + 50).toFixed(2));
    const goldtenNextLow = Number((Math.min(goldtenNextOpen, goldtenNextClose) - 45).toFixed(2));
    const goldtenNextVol = Math.floor(goldtenVol * 0.28);
    const goldtenNextOI = Math.floor(goldtenOI * 0.38);

    pushRecord({
      date,
      symbol: 'GOLDTEN',
      expiryDate: '2026-11-27',
      open: goldtenNextOpen,
      high: goldtenNextHigh,
      low: goldtenNextLow,
      close: goldtenNextClose,
      volume: goldtenNextVol,
      openInterest: goldtenNextOI
    });

    // 3. GOLDGUINEA (Quote 8g, Purity 999, Expiry 2026-10-30)
    // Raw = (Benchmark + dislocation) * (8 / 10) * (999 / 999)
    const guineaNormTarget = baseGold10g999 + guinea_dislocation;
    const guineaRaw = Number(((guineaNormTarget * (8 / 10) * (999 / 999))).toFixed(2));
    const guineaClose = guineaRaw;
    const guineaOpen = Number((guineaClose - 30 + ((index * 11) % 60)).toFixed(2));
    const guineaHigh = Number((Math.max(guineaOpen, guineaClose) + 50 + ((index * 5) % 40)).toFixed(2));
    const guineaLow = Number((Math.min(guineaOpen, guineaClose) - 45 - ((index * 9) % 35)).toFixed(2));
    const guineaVol = 650 + Math.floor(Math.sin(index * 0.3) * 220) + ((index * 29) % 180);
    const guineaOI = 1250 + index * 10 + ((index * 17) % 200);

    pushRecord({
      date,
      symbol: 'GOLDGUINEA',
      expiryDate: '2026-10-30',
      open: guineaOpen,
      high: guineaHigh,
      low: guineaLow,
      close: guineaClose,
      volume: guineaVol,
      openInterest: guineaOI
    });

    // 4. GOLDPETAL (Quote 1g, Purity 999, Expiry 2026-10-30)
    // Raw = (Benchmark + dislocation) * (1 / 10) * (999 / 999)
    const petalNormTarget = baseGold10g999 + petal_dislocation;
    const petalRaw = Number(((petalNormTarget * (1 / 10) * (999 / 999))).toFixed(2));
    const petalClose = petalRaw;
    const petalOpen = Number((petalClose - 5 + ((index * 4) % 10)).toFixed(2));
    const petalHigh = Number((Math.max(petalOpen, petalClose) + 8 + ((index * 3) % 6)).toFixed(2));
    const petalLow = Number((Math.min(petalOpen, petalClose) - 7 - ((index * 5) % 5)).toFixed(2));
    const petalVol = 1250 + Math.floor(Math.sin(index * 0.45) * 350) + ((index * 41) % 300);
    const petalOI = 2100 + index * 18 + ((index * 23) % 300);

    pushRecord({
      date,
      symbol: 'GOLDPETAL',
      expiryDate: '2026-10-30',
      open: petalOpen,
      high: petalHigh,
      low: petalLow,
      close: petalClose,
      volume: petalVol,
      openInterest: petalOI
    });
  });

  return records;
}

export const SEED_MARKET_DATA: MarketObservation[] = generateDeterministicSeedData();
