import type { CellWrite, RawSheet, RawWorkbook } from "./types";

/**
 * The only boundary between the app and storage. The Google implementation talks to the
 * Sheets API; the demo implementation keeps an in-memory grid with the same quirks.
 * All coordinates are 0-based grid positions.
 */
export interface SheetGateway {
  readonly kind: "google" | "demo";
  fetchWorkbook(): Promise<RawWorkbook>;
  /** Re-reads one tab fresh (no cache) – used right before writes. */
  fetchSheet(sheetId: number): Promise<RawSheet>;
  writeCells(sheetId: number, writes: CellWrite[]): Promise<void>;
  clearCells(sheetId: number, cells: { row: number; col: number }[]): Promise<void>;
  /** Grows the grid so that `rowCount` rows exist. */
  ensureRows(sheetId: number, rowCount: number): Promise<void>;
  duplicateSheet(sheetId: number, title: string, opts: { hidden?: boolean; index?: number }): Promise<number>;
  addSheet(title: string, opts: { hidden?: boolean; index?: number }): Promise<number>;
  /** Clears values (not validation or formatting) in a rectangular block. */
  clearBlock(sheetId: number, block: { startRow: number; endRow: number; startCol: number; endCol: number }): Promise<void>;
  /** Removes data validation in a block (used only when retiring duplicate columns). */
  clearValidation(sheetId: number, block: { startRow: number; endRow: number; startCol: number; endCol: number }): Promise<void>;
  appendRow(sheetId: number, values: string[]): Promise<void>;
  sheetIdByTitle(title: string): Promise<number | null>;
}
