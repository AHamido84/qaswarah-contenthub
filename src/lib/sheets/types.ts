import type { FieldKey, SelectFieldKey } from "./schema";

/** A cell as the gateway hands it to the domain layer (source-agnostic). */
export interface RawCell {
  /** What the user sees in the sheet. */
  text: string;
  /** Underlying number, when the cell holds one (dates arrive as serial numbers). */
  number?: number;
  /** Hyperlink target, from a link, a rich-text run or a smart chip. */
  link?: string;
  validation?: RawValidation;
}

export type RawValidation =
  | { kind: "list"; values: string[]; strict: boolean }
  | { kind: "range"; ref: string; values: string[]; strict: boolean };

export interface GridRange {
  startRow: number;
  endRow: number; // exclusive
  startCol: number;
  endCol: number; // exclusive
}

export interface RawSheet {
  sheetId: number;
  title: string;
  index: number;
  hidden: boolean;
  rowCount: number;
  columnCount: number;
  merges: GridRange[];
  /** Grid from A1. Rows/cells may be ragged; missing = empty. */
  cells: RawCell[][];
}

export interface RawWorkbook {
  spreadsheetId: string;
  title: string;
  locale: string;
  timeZone: string;
  sheets: RawSheet[];
}

/** A single cell write. `row`/`col` are 0-based grid coordinates. */
export interface CellWrite {
  row: number;
  col: number;
  value: string;
}

// ─── Domain ──────────────────────────────────────────────────────────────────

export type IdeaFields = Record<FieldKey, string>;

export interface Idea extends IdeaFields {
  /** 1-based sheet row number; the idea's identity within its tab. */
  row: number;
  /** Hash of the row's current values, used for optimistic concurrency. */
  version: string;
  /** ISO yyyy-mm-dd when `targetDate` could be parsed. */
  targetDateIso: string | null;
}

export interface DuplicateColumn {
  field: FieldKey;
  header: string;
  primaryCol: number;
  duplicateCol: number;
  /** Rows (1-based) where the duplicate has a value and the primary column is empty. */
  recoverableRows: number[];
  /** Rows where both columns have different values. */
  conflictingRows: number[];
  /** Rows where the duplicate repeats the primary value exactly. */
  identicalRows: number[];
  filledCount: number;
}

export interface SheetLayout {
  headerRow: number; // 0-based
  columns: Partial<Record<FieldKey, number>>; // 0-based column per field
  duplicates: DuplicateColumn[];
  missingFields: FieldKey[];
  unknownHeaders: { col: number; header: string }[];
  /** Merges that touch the header row or the mapped columns. */
  merges: GridRange[];
}

export type IssueSeverity = "error" | "warning" | "info";

export interface Issue {
  code:
    | "duplicate-columns"
    | "missing-columns"
    | "unknown-columns"
    | "merged-cells"
    | "header-row-moved"
    | "missing-validation"
    | "off-list-values"
    | "unparsed-dates";
  severity: IssueSeverity;
  title: string;
  detail: string;
  fixable?: boolean;
}

export interface FieldOptions {
  values: string[];
  source: "validation" | "default";
  /** When true, the sheet rejects values outside the list, so the app must not offer free text. */
  strict: boolean;
  /** Values present in rows but absent from the list. */
  offList: string[];
}

export interface Company {
  id: number; // sheetId (gid) – stable across renames
  name: string;
  index: number;
  layout: SheetLayout;
  ideas: Idea[];
  placeholderRows: number;
  options: Record<SelectFieldKey, FieldOptions>;
  issues: Issue[];
}

export interface Workbook {
  spreadsheetId: string;
  title: string;
  timeZone: string;
  companies: Company[];
  ignoredTabs: { id: number; name: string; reason: string }[];
  fetchedAt: string;
  source: "google" | "demo";
}
