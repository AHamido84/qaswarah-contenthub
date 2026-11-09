const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

function toLatinDigits(s: string): string {
  return s.replace(ARABIC_DIGITS, (d) => {
    const code = d.charCodeAt(0);
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

/** Google Sheets serial date (days since 1899-12-30) → yyyy-mm-dd. */
export function serialToIso(serial: number): string | null {
  if (!Number.isFinite(serial) || serial < 1 || serial > 2958465) return null;
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  return new Date(ms).toISOString().slice(0, 10);
}

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date.toISOString().slice(0, 10);
}

/** Whether a spreadsheet locale writes dates month-first (en_US and friends). */
export function isMonthFirstLocale(locale: string): boolean {
  return /^en_(US|PH|CA)$/i.test(locale) || locale === "en";
}

/**
 * Parses what a person typed into a date cell. Unambiguous forms are always accepted;
 * for a/b/yyyy the spreadsheet locale decides whether a is the month or the day.
 */
export function parseDateText(raw: string, monthFirst: boolean): string | null {
  const s = toLatinDigits(raw).trim();
  if (!s) return null;

  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);

  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/);
  if (m) {
    const a = +m[1]!;
    const b = +m[2]!;
    const y = +m[3]!;
    if (a > 12) return iso(y, b, a);
    if (b > 12) return iso(y, a, b);
    return monthFirst ? iso(y, a, b) : iso(y, b, a);
  }
  return null;
}

export function cellToIsoDate(
  cell: { text: string; number?: number } | undefined,
  monthFirst: boolean,
): string | null {
  if (!cell) return null;
  if (typeof cell.number === "number") return serialToIso(cell.number);
  return parseDateText(cell.text, monthFirst);
}
