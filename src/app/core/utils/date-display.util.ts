/**
 * 將 API 回傳的西元日期統一轉成前端顯示格式。
 *
 * 僅處理以 yyyy-MM-dd 或 yyyy/MM/dd 開頭的字串；不改動 API 傳輸值、
 * input[type=date] 的值，也不誤改一般文字中的連字號。
 */
export function formatDisplayDateText(value: string): string;
export function formatDisplayDateText(value: unknown): unknown;
export function formatDisplayDateText(value: unknown): unknown {
  if (typeof value !== 'string') return value;

  return value.replace(
    /(^|[^\d])(\d{4})-(\d{2})-(\d{2})(?=$|[^\d])/g,
    (_match, prefix: string, year: string, month: string, day: string) =>
      `${prefix}${year}/${month}/${day}`,
  ).replace(/(\d{4}\/\d{2}\/\d{2})T(?=\d{2}:\d{2})/g, '$1 ');
}

/** 將單一日期值轉成 yyyy/MM/dd；空值顯示替代文字。 */
export function formatDisplayDate(value: string | null | undefined, fallback = '-'): string {
  if (!value?.trim()) return fallback;
  return String(formatDisplayDateText(value.trim().slice(0, 10)));
}

/** 將日期時間轉成 yyyy/MM/dd HH:mm；無效值保留原文。 */
export function formatDisplayDateTime(value: string | null | undefined, fallback = '-'): string {
  if (!value?.trim()) return fallback;

  const normalized = value.trim().replace('T', ' ');
  const match = normalized.match(/^(\d{4}[-/]\d{2}[-/]\d{2})(?:\s+(\d{2}:\d{2}))?/);
  if (!match) return value;

  const date = String(formatDisplayDateText(match[1]));
  return match[2] ? `${date} ${match[2]}` : date;
}

/** 將含時間的起訖區間轉成 yyyy/MM/dd - yyyy/MM/dd。 */
export function formatDisplayDateRange(value: string | null | undefined, fallback = '-'): string {
  if (!value?.trim()) return fallback;

  const dates = value.match(/\d{4}[-/]\d{2}[-/]\d{2}/g);
  if (!dates?.length) return value;

  const startDate = formatDisplayDate(dates[0], fallback);
  const endDate = formatDisplayDate(dates[dates.length - 1], fallback);
  return startDate === endDate ? startDate : `${startDate} - ${endDate}`;
}
