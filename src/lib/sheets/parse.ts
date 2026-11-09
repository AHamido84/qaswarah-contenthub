import { cellToIsoDate, isMonthFirstLocale } from "./dates";
import {
  DEFAULT_OPTIONS,
  FIELD_BY_KEY,
  FIELD_KEYS,
  SELECT_FIELDS,
  fieldForHeader,
  normalizeLabel,
  type FieldKey,
  type SelectFieldKey,
} from "./schema";
import type {
  Company,
  DuplicateColumn,
  FieldOptions,
  GridRange,
  Idea,
  IdeaFields,
  Issue,
  RawCell,
  RawSheet,
  SheetLayout,
} from "./types";

const HEADER_SCAN_ROWS = 10;

export const cellAt = (sheet: RawSheet, row: number, col: number): RawCell | undefined =>
  sheet.cells[row]?.[col];

const textAt = (sheet: RawSheet, row: number, col: number) =>
  normalizeLabel(cellAt(sheet, row, col)?.text ?? "");

export function colLetter(col: number): string {
  let s = "";
  let n = col + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

/** FNV-1a – small, deterministic, identical on server and client. */
export function hashFields(fields: IdeaFields): string {
  const input = FIELD_KEYS.map((k) => fields[k] ?? "").join("␟");
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Finds the header row: the row among the first ten that matches the most known headers. */
export function findHeaderRow(sheet: RawSheet): number | null {
  let best: { row: number; score: number } | null = null;
  const limit = Math.min(HEADER_SCAN_ROWS, sheet.cells.length);
  for (let r = 0; r < limit; r++) {
    const row = sheet.cells[r] ?? [];
    let score = 0;
    let hasTitle = false;
    for (const cell of row) {
      const key = cell ? fieldForHeader(cell.text) : undefined;
      if (key) score++;
      if (key === "title") hasTitle = true;
    }
    if (hasTitle && (!best || score > best.score)) best = { row: r, score };
  }
  return best?.row ?? null;
}

function mergeCovering(merges: GridRange[], row: number, col: number): GridRange | undefined {
  return merges.find(
    (m) => row >= m.startRow && row < m.endRow && col >= m.startCol && col < m.endCol,
  );
}

function lastContentRow(sheet: RawSheet, cols: number[], from: number): number {
  for (let r = sheet.cells.length - 1; r >= from; r--) {
    if (cols.some((c) => textAt(sheet, r, c) !== "")) return r;
  }
  return from - 1;
}

export function analyzeLayout(sheet: RawSheet): SheetLayout | null {
  const headerRow = findHeaderRow(sheet);
  if (headerRow === null) return null;

  const columns: Partial<Record<FieldKey, number>> = {};
  const seen = new Map<FieldKey, number[]>();
  const unknownHeaders: SheetLayout["unknownHeaders"] = [];
  const headerCells = sheet.cells[headerRow] ?? [];

  headerCells.forEach((cell, col) => {
    const label = normalizeLabel(cell?.text ?? "");
    if (!label) return;
    const key = fieldForHeader(label);
    if (!key) {
      unknownHeaders.push({ col, header: label });
      return;
    }
    const list = seen.get(key) ?? [];
    list.push(col);
    seen.set(key, list);
    if (columns[key] === undefined) columns[key] = col;
  });

  const mappedCols = Object.values(columns) as number[];
  const allHeaderCols = [...seen.values()].flat();
  const dataEnd = lastContentRow(sheet, allHeaderCols, headerRow + 1);

  const duplicates: DuplicateColumn[] = [];
  for (const [field, cols] of seen) {
    const [primaryCol, ...rest] = cols;
    for (const duplicateCol of rest) {
      const dup: DuplicateColumn = {
        field,
        header: FIELD_BY_KEY[field].header,
        primaryCol: primaryCol!,
        duplicateCol,
        recoverableRows: [],
        conflictingRows: [],
        identicalRows: [],
        filledCount: 0,
      };
      for (let r = headerRow + 1; r <= dataEnd; r++) {
        const d = textAt(sheet, r, duplicateCol);
        if (!d) continue;
        dup.filledCount++;
        const p = textAt(sheet, r, primaryCol!);
        if (!p) dup.recoverableRows.push(r + 1);
        else if (p === d) dup.identicalRows.push(r + 1);
        else dup.conflictingRows.push(r + 1);
      }
      duplicates.push(dup);
    }
  }

  const relevant = new Set([...mappedCols, ...allHeaderCols]);
  const merges = sheet.merges.filter((m) => {
    for (let c = m.startCol; c < m.endCol; c++) if (relevant.has(c)) return true;
    return false;
  });

  return {
    headerRow,
    columns,
    duplicates,
    missingFields: FIELD_KEYS.filter((k) => columns[k] === undefined),
    unknownHeaders,
    merges,
  };
}

/** Value of a field in a row; honours merges that start at the mapped column (e.g. B:C). */
function readField(sheet: RawSheet, layout: SheetLayout, row: number, key: FieldKey): RawCell | undefined {
  const col = layout.columns[key];
  if (col === undefined) return undefined;
  const cell = cellAt(sheet, row, col);
  if (cell && (cell.text || cell.link)) return cell;
  const merge = mergeCovering(layout.merges, layout.headerRow, col);
  if (merge) {
    for (let c = merge.startCol; c < merge.endCol; c++) {
      if (c === col) continue;
      const other = cellAt(sheet, row, c);
      if (other && (other.text || other.link)) return other;
    }
  }
  return cell;
}

export function readRowFields(sheet: RawSheet, layout: SheetLayout, row: number): IdeaFields {
  const out = {} as IdeaFields;
  for (const key of FIELD_KEYS) {
    const cell = readField(sheet, layout, row, key);
    let value = (cell?.text ?? "").trim();
    if (key === "referenceUrl" && cell?.link) value = cell.link;
    out[key] = value;
  }
  return out;
}

export interface ParsedRows {
  ideas: Idea[];
  placeholderRows: number;
  unparsedDates: number;
}

export function parseIdeas(sheet: RawSheet, layout: SheetLayout, locale: string): ParsedRows {
  const monthFirst = isMonthFirstLocale(locale);
  const ideas: Idea[] = [];
  let placeholderRows = 0;
  let unparsedDates = 0;

  for (let r = layout.headerRow + 1; r < sheet.cells.length; r++) {
    const fields = readRowFields(sheet, layout, r);
    if (!fields.title) {
      // Placeholder rows: dropdown chips with no values, or stray values without an idea.
      placeholderRows++;
      continue;
    }
    const dateCol = layout.columns.targetDate;
    const targetDateIso =
      dateCol === undefined ? null : cellToIsoDate(readField(sheet, layout, r, "targetDate"), monthFirst);
    if (fields.targetDate && !targetDateIso) unparsedDates++;
    ideas.push({ ...fields, row: r + 1, version: hashFields(fields), targetDateIso });
  }
  return { ideas, placeholderRows, unparsedDates };
}

/** Collects data-validation lists from the column below the header (first list wins, by frequency). */
export function readValidation(sheet: RawSheet, layout: SheetLayout, key: FieldKey) {
  const col = layout.columns[key];
  if (col === undefined) return null;
  const tally = new Map<string, { values: string[]; strict: boolean; count: number }>();
  for (let r = layout.headerRow + 1; r < sheet.cells.length; r++) {
    const v = cellAt(sheet, r, col)?.validation;
    if (!v || v.values.length === 0) continue;
    const id = JSON.stringify(v.values);
    const entry = tally.get(id) ?? { values: v.values, strict: v.strict, count: 0 };
    entry.count++;
    tally.set(id, entry);
  }
  let best: { values: string[]; strict: boolean; count: number } | null = null;
  for (const entry of tally.values()) if (!best || entry.count > best.count) best = entry;
  return best;
}

export function buildOptions(
  sheet: RawSheet,
  layout: SheetLayout,
  ideas: Idea[],
): Record<SelectFieldKey, FieldOptions> {
  const result = {} as Record<SelectFieldKey, FieldOptions>;
  for (const key of SELECT_FIELDS) {
    const validation = readValidation(sheet, layout, key);
    const base = validation
      ? validation.values.map(normalizeLabel).filter(Boolean)
      : [...DEFAULT_OPTIONS[key]];
    const known = new Set(base);
    const offList: string[] = [];
    for (const idea of ideas) {
      const v = normalizeLabel(idea[key]);
      if (v && !known.has(v)) {
        known.add(v);
        offList.push(v);
      }
    }
    result[key] = {
      values: validation ? base : [...base, ...offList],
      source: validation ? "validation" : "default",
      strict: validation?.strict ?? false,
      offList: validation ? offList : [],
    };
  }
  return result;
}

export function buildIssues(
  layout: SheetLayout,
  options: Record<SelectFieldKey, FieldOptions>,
  unparsedDates: number,
): Issue[] {
  const issues: Issue[] = [];

  if (layout.headerRow !== 1) {
    issues.push({
      code: "header-row-moved",
      severity: "info",
      title: `العناوين في الصف ${layout.headerRow + 1} بدل الصف 2`,
      detail: "تم اكتشاف صف العناوين تلقائيًا، والقراءة والكتابة تعملان بشكل طبيعي.",
    });
  }

  if (layout.duplicates.length) {
    const cols = layout.duplicates.map((d) => colLetter(d.duplicateCol));
    const recoverable = layout.duplicates.reduce((n, d) => n + d.recoverableRows.length, 0);
    const conflicts = layout.duplicates.reduce((n, d) => n + d.conflictingRows.length, 0);
    issues.push({
      code: "duplicate-columns",
      severity: "error",
      title: `أعمدة مكررة في ${cols[0]}–${cols[cols.length - 1]}`,
      detail: [
        ...layout.duplicates.map(
          (d) =>
            `• ${colLetter(d.duplicateCol)}: «${d.header}» (الأصلي ${colLetter(d.primaryCol)}) — ${d.filledCount} خلية مملوءة`,
        ),
        `التطبيق يقرأ ويكتب في الأعمدة الأصلية فقط. ${recoverable} قيمة موجودة فقط في الأعمدة المكررة، و${conflicts} قيمة تختلف عن الأصل.`,
      ].join("\n"),
      fixable: true,
    });
  }

  if (layout.missingFields.length) {
    issues.push({
      code: "missing-columns",
      severity: layout.missingFields.includes("title") ? "error" : "warning",
      title: "أعمدة غير موجودة",
      detail: `لم يتم العثور على: ${layout.missingFields.map((k) => `«${FIELD_BY_KEY[k].header}»`).join("، ")}. هذه الحقول ستكون للقراءة فقط.`,
    });
  }

  if (layout.unknownHeaders.length) {
    issues.push({
      code: "unknown-columns",
      severity: "info",
      title: "أعمدة إضافية غير معروفة",
      detail: layout.unknownHeaders.map((u) => `${colLetter(u.col)}: «${u.header}»`).join("، ") + " — يتم تجاهلها دون تعديل.",
    });
  }

  if (layout.merges.length) {
    issues.push({
      code: "merged-cells",
      severity: "info",
      title: "خلايا مدمجة",
      detail:
        layout.merges
          .slice(0, 6)
          .map((m) => `${colLetter(m.startCol)}${m.startRow + 1}:${colLetter(m.endCol - 1)}${m.endRow}`)
          .join("، ") + " — تتم القراءة من أول خلية في الدمج والكتابة فيها.",
    });
  }

  for (const key of SELECT_FIELDS) {
    const o = options[key];
    if (o.source === "default") {
      issues.push({
        code: "missing-validation",
        severity: "warning",
        title: `لا توجد قائمة منسدلة لـ«${FIELD_BY_KEY[key].header}»`,
        detail: `يستخدم التطبيق قائمة مقترحة: ${o.values.join("، ")}.`,
      });
    } else if (o.offList.length) {
      issues.push({
        code: "off-list-values",
        severity: "warning",
        title: `قيم خارج قائمة «${FIELD_BY_KEY[key].header}»`,
        detail: `${o.offList.join("، ")} — موجودة في الصفوف لكنها ليست ضمن خيارات القائمة المنسدلة.`,
      });
    }
  }

  if (unparsedDates) {
    issues.push({
      code: "unparsed-dates",
      severity: "warning",
      title: `${unparsedDates} تاريخ غير مفهوم`,
      detail: "قيم في «الموعد المستهدف» ليست تواريخ صالحة؛ تظهر كنص ولا تدخل في التقويم أو التنبيهات.",
    });
  }

  return issues;
}

export function buildCompany(sheet: RawSheet, layout: SheetLayout, locale: string): Company {
  const { ideas, placeholderRows, unparsedDates } = parseIdeas(sheet, layout, locale);
  const options = buildOptions(sheet, layout, ideas);
  return {
    id: sheet.sheetId,
    name: sheet.title,
    index: sheet.index,
    layout,
    ideas,
    placeholderRows,
    options,
    issues: buildIssues(layout, options, unparsedDates),
  };
}
