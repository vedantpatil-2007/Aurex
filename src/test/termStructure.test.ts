import { describe, it, expect } from 'vitest';
import {
  buildFuturesCurve,
  interpolateConstantMaturity,
  decomposeRollDownAndCurveShift,
  calculateSimpleCarry,
  calculateContinuousCarry,
  calculateGeometricCarry
} from '../engines/termStructureEngine';
import { NormalizedObservation } from '../types/market';

describe('AUREX Term Structure & Carry Engine', () => {
  const mockObservations: NormalizedObservation[] = [
    {
      date: '2026-09-01',
      symbol: 'GOLDM',
      expiryDate: '2026-10-05',
      daysToExpiry: 34,
      open: 74500, high: 74800, low: 74400, close: 74600,
      volume: 12000, openInterest: 18000,
      normalizedPrice: 74900.00,
      unitAdjustment: 1, purityAdjustment: 1.00402, lifecycleStage: 'NORMAL'
    },
    {
      date: '2026-09-01',
      symbol: 'GOLDM',
      expiryDate: '2026-11-05',
      daysToExpiry: 65,
      open: 74900, high: 75200, low: 74800, close: 75000,
      volume: 4500, openInterest: 7500,
      normalizedPrice: 75301.50,
      unitAdjustment: 1, purityAdjustment: 1.00402, lifecycleStage: 'NORMAL'
    },
    {
      date: '2026-09-01',
      symbol: 'GOLDM',
      expiryDate: '2026-12-05',
      daysToExpiry: 95,
      open: 75300, high: 75600, low: 75200, close: 75400,
      volume: 1200, openInterest: 2500,
      normalizedPrice: 75703.11,
      unitAdjustment: 1, purityAdjustment: 1.00402, lifecycleStage: 'NORMAL'
    }
  ];

  it('1. should construct curve sorted strictly ascending by days to expiry', () => {
    const curve = buildFuturesCurve(mockObservations, '2026-09-01', 'GOLDM');
    expect(curve.points.length).toBe(3);
    expect(curve.points[0].daysToExpiry).toBe(34);
    expect(curve.points[1].daysToExpiry).toBe(65);
    expect(curve.points[2].daysToExpiry).toBe(95);

    // Adjacent spread calculation
    expect(curve.points[1].adjacentSpread).toBe(401.50);
    expect(curve.points[1].adjacentSpreadPct).toBeCloseTo(0.536, 2);
  });

  it('2. should calculate annualized simple and continuously compounded carry accurately', () => {
    const curve = buildFuturesCurve(mockObservations, '2026-09-01', 'GOLDM');
    expect(curve.daysBetweenExpiries).toBe(61); // 95 - 34 days
    expect(curve.spreadNearFar).toBe(803.11); // 75703.11 - 74900.00
    expect(curve.carryCalculationStatus).toBe('VALID');

    // Annualized simple carry: 100 * ((75703.11 / 74900) - 1) * (365 / 61) ≈ 6.42%
    expect(curve.annualizedSimpleCarry).toBeCloseTo(6.42, 1);

    // Annualized continuously compounded carry: 100 * (365 / 61) * ln(75703.11 / 74900) ≈ 6.38%
    expect(curve.annualizedContinuousCarry).toBeCloseTo(6.38, 1);
    expect(curve.annualizedCompoundedCarry).toBe(curve.annualizedContinuousCarry);

    // Annualized geometric carry: 100 * ((75703.11 / 74900)^(365 / 61) - 1) ≈ 6.59%
    expect(curve.annualizedGeometricCarry).toBeCloseTo(6.59, 1);

    // In contango, continuous carry < simple carry < geometric carry
    expect(curve.annualizedContinuousCarry!).toBeLessThan(curve.annualizedSimpleCarry!);
    expect(curve.annualizedSimpleCarry!).toBeLessThan(curve.annualizedGeometricCarry!);
  });

  it('3. should verify benchmark mathematical carry identities and distinction between geometric and continuous annualization', () => {
    const S = 74500; // Near price
    const F = 75500; // Far price
    const deltaD = 30; // 30 calendar days

    // Simple carry: 100 * ((75500 / 74500) - 1) * (365 / 30) = 16.33%
    const simple = calculateSimpleCarry(S, F, deltaD);
    expect(simple).toBe(16.33);

    // Continuously compounded carry: 100 * ln(75500 / 74500) * (365 / 30) = 16.22%
    const continuous = calculateContinuousCarry(S, F, deltaD);
    expect(continuous).toBe(16.22);

    // Geometric compounding: 100 * ((75500 / 74500)^(365 / 30) - 1) = 17.61%
    const geometric = calculateGeometricCarry(S, F, deltaD);
    expect(geometric).toBe(17.61);

    // Mathematical verification: continuous < simple < geometric for positive carry
    expect(continuous!).toBeLessThan(simple!);
    expect(simple!).toBeLessThan(geometric!);
  });

  it('4. should handle equal near and far prices (zero carry)', () => {
    const S = 75000;
    const F = 75000;
    const deltaD = 30;

    expect(calculateSimpleCarry(S, F, deltaD)).toBe(0);
    expect(calculateContinuousCarry(S, F, deltaD)).toBe(0);
    expect(calculateGeometricCarry(S, F, deltaD)).toBe(0);
  });

  it('5. should handle backwardation (far price below near price) producing negative carry', () => {
    const S = 76000;
    const F = 75000;
    const deltaD = 30;

    const simple = calculateSimpleCarry(S, F, deltaD);
    const continuous = calculateContinuousCarry(S, F, deltaD);
    const geometric = calculateGeometricCarry(S, F, deltaD);

    expect(simple).toBeLessThan(0);
    expect(continuous).toBeLessThan(0);
    expect(geometric).toBeLessThan(0);

    expect(simple).toBeCloseTo(-16.01, 1);
    expect(continuous).toBeCloseTo(-16.12, 1);
  });

  it('6. should reject invalid edge-case inputs without producing NaN or Infinity', () => {
    // Zero or negative near price
    expect(calculateSimpleCarry(0, 75000, 30)).toBeNull();
    expect(calculateContinuousCarry(-100, 75000, 30)).toBeNull();
    expect(calculateGeometricCarry(75000, 0, 30)).toBeNull();

    // Zero or negative delta days (equal or inverted expiries)
    expect(calculateSimpleCarry(74000, 75000, 0)).toBeNull();
    expect(calculateContinuousCarry(74000, 75000, -10)).toBeNull();
    expect(calculateGeometricCarry(74000, 75000, 0)).toBeNull();

    // Non-finite prices (NaN / Infinity)
    expect(calculateSimpleCarry(NaN, 75000, 30)).toBeNull();
    expect(calculateContinuousCarry(74000, Infinity, 30)).toBeNull();

    // Curve construction with duplicate expiry date -> deduplicates to 1 point -> INSUFFICIENT_EXPIRIES
    const obsSingleExpiry: NormalizedObservation[] = [
      { ...mockObservations[0], expiryDate: '2026-10-05', daysToExpiry: 34 },
      { ...mockObservations[1], expiryDate: '2026-10-05', daysToExpiry: 34 }
    ];
    const curveSingle = buildFuturesCurve(obsSingleExpiry, '2026-09-01', 'GOLDM');
    expect(curveSingle.carryCalculationStatus).toBe('INSUFFICIENT_EXPIRIES');
    expect(curveSingle.annualizedSimpleCarry).toBeUndefined();

    // Curve construction with equal DTE across distinct expiry keys -> EQUAL_EXPIRIES
    const obsEqualDte: NormalizedObservation[] = [
      { ...mockObservations[0], expiryDate: '2026-10-05', daysToExpiry: 34 },
      { ...mockObservations[1], expiryDate: '2026-10-06', daysToExpiry: 34 }
    ];
    const curveEqual = buildFuturesCurve(obsEqualDte, '2026-09-01', 'GOLDM');
    expect(curveEqual.carryCalculationStatus).toBe('EQUAL_EXPIRIES');
    expect(curveEqual.annualizedSimpleCarry).toBeUndefined();
    expect(curveEqual.annualizedContinuousCarry).toBeUndefined();

    // Curve construction with invalid non-positive prices
    const obsInvalidPrice: NormalizedObservation[] = [
      { ...mockObservations[0], normalizedPrice: -500 },
      { ...mockObservations[1], normalizedPrice: 75000 }
    ];
    const curveInvalid = buildFuturesCurve(obsInvalidPrice, '2026-09-01', 'GOLDM');
    expect(curveInvalid.carryCalculationStatus).toBe('INVALID_PRICES');
    expect(curveInvalid.annualizedSimpleCarry).toBeUndefined();
  });

  it('7. should interpolate constant-maturity reference prices without extrapolation', () => {
    const curve = buildFuturesCurve(mockObservations, '2026-09-01', 'GOLDM');

    // 50 days (between 34 and 65)
    const ref50d = interpolateConstantMaturity(curve, 50);
    expect(ref50d.status).toBe('VALID');
    expect(ref50d.isExtrapolated).toBe(false);
    expect(ref50d.interpolatedPrice).toBeGreaterThan(74900);
    expect(ref50d.interpolatedPrice).toBeLessThan(75301.50);

    // Out-of-range below minDte (20 days < 34 days) -> MUST reject extrapolation
    const refBelow = interpolateConstantMaturity(curve, 20);
    expect(refBelow.status).toBe('OUT_OF_RANGE');

    // Out-of-range above maxDte (120 days > 95 days) -> MUST reject extrapolation
    const refAbove = interpolateConstantMaturity(curve, 120);
    expect(refAbove.status).toBe('OUT_OF_RANGE');
  });

  it('8. should decompose roll-down and curve shift correctly with exact accounting reconciliation', () => {
    const curvePrev = buildFuturesCurve(mockObservations, '2026-09-01', 'GOLDM');

    // Current day curve: curve shifted upwards by ₹100
    const mockObsCurrent: NormalizedObservation[] = mockObservations.map(o => ({
      ...o,
      date: '2026-09-02',
      normalizedPrice: Number((o.normalizedPrice + 100).toFixed(2))
    }));
    const curveCurr = buildFuturesCurve(mockObsCurrent, '2026-09-02', 'GOLDM');

    const decomp = decomposeRollDownAndCurveShift(curveCurr, curvePrev, 60, 1);
    expect(decomp).not.toBeNull();
    if (decomp) {
      expect(decomp.totalChange).toBe(100.00);
      expect(decomp.curveShift).toBeGreaterThan(0);
      expect(decomp.explanation).toBeDefined();

      // Strict mathematical identity: Total Change === Mechanical Roll-Down + Curve Shift
      const sum = Number((decomp.mechanicalRollDown + decomp.curveShift).toFixed(2));
      expect(Math.abs(sum - decomp.totalChange)).toBeLessThan(0.01);
    }

    // Tenor where aging falls out of range should return null
    const decompOutOfRange = decomposeRollDownAndCurveShift(curveCurr, curvePrev, 34, 5); // 34 - 5 = 29 < 34 minDte
    expect(decompOutOfRange).toBeNull();
  });
});
