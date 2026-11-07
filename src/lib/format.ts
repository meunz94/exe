const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const WEEKDAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];

export const pad2 = (n: number | string) => String(n).padStart(2, "0");

export function parseDate(s: string): Date | null {
  if (!s) return null;
  const m = s.match(/^(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** 2026.10.31 */
export function dotDate(s: string): string {
  const d = parseDate(s);
  if (!d) return s;
  return `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

/** 10.31 */
export function shortDate(s: string): string {
  const d = parseDate(s);
  if (!d) return s;
  return `${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}`;
}

export function monthAbbr(s: string): string {
  const d = parseDate(s);
  return d ? MONTHS[d.getMonth()] : "";
}

export function dayOf(s: string): string {
  const d = parseDate(s);
  return d ? pad2(d.getDate()) : "";
}

export function weekdayAbbr(s: string): string {
  const d = parseDate(s);
  return d ? WEEKDAYS[d.getDay()] : "";
}

export function koreanDate(s: string): string {
  const d = parseDate(s);
  if (!d) return s;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEKDAYS_KO[d.getDay()]}요일`;
}

export function isRecent(s: string, days = 7): boolean {
  const d = parseDate(s);
  if (!d) return false;
  return Date.now() - d.getTime() < days * 86400000;
}

export function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** "12–34" 같은 쪽 표기의 시작값. 숫자가 없으면 Infinity (뒤로) */
export function pageStart(pages: string): number {
  const m = String(pages ?? "").match(/\d+/);
  return m ? Number(m[0]) : Infinity;
}

/** 스토리 정렬: 권 오름차순, 같은 권이면 쪽 시작값 오름차순 */
export function byVolAndPage<T extends { vol: number; pages: string }>(a: T, b: T): number {
  return a.vol - b.vol || pageStart(a.pages) - pageStart(b.pages);
}
