import { describe, it, expect } from 'vitest';
import { normalizePrice, getNormalizationBreakdown, normalizeObservation } from '../engines/normalizationEngine';
import { calculateSpread, calculateZScore, buildPairSpreadSeries } from '../engines/relativeValueEngine';
import { calculateTotalFriction, calculateLiquidityScore, evaluateLiquidityGrade, buildCostWaterfall } from '../engines/liquidityCostEngine';
import { evaluateDecision } from '../engines/decisionEngine';
import { validateMarketData } from '../utils/dataQuality';
import { CONTRACT_SPECIFICATIONS } from '../data/contracts';
import { MarketObservation } from '../types/market';

describe('AUREX Engine Unit Tests (Phase 1 & Phase 2)', () => {
  // Test 1: GOLDM normalization
  it('1. should accurately normalize GOLDM contract prices', () => {
    const rawPrice = 74500;
    const result = normalizePrice(rawPrice, 10, 995);
    const expected = Number((74500 * (10 / 10) * (999 / 995)).toFixed(2)); // ~74799.50
    expect(result.normalizedPrice).toBe(expected);
    expect(result.unitAdjustment).toBe(1);
    expect(result.purityAdjustment).toBeCloseTo(1.00402, 4);

    const breakdown = getNormalizationBreakdown(rawPrice, CONTRACT_SPECIFICATIONS.GOLDM);
    expect(breakdown.scalingFactor).toBeCloseTo(1.00402, 4);
    expect(breakdown.normalizedPrice).toBe(expected);
  });

  // Test 2: GOLDTEN normalization
  it('2. should accurately normalize GOLDTEN contract prices', () => {
    const rawPrice = 7450;
    const result = normalizePrice(rawPrice, 1, 995);
    const expected = Number((7450 * 10 * (999 / 995)).toFixed(2)); // ~74799.50
    expect(result.normalizedPrice).toBe(expected);
    expect(result.unitAdjustment).toBe(10);
    expect(result.purityAdjustment).toBeCloseTo(1.00402, 4);
  });

  // Test 3: GOLDGUINEA normalization
  it('3. should accurately normalize GOLDGUINEA contract prices', () => {
    const rawPrice = 60000;
    const result = normalizePrice(rawPrice, 8, 999);
    expect(result.normalizedPrice).toBe(75000.00);
    expect(result.unitAdjustment).toBe(1.25);
    expect(result.purityAdjustment).toBe(1);
  });

  // Test 4: GOLDPETAL normalization
  it('4. should accurately normalize GOLDPETAL contract prices', () => {
    const rawPrice = 7500;
    const result = normalizePrice(rawPrice, 1, 999);
    expect(result.normalizedPrice).toBe(75000.00);
    expect(result.unitAdjustment).toBe(10);
    expect(result.purityAdjustment).toBe(1);
  });

  // Test 5: Spread calculation
  it('5. should calculate cross-contract normalized price spread dynamically', () => {
    const priceA = 75250.50;
    const priceB = 75100.00;
    const spread = calculateSpread(priceA, priceB);
    expect(spread).toBe(150.50);

    const spreadRev = calculateSpread(priceB, priceA);
    expect(spreadRev).toBe(-150.50);
  });

  // Test 6: Z-Score calculation
  it('6. should calculate statistical mean, standard deviation and z-score safely', () => {
    const points = [
      { date: '2026-09-01', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75000, priceB: 74900, spread: 100, spreadPercentage: 0.13 },
      { date: '2026-09-02', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75100, priceB: 75000, spread: 100, spreadPercentage: 0.13 },
      { date: '2026-09-03', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75200, priceB: 75050, spread: 150, spreadPercentage: 0.20 },
      { date: '2026-09-04', symbolA: 'GOLDM', symbolB: 'GOLDTEN', priceA: 75250, priceB: 75000, spread: 250, spreadPercentage: 0.33 }
    ] as any;

    const analysis = calculateZScore(points, 4);
    expect(analysis.mean).toBe(150);
    expect(analysis.standardDeviation).toBeGreaterThan(0);
    expect(analysis.currentZScore).toBeGreaterThan(0);
    expect(analysis.minSpread).toBe(100);
    expect(analysis.maxSpread).toBe(250);
  });

  // Test 7: Cost calculation
  it('7. should aggregate execution friction (slippage, brokerage/taxes, buffer, haircut)', () => {
    const friction = {
      slippagePer10g: 25.50,
      brokerageTaxesPer10g: 35.00,
      liquidityHaircutPer10g: 10.00,
      costBufferPer10g: 15.00,
      liquidityThresholdScore: 60
    };
    const total = calculateTotalFriction(friction);
    expect(total).toBe(85.50);
  });

  // Test 8: ACTIONABLE decision
  it('8. should yield ACTIONABLE when net edge is positive and liquidity passes', () => {
    const result = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 180,
      volA: 10000,
      oiA: 15000,
      volB: 4000,
      oiB: 6000,
      friction: {
        slippagePer10g: 20,
        brokerageTaxesPer10g: 30,
        liquidityHaircutPer10g: 10,
        costBufferPer10g: 15,
        liquidityThresholdScore: 50
      }
    });

    expect(result.decision).toBe('ACTIONABLE');
    expect(result.totalFriction).toBe(75);
    expect(result.netEdge).toBe(105);
    expect(result.liquidityGrade).toBe('PASS');
    expect(result.rationale).toContain('Observed relative-value edge survives');
  });

  // Test 9: WATCH decision
  it('9. should yield WATCH when net edge is positive but liquidity is borderline', () => {
    const result = evaluateDecision({
      pair: ['GOLDM', 'GOLDGUINEA'],
      observedSpread: 150,
      volA: 8000,
      oiA: 12000,
      volB: 500, // minVol = 500 => volScore = 12.5
      oiB: 1200, // minOI = 1200 => oiScore = 20
      // rawScore = 32.5. If threshold = 40, 0.75*40 = 30 => Score 32.5 is BORDERLINE!
      friction: {
        slippagePer10g: 20,
        brokerageTaxesPer10g: 25,
        liquidityHaircutPer10g: 10,
        costBufferPer10g: 15,
        liquidityThresholdScore: 40
      }
    });

    expect(result.decision).toBe('WATCH');
    expect(result.liquidityGrade).toBe('BORDERLINE');
    expect(result.netEdge).toBeGreaterThan(0);
    expect(result.rationale).toContain('Relative-value anomaly detected');
  });

  // Test 10: NO TRADE decision (when edge <= friction or liquidity fails)
  it('10. should yield NO TRADE when expected edge does not survive friction', () => {
    const result = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 50,
      volA: 10000,
      oiA: 15000,
      volB: 4000,
      oiB: 6000,
      friction: {
        slippagePer10g: 30,
        brokerageTaxesPer10g: 40,
        liquidityHaircutPer10g: 15,
        costBufferPer10g: 20,
        liquidityThresholdScore: 50
      }
    });

    expect(result.totalFriction).toBe(105);
    expect(result.expectedEdge).toBe(50);
    expect(result.netEdge).toBe(-55);
    expect(result.decision).toBe('NO TRADE');
    expect(result.rationale).toContain('Theoretical opportunity does not survive');
  });

  // Test 11: Missing-data handling
  it('11. should handle missing or empty series gracefully without NaN or crashes', () => {
    const emptyAnalysis = calculateZScore([]);
    expect(emptyAnalysis.currentZScore).toBe(0);
    expect(emptyAnalysis.mean).toBe(0);
    expect(emptyAnalysis.standardDeviation).toBe(0);

    const emptySpread = buildPairSpreadSeries([], [], 'GOLDM', 'GOLDTEN');
    expect(emptySpread).toEqual([]);

    const nanPriceNorm = normalizePrice(NaN, 10, 995);
    expect(nanPriceNorm.normalizedPrice).toBe(0);

    const zeroSpread = calculateSpread(NaN, 75000);
    expect(zeroSpread).toBe(0);
  });

  // Test 12: Invalid-data handling
  it('12. should detect invalid data records in data quality auditor', () => {
    const corruptedDataset: MarketObservation[] = [
      {
        date: '2026-10-01',
        symbol: 'GOLDM',
        expiryDate: '2026-11-05',
        open: 74000,
        high: 74200,
        low: 73900,
        close: 74100,
        volume: -50,
        openInterest: 1000
      },
      {
        date: 'invalid-date',
        symbol: '' as any,
        expiryDate: '',
        open: 0,
        high: 0,
        low: 0,
        close: 0,
        volume: 100,
        openInterest: 500
      }
    ];

    const report = validateMarketData(corruptedDataset);
    expect(report.status).toBe('WARN');
    expect(report.invalidRecords).toBeGreaterThan(0);
    expect(report.checks.some(c => !c.passed)).toBe(true);
  });

  // Test 13: Phase 2 Cost Waterfall Breakdown
  it('13. should build complete 5-stage cost waterfall correctly', () => {
    const waterfall = buildCostWaterfall(150, {
      slippagePer10g: 20,
      brokerageTaxesPer10g: 30,
      liquidityHaircutPer10g: 15,
      costBufferPer10g: 15,
      liquidityThresholdScore: 50
    });

    expect(waterfall.theoreticalEdge).toBe(150);
    expect(waterfall.slippage).toBe(20);
    expect(waterfall.brokerageTaxes).toBe(30);
    expect(waterfall.liquidityHaircut).toBe(15);
    expect(waterfall.safetyBuffer).toBe(15);
    expect(waterfall.totalFriction).toBe(80);
    expect(waterfall.netDefensibleEdge).toBe(70);
  });

  // Test 14: Contract Lifecycle Classification
  it('14. should classify contract lifecycle stages accurately based on days to expiry', () => {
    const farObs: MarketObservation = {
      date: '2026-10-01',
      symbol: 'GOLDM',
      expiryDate: '2026-11-05', // ~35 days
      open: 74000, high: 74500, low: 73900, close: 74200, volume: 5000, openInterest: 8000
    };
    const normFar = normalizeObservation(farObs);
    expect(normFar.lifecycleStage).toBe('NORMAL');

    const nearObs: MarketObservation = {
      date: '2026-10-20',
      symbol: 'GOLDTEN',
      expiryDate: '2026-10-30', // 10 days
      open: 7400, high: 7450, low: 7390, close: 7420, volume: 2000, openInterest: 3000
    };
    const normNear = normalizeObservation(nearObs);
    expect(normNear.lifecycleStage).toBe('NEAR_EXPIRY');

    const rollObs: MarketObservation = {
      date: '2026-10-28',
      symbol: 'GOLDPETAL',
      expiryDate: '2026-10-30', // 2 days
      open: 740, high: 745, low: 739, close: 742, volume: 1000, openInterest: 2000
    };
    const normRoll = normalizeObservation(rollObs);
    expect(normRoll.lifecycleStage).toBe('ROLL_WINDOW');
  });

  // Test 15: Cross-Contract Relative Value on alternative pair (GOLDTEN vs GOLDPETAL)
  it('15. should evaluate relative-value correctly for alternative pairs like GOLDTEN/GOLDPETAL', () => {
    const priceA = normalizePrice(7450, 1, 995).normalizedPrice; // GOLDTEN ~74799.50
    const priceB = normalizePrice(7480, 1, 999).normalizedPrice; // GOLDPETAL 74800.00
    const spread = calculateSpread(priceA, priceB);

    expect(isFinite(spread)).toBe(true);
    expect(Math.abs(spread)).toBeCloseTo(0.5, 1);
  });

  // Test 16: Three Official Demo Scenario Presets validation
  it('16. should verify all 3 official Phase 2 presets produce the mandated decisions', () => {
    // Preset 1: Actionable
    const p1 = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 175,
      volA: 12000, oiA: 18000, volB: 4000, oiB: 6000,
      friction: { slippagePer10g: 20, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 10, costBufferPer10g: 15, liquidityThresholdScore: 45 }
    });
    expect(p1.decision).toBe('ACTIONABLE');

    // Preset 2: Watch (Borderline Liquidity)
    const p2 = evaluateDecision({
      pair: ['GOLDM', 'GOLDGUINEA'],
      observedSpread: 135,
      volA: 10000, oiA: 16000, volB: 500, oiB: 1200,
      friction: { slippagePer10g: 22, brokerageTaxesPer10g: 30, liquidityHaircutPer10g: 15, costBufferPer10g: 15, liquidityThresholdScore: 40 }
    });
    expect(p2.decision).toBe('WATCH');

    // Preset 3: No Trade (High Friction)
    const p3 = evaluateDecision({
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 50,
      volA: 12000, oiA: 18000, volB: 4000, oiB: 6000,
      friction: { slippagePer10g: 35, brokerageTaxesPer10g: 35, liquidityHaircutPer10g: 20, costBufferPer10g: 25, liquidityThresholdScore: 50 }
    });
    expect(p3.decision).toBe('NO TRADE');
  });
});
