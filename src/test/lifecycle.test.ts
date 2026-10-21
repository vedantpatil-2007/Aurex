import { describe, it, expect } from 'vitest';
import {
  evaluateLifecycleEligibility,
  evaluatePairLifecycleEligibility
} from '../engines/lifecycleEngine';

describe('AUREX Contract Lifecycle & Eligibility Engine', () => {
  it('1. should permit trading in NORMAL lifecycle stage (> 15 days to expiry)', () => {
    const res = evaluateLifecycleEligibility('GOLDM', '2026-09-01', '2026-11-05');
    expect(res.daysToExpiry).toBe(65);
    expect(res.lifecycleStage).toBe('NORMAL');
    expect(res.isEligibleForNewEntry).toBe(true);
    expect(res.mustForcedExit).toBe(false);
  });

  it('2. should issue warnings in NEAR_EXPIRY stage (6 to 15 days to expiry)', () => {
    const res = evaluateLifecycleEligibility('GOLDM', '2026-10-25', '2026-11-05');
    expect(res.daysToExpiry).toBe(11);
    expect(res.lifecycleStage).toBe('NEAR_EXPIRY');
    expect(res.isEligibleForNewEntry).toBe(true);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('3. should strictly BAR new entries during MCX 5-day compulsory delivery tender window', () => {
    // 3 days to expiry
    const res = evaluateLifecycleEligibility('GOLDM', '2026-11-02', '2026-11-05');
    expect(res.daysToExpiry).toBe(3);
    expect(res.lifecycleStage).toBe('ROLL_WINDOW');
    expect(res.isEligibleForNewEntry).toBe(false);
    expect(res.mustForcedExit).toBe(true);
    expect(res.rejectionReason).toContain('tender window');
  });

  it('4. should reject contracts prior to official launch date (GOLDTEN before 2025-04-01)', () => {
    const res = evaluateLifecycleEligibility('GOLDTEN', '2024-10-01', '2024-11-28');
    expect(res.isEligibleForNewEntry).toBe(false);
    expect(res.rejectionReason).toContain('2025-04-01');
  });

  it('5. should reject pair entry if either leg fails lifecycle eligibility', () => {
    // Leg A in normal stage, Leg B in tender window (3 days left)
    const pairRes = evaluatePairLifecycleEligibility(
      ['GOLDM', 'GOLDTEN'],
      '2026-10-27',
      '2026-11-05', // 9 days left
      '2026-10-30'  // 3 days left (tender window)
    );
    expect(pairRes.isEligible).toBe(false);
    expect(pairRes.rejectionReason).toContain('GOLDTEN');
    expect(pairRes.rejectionReason).toContain('tender window');
  });
});
