import { describe, it, expect, beforeEach } from 'vitest';
import { alertManager } from '../engines/alertEngine';
import { DecisionResult, DatasetMetadata } from '../types/market';
import { evaluateLifecycleEligibility } from '../engines/lifecycleEngine';

describe('AUREX Platform Alerts & Notifications Engine', () => {
  beforeEach(() => {
    alertManager.clearAlerts();
  });

  it('1. should add and retrieve internal alerts', () => {
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
    alertManager.addAlert({
      category: 'SIGNAL',
      severity: 'ACTION_REQUIRED',
      title: 'Actionable Convergence Spread',
      message: 'Observed spread exceeds total friction',
      pair: ['GOLDM', 'GOLDTEN']
    });

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

  it('4. should trigger alert on signal downgrade / invalidation', () => {
    const actionableDecision: DecisionResult = {
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
      waterfall: { theoreticalEdge: 120, slippage: 20, brokerageTaxes: 30, liquidityHaircut: 15, safetyBuffer: 15, totalFriction: 80, netDefensibleEdge: 40 }
    };

    const noTradeDecision: DecisionResult = {
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 50,
      expectedEdge: 50,
      totalFriction: 80,
      netEdge: -30,
      liquidityScore: 90,
      liquidityGrade: 'PASS',
      decision: 'NO TRADE',
      rationale: 'Friction hurdle exceeds edge',
      triggerRules: ['Rule 2'],
      waterfall: { theoreticalEdge: 50, slippage: 20, brokerageTaxes: 30, liquidityHaircut: 15, safetyBuffer: 15, totalFriction: 80, netDefensibleEdge: -30 }
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

    // Step 1: Decision was ACTIONABLE
    alertManager.evaluateSystemAlerts(actionableDecision, mockMeta);

    // Step 2: Next step decision drops to NO TRADE
    const alertsAfterDrop = alertManager.evaluateSystemAlerts(noTradeDecision, mockMeta);
    const downgradeAlert = alertsAfterDrop.find(a => a.title.includes('Downgraded / Invalidated'));
    expect(downgradeAlert).toBeDefined();
    expect(downgradeAlert?.severity).toBe('WARNING');
    expect(downgradeAlert?.triggerRule).toContain('State Transition');
  });

  it('5. should trigger critical alert on contract entering delivery tender window', () => {
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
      waterfall: { theoreticalEdge: 120, slippage: 20, brokerageTaxes: 30, liquidityHaircut: 15, safetyBuffer: 15, totalFriction: 80, netDefensibleEdge: 40 }
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

    // Evaluate leg in 3-day tender window (ROLL_WINDOW)
    const tenderLeg = evaluateLifecycleEligibility('GOLDM', '2026-11-02', '2026-11-05');
    expect(tenderLeg.lifecycleStage).toBe('ROLL_WINDOW');

    const generated = alertManager.evaluateSystemAlerts(mockDecision, mockMeta, { legA: tenderLeg });
    const tenderAlert = generated.find(a => a.category === 'LIFECYCLE');
    expect(tenderAlert).toBeDefined();
    expect(tenderAlert?.severity).toBe('CRITICAL');
    expect(tenderAlert?.title).toContain('Tender Window');
  });

  it('6. should trigger critical data health alert when dataset contains 0 records', () => {
    const mockDecision: DecisionResult = {
      pair: ['GOLDM', 'GOLDTEN'],
      observedSpread: 0,
      expectedEdge: 0,
      totalFriction: 80,
      netEdge: -80,
      liquidityScore: 0,
      liquidityGrade: 'FAIL',
      decision: 'NO TRADE',
      rationale: 'No data',
      triggerRules: [],
      waterfall: { theoreticalEdge: 0, slippage: 0, brokerageTaxes: 0, liquidityHaircut: 0, safetyBuffer: 0, totalFriction: 80, netDefensibleEdge: -80 }
    };

    const emptyMeta: DatasetMetadata = {
      provenance: 'USER-IMPORTED DATA — SOURCE UNVERIFIED',
      filename: 'empty.csv',
      totalRows: 0,
      validRows: 0,
      rejectedRows: 0,
      duplicateCount: 0,
      missingFieldCount: 0,
      dateRange: { start: '', end: '' },
      contractCoverage: {
        GOLDM: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDTEN: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDGUINEA: { count: 0, earliestDate: '', latestDate: '', expiries: [] },
        GOLDPETAL: { count: 0, earliestDate: '', latestDate: '', expiries: [] }
      },
      knownLimitations: [],
      sourceClassification: 'Empty'
    };

    const generated = alertManager.evaluateSystemAlerts(mockDecision, emptyMeta);
    const emptyAlert = generated.find(a => a.title.includes('Empty Market Dataset'));
    expect(emptyAlert).toBeDefined();
    expect(emptyAlert?.severity).toBe('CRITICAL');
  });
});
