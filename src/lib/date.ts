import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  getISODay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";

export const DATE_FORMAT = "yyyy-MM-dd";
export const MONTH_FORMAT = "yyyy-MM";

export function todayIso(): string {
  return format(new Date(), DATE_FORMAT);
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function parseDateIso(date: string): Date {
  return parseISO(date);
}

export function startOfIsoWeekDate(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 });
}

export function monthGridDates(month: string): Date[] {
  const monthStart = startOfMonth(parseISO(`${month}-01`));
  const monthEnd = endOfMonth(monthStart);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });

  return eachDayOfInterval({ start: gridStart, end: gridEnd });
}

export function toDateIso(date: Date): string {
  return format(date, DATE_FORMAT);
}

export function toMonthIso(date: Date): string {
  return format(date, MONTH_FORMAT);
}

export function getIsoWeekday(date: string): number {
  return getISODay(parseISO(date));
}

export function isDateInMonth(date: Date, month: string): boolean {
  return isSameMonth(date, parseISO(`${month}-01`));
}

export function addMonthOffset(month: string, offset: number): string {
  const current = parseISO(`${month}-01`);
  const shifted = new Date(current);
  shifted.setMonth(current.getMonth() + offset);
  return toMonthIso(shifted);
}

export function dateRange(from: string, to: string): string[] {
  const start = parseISO(from);
  const end = parseISO(to);
  return eachDayOfInterval({ start, end }).map(toDateIso);
}

export function addDaysIso(date: string, days: number): string {
  return toDateIso(addDays(parseISO(date), days));
}
