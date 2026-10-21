/**
 * MCX Exchange Trading Calendar & Business Day Utilities
 *
 * Implements authoritative trading day calculations excluding weekends (Saturdays & Sundays)
 * and gazetted MCX commodity derivatives market holidays.
 *
 * References:
 * - MCX Annual Trading Holiday Circulars (2025 & 2026)
 * - SEBI Master Circular for Commodity Derivatives Exchanges
 */

/**
 * Standard gazetted MCX trading holidays for 2025 and 2026 (Evening session bullion exclusion/closure dates)
 */
export const OFFICIAL_MCX_HOLIDAYS_2025_2026: readonly string[] = [
  // 2025 Gazetted Holidays
  '2025-01-26', // Republic Day
  '2025-02-26', // Mahashivratri
  '2025-03-14', // Holi
  '2025-03-31', // Id-Ul-Fitr
  '2025-04-10', // Shri Mahavir Jayanti
  '2025-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2025-04-18', // Good Friday
  '2025-05-01', // Maharashtra Day
  '2025-06-07', // Bakri Id / Eid-ul-Adha
  '2025-08-15', // Independence Day
  '2025-08-27', // Ganesh Chaturthi
  '2025-10-02', // Mahatma Gandhi Jayanti
  '2025-10-21', // Diwali Laxmi Pujan
  '2025-10-22', // Diwali Balipratipada
  '2025-11-05', // Gurunanak Jayanti
  '2025-12-25', // Christmas

  // 2026 Gazetted Holidays
  '2026-01-26', // Republic Day
  '2026-02-15', // Mahashivratri
  '2026-03-04', // Holi
  '2026-03-20', // Id-Ul-Fitr
  '2026-04-03', // Good Friday
  '2026-04-14', // Dr. Baba Saheb Ambedkar Jayanti
  '2026-05-01', // Maharashtra Day
  '2026-05-27', // Bakri Id
  '2026-08-15', // Independence Day
  '2026-10-02', // Mahatma Gandhi Jayanti
  '2026-10-20', // Dussehra
  '2026-11-08', // Diwali Laxmi Pujan
  '2026-11-24', // Gurunanak Jayanti
  '2026-12-25'  // Christmas
];

/**
 * Checks if a given date string or Date object falls on a weekend (Saturday or Sunday).
 */
export function isWeekend(dateInput: string | Date): boolean {
  const d = typeof dateInput === 'string' ? new Date(dateInput + 'T00:00:00Z') : dateInput;
  const day = d.getUTCDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Formats a Date to YYYY-MM-DD string in UTC.
 */
export function formatDateUTC(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Checks whether a given calendar date is an active MCX trading day.
 * Returns false if it is a weekend or listed in official MCX trading holidays.
 */
export function isMCXTradingDay(
  dateStr: string,
  customHolidays: readonly string[] = OFFICIAL_MCX_HOLIDAYS_2025_2026
): boolean {
  if (isWeekend(dateStr)) return false;
  return !customHolidays.includes(dateStr);
}

/**
 * Calculates the exact number of trading days between two dates.
 *
 * Convention:
 * - If startDate === endDate, returns 0.
 * - If startDate > endDate, returns negative count of trading days.
 * - Counts each intervening day that is a valid trading day (excluding weekends & holidays).
 * - For days to expiry: counts trading days starting from day after startDate up to and including endDate.
 */
export function calculateTradingDays(
  startDateStr: string,
  endDateStr: string,
  customHolidays: readonly string[] = OFFICIAL_MCX_HOLIDAYS_2025_2026
): number {
  if (!startDateStr || !endDateStr) return 0;
  if (startDateStr === endDateStr) return 0;

  const isReversed = startDateStr > endDateStr;
  const start = new Date((isReversed ? endDateStr : startDateStr) + 'T00:00:00Z');
  const end = new Date((isReversed ? startDateStr : endDateStr) + 'T00:00:00Z');

  let tradingDays = 0;
  const curr = new Date(start);
  curr.setUTCDate(curr.getUTCDate() + 1);

  while (curr <= end) {
    const dateStr = formatDateUTC(curr);
    if (isMCXTradingDay(dateStr, customHolidays)) {
      tradingDays++;
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  return isReversed ? -tradingDays : tradingDays;
}
