import { describe, it, expect } from 'vitest';
import { alertManager } from '../engines/alertEngine';
import { DecisionResult, DatasetMetadata } from '../types/market';

describe('AUREX Platform Alerts & Notifications Engine', () => {
  it('1. should add and retrieve internal alerts', () => {
    alertManager.clearAlerts();

    const alert = alertManager.addAlert({
      category: 'SIGNAL',
      severity: 'ACTION_REQUIRED',
      title: 'Actionable Convergence Spread',
      message: 'Observed spread exceeds total friction',
      pair: ['GOLDM', 'GOLDTEN']
    });

    expect(alert).not.toBeNull();
    expect(alertManager.getAlerts().length).toBe(1);
    expect(alertManager.getUnreadCount()).toBe(1);
  });

  it('2. should strictly deduplicate repeated alerts with same key', () => {
    // Attempting to add the exact same alert again
    const dupe = alertManager.addAlert({
      category: 'SIGNAL',
      severity: 'ACTION_REQUIRED',
      title: 'Actionable Convergence Spread',
      message: 'Observed spread exceeds total friction',
      pair: ['GOLDM', 'GOLDTEN']
    });

    expect(dupe).toBeNull(); // Deduplicated
    expect(alertManager.getAlerts().length).toBe(1);
  });

  it('3. should generate system alerts from decision outputs', () => {
    const mockDecision: DecisionResult = {
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 120,
      expectedEdge: 120,
      totalFriction: 80,
      netEdge: 40,
      liquidityScore: 90,
      liquidityGrade: 'PASS',
      decision: 'ACTIONABLE',
      rationale: 'Positive net edge',
      triggerRules: ['Rule 1'],
      waterfall: {
        theoreticalEdge: 120,
        slippage: 20,
        brokerageTaxes: 30,
        liquidityHaircut: 15,
        safetyBuffer: 15,
        totalFriction: 80,
        netDefensibleEdge: 40
      }
    };

    const mockMeta: DatasetMetadata = {
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      filename: 'test.csv',
      totalRows: 10,
      validRows: 10,
      rejectedRows: 0,
      duplicateCount: 0,
      missingFieldCount: 0,
      dateRange: { start: '2026-09-01', end: '2026-09-10' },
      contractCoverage: {
        GOLDM: { count: 5, earliestDate: '', latestDate: '', expiries: [] },
        GOLDTEN: { count: 5, earliestDate: '', latestDate: '', expiries: [] },
        GOLDGUINEA: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDPETAL: { count: 0, earliestDate: '', latestDate: '', expiries: [] }
      },
      knownLimitations: [],
      sourceClassification: 'User-Provided'
    };

    const generated = alertManager.evaluateSystemAlerts(mockDecision, mockMeta);
    expect(generated.length).toBeGreaterThan(0);
    expect(generated.some(a => a.category === 'SIGNAL')).toBe(true);
  });
});
