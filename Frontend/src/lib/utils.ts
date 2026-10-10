import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ------------------------------------------------------------------
// Date / time helpers — everything displayed in Australia/Sydney
// ------------------------------------------------------------------

const SYDNEY_TZ = "Australia/Sydney";
const AU_LOCALE = "en-AU";

/** Shared Intl.DateTimeFormat options for Australia/Sydney. */
const dateAndTimeOpts: Intl.DateTimeFormatOptions = {
  timeZone: SYDNEY_TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",           // shows AEST / AEDT
};

const dateOnlyOpts: Intl.DateTimeFormatOptions = {
  timeZone: SYDNEY_TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
};

const timeOnlyOpts: Intl.DateTimeFormatOptions = {
  timeZone: SYDNEY_TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
  timeZoneName: "short",
};

/** Format a timestamptz ISO string as Sydney date + time with zone (e.g. "11 Oct, 02:30 pm AEDT"). */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(AU_LOCALE, dateAndTimeOpts).format(new Date(iso));
}

/** Format a timestamptz ISO string as Sydney date only. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(AU_LOCALE, dateOnlyOpts).format(new Date(iso));
}

/** Format a timestamptz ISO string as Sydney time only with zone (e.g. "02:30 pm AEDT"). */
export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(AU_LOCALE, timeOnlyOpts).format(new Date(iso));
}

/**
 * Format a plain YYYY-MM-DD date string for display.
 * Uses local construction so UTC midnight doesn't shift the day.
 */
export function formatPlainDate(
  dateStr: string | null | undefined,
): string {
  if (!dateStr) return "—";
  const parts = String(dateStr).split("-");
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts.map(Number);
  return new Intl.DateTimeFormat(AU_LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(y, m - 1, d));
}

/** Format a DB time column value (HH:MM:SS) as Sydney-style 12 h (e.g. "7:00 am"). */
export function formatShiftTime(
  timeStr: string | null | undefined,
): string {
  if (!timeStr) return "—";
  const parts = String(timeStr).split(":");
  if (parts.length < 2) return timeStr;
  const [h, m] = parts.map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}
