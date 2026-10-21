import { describe, it, expect } from 'vitest';
import {
  evaluateLifecycleEligibility,
  evaluatePairLifecycleEligibility
} from '../engines/lifecycleEngine';
import {
  isWeekend,
  isMCXTradingDay,
  calculateTradingDays,
  OFFICIAL_MCX_HOLIDAYS_2025_2026
} from '../utils/exchangeCalendar';

describe('AUREX Contract Lifecycle & Eligibility Engine', () => {
  it('1. should permit trading in NORMAL lifecycle stage (> 15 days to expiry)', () => {
    const res = evaluateLifecycleEligibility('GOLDM', '2026-09-01', '2026-11-05');
    expect(res.daysToExpiry).toBe(65);
    expect(res.tradingDaysToExpiry).toBeGreaterThan(40);
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
    // 3 calendar days to expiry
    const res = evaluateLifecycleEligibility('GOLDM', '2026-11-02', '2026-11-05');
    expect(res.daysToExpiry).toBe(3);
    expect(res.lifecycleStage).toBe('ROLL_WINDOW');
    expect(res.isEligibleForNewEntry).toBe(false);
    expect(res.mustForcedExit).toBe(true);
    expect(res.rejectionReason).toContain('tender window');
    expect(res.rejectionReason).toContain('compulsory delivery');
  });

  it('4. should correctly enforce 5 TRADING DAYS tender window accounting for weekends and gazetted holidays', () => {
    // Expiry: Friday 27-Nov-2026
    // Note: 2026-11-24 is Gurunanak Jayanti (MCX trading holiday)
    // Thursday 19-Nov-2026 is 8 calendar days before expiry, BUT exactly 5 trading sessions:
    // (Fri 20, Mon 23, [Tue 24 Holiday], Wed 25, Thu 26, Fri 27 = 5 trading sessions)
    const resThursday = evaluateLifecycleEligibility('GOLDTEN', '2026-11-19', '2026-11-27');
    expect(resThursday.daysToExpiry).toBe(8); // 8 calendar days
    expect(resThursday.tradingDaysToExpiry).toBe(5); // exactly 5 trading days!
    // Because MCX compulsory delivery tender period is 5 TRADING DAYS, this MUST be in ROLL_WINDOW!
    expect(resThursday.lifecycleStage).toBe('ROLL_WINDOW');
    expect(resThursday.isEligibleForNewEntry).toBe(false);
    expect(resThursday.mustForcedExit).toBe(true);
    expect(resThursday.rejectionReason).toContain('5-trading-day tender window');

    // Friday 20-Nov-2026 is 4 trading days before expiry (still in ROLL_WINDOW)
    const resFriday = evaluateLifecycleEligibility('GOLDTEN', '2026-11-20', '2026-11-27');
    expect(resFriday.tradingDaysToExpiry).toBe(4);
    expect(resFriday.isEligibleForNewEntry).toBe(false);
    expect(resFriday.lifecycleStage).toBe('ROLL_WINDOW');

    // Wednesday 18-Nov-2026 is 6 trading days before expiry -> still eligible for entry
    const resWed = evaluateLifecycleEligibility('GOLDTEN', '2026-11-18', '2026-11-27');
    expect(resWed.tradingDaysToExpiry).toBe(6);
    expect(resWed.isEligibleForNewEntry).toBe(true);
    expect(resWed.lifecycleStage).toBe('NEAR_EXPIRY');
  });

  it('5. should skip official MCX trading holidays in trading days calculation', () => {
    // 2026-10-02 is Mahatma Gandhi Jayanti (MCX gazetted holiday)
    expect(OFFICIAL_MCX_HOLIDAYS_2025_2026).toContain('2026-10-02');
    expect(isMCXTradingDay('2026-10-02')).toBe(false);

    // From Thu 01-Oct-2026 to Mon 05-Oct-2026:
    // Calendar days: 4 days (Oct 2, 3, 4, 5)
    // Oct 2 = Holiday, Oct 3 = Sat, Oct 4 = Sun, Oct 5 = Mon (Trading Day 1)
    // Trading days = 1 trading day!
    const tDays = calculateTradingDays('2026-10-01', '2026-10-05');
    expect(tDays).toBe(1);

    // Verify weekends are recognized
    expect(isWeekend('2026-10-03')).toBe(true); // Saturday
    expect(isWeekend('2026-10-04')).toBe(true); // Sunday
    expect(isWeekend('2026-10-05')).toBe(false); // Monday
  });

  it('6. should reject contracts prior to official launch date (GOLDTEN before 2025-04-01)', () => {
    const res = evaluateLifecycleEligibility('GOLDTEN', '2024-10-01', '2024-11-28');
    expect(res.isEligibleForNewEntry).toBe(false);
    expect(res.rejectionReason).toContain('2025-04-01');
    expect(res.rejectionReason).toContain('MCX/TRD/134/2025');
  });

  it('7. should reject expired contracts with explicit rejection', () => {
    const resExpired = evaluateLifecycleEligibility('GOLDM', '2026-11-06', '2026-11-05');
    expect(resExpired.isEligibleForNewEntry).toBe(false);
    expect(resExpired.mustForcedExit).toBe(true);
    expect(resExpired.lifecycleStage).toBe('ROLL_WINDOW');
    expect(resExpired.rejectionReason).toContain('has expired');
  });

  it('8. should reject pair entry if either leg fails lifecycle eligibility', () => {
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

  it('9. should safely reject contracts with missing or invalid expiry metadata without crashing', () => {
    const resEmpty = evaluateLifecycleEligibility('GOLDM', '2026-10-20', '');
    expect(resEmpty.isEligibleForNewEntry).toBe(false);
    expect(resEmpty.mustForcedExit).toBe(true);
    expect(resEmpty.rejectionReason).toContain('Missing or invalid expiry date');

    const resInvalid = evaluateLifecycleEligibility('GOLDM', '2026-10-20', 'NOT-A-DATE');
    expect(resInvalid.isEligibleForNewEntry).toBe(false);
    expect(resInvalid.rejectionReason).toContain('Missing or invalid expiry date');
  });
});
