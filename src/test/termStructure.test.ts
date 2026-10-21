import { describe, it, expect } from 'vitest';
import {
  buildFuturesCurve,
  interpolateConstantMaturity,
  decomposeRollDownAndCurveShift
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

    // Annualized simple carry: 100 * ((75703.11 / 74900) - 1) * (365 / 61) â‰ˆ 6.42%
    expect(curve.annualizedSimpleCarry).toBeCloseTo(6.42, 1);

    // Annualized continuously compounded carry: 100 * (365 / 61) * ln(75703.11 / 74900) â‰ˆ 6.38%
    expect(curve.annualizedCompoundedCarry).toBeCloseTo(6.38, 1);
  });

  it('3. should interpolate constant-maturity reference prices without extrapolation', () => {
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

  it('4. should decompose roll-down and curve shift correctly', () => {
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
    }
  });
});
