import {
  formatDisplayDate,
  formatDisplayDateRange,
  formatDisplayDateText,
  formatDisplayDateTime,
} from './date-display.util';

describe('date display utilities', () => {
  it('將日期、日期區間與日期時間統一顯示為斜線格式', () => {
    expect(formatDisplayDateText('2026-08-05')).toBe('2026/08/05');
    expect(formatDisplayDateText('2026-08-05 11:00 - 2026-08-08 19:00'))
      .toBe('2026/08/05 11:00 - 2026/08/08 19:00');
    expect(formatDisplayDateTime('2026-08-05T11:00:59')).toBe('2026/08/05 11:00');
    expect(formatDisplayDateText('2026-08-05T11:00:59')).toBe('2026/08/05 11:00:59');
    expect(formatDisplayDateRange('2026-08-05 11:00 - 2026-08-08 19:00'))
      .toBe('2026/08/05 - 2026/08/08');
  });

  it('不改動 API 日期以外的一般文字', () => {
    expect(formatDisplayDateText('ABC-1234')).toBe('ABC-1234');
    expect(formatDisplayDateText('-')).toBe('-');
    expect(formatDisplayDate(null)).toBe('-');
  });
});
