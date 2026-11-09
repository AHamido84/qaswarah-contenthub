import "server-only";
import { google, type sheets_v4 } from "googleapis";
import type { SheetGateway } from "./gateway";
import { colLetter } from "./parse";
import type { CellWrite, RawCell, RawSheet, RawWorkbook } from "./types";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

const SHEET_FIELDS =
  "sheets(properties(sheetId,title,index,hidden,gridProperties(rowCount,columnCount)),merges," +
  "data(startRow,startColumn,rowData(values(formattedValue,effectiveValue(numberValue)," +
  "hyperlink,dataValidation,chipRuns(chip(richLinkProperties(uri))),textFormatRuns(format(link(uri)))))))";

function quote(title: string) {
  return `'${title.replace(/'/g, "''")}'`;
}

function toRawCell(v: sheets_v4.Schema$CellData | undefined, resolved: Map<string, string[]>): RawCell {
  if (!v) return { text: "" };
  const cell: RawCell = { text: v.formattedValue ?? "" };
  const n = v.effectiveValue?.numberValue;
  if (typeof n === "number") cell.number = n;
  const link =
    v.hyperlink ??
    v.chipRuns?.find((r) => r.chip?.richLinkProperties?.uri)?.chip?.richLinkProperties?.uri ??
    v.textFormatRuns?.find((r) => r.format?.link?.uri)?.format?.link?.uri;
  if (link) cell.link = link;

  const dv = v.dataValidation;
  const cond = dv?.condition;
  if (cond?.type === "ONE_OF_LIST") {
    const values = (cond.values ?? []).map((x) => x.userEnteredValue ?? "").filter(Boolean);
    cell.validation = { kind: "list", values, strict: !!dv?.strict };
  } else if (cond?.type === "ONE_OF_RANGE") {
    const ref = (cond.values?.[0]?.userEnteredValue ?? "").replace(/^=/, "");
    cell.validation = { kind: "range", ref, values: resolved.get(ref) ?? [], strict: !!dv?.strict };
  }
  return cell;
}

function toRawSheet(s: sheets_v4.Schema$Sheet, resolved: Map<string, string[]>): RawSheet {
  const p = s.properties!;
  const cells: RawCell[][] = [];
  for (const block of s.data ?? []) {
    const r0 = block.startRow ?? 0;
    const c0 = block.startColumn ?? 0;
    (block.rowData ?? []).forEach((rd, i) => {
      const row = (cells[r0 + i] ??= []);
      (rd.values ?? []).forEach((v, j) => {
        row[c0 + j] = toRawCell(v, resolved);
      });
    });
  }
  return {
    sheetId: p.sheetId!,
    title: p.title!,
    index: p.index ?? 0,
    hidden: !!p.hidden,
    rowCount: p.gridProperties?.rowCount ?? cells.length,
    columnCount: p.gridProperties?.columnCount ?? 26,
    merges: (s.merges ?? []).map((m) => ({
      startRow: m.startRowIndex ?? 0,
      endRow: m.endRowIndex ?? 0,
      startCol: m.startColumnIndex ?? 0,
      endCol: m.endColumnIndex ?? 0,
    })),
    cells,
  };
}

function rangeRefs(sheets: sheets_v4.Schema$Sheet[]): string[] {
  const refs = new Set<string>();
  for (const s of sheets)
    for (const b of s.data ?? [])
      for (const rd of b.rowData ?? [])
        for (const v of rd.values ?? []) {
          const c = v.dataValidation?.condition;
          if (c?.type === "ONE_OF_RANGE" && c.values?.[0]?.userEnteredValue) {
            refs.add(c.values[0].userEnteredValue.replace(/^=/, ""));
          }
        }
  return [...refs];
}

export class GoogleSheetGateway implements SheetGateway {
  readonly kind = "google" as const;
  private api: sheets_v4.Sheets;
  private titles = new Map<number, string>();

  constructor(
    private spreadsheetId: string,
    credentials: { email: string; key: string },
  ) {
    const auth = new google.auth.JWT({
      email: credentials.email,
      key: credentials.key.replace(/\\n/g, "\n"),
      scopes: SCOPES,
    });
    this.api = google.sheets({ version: "v4", auth });
  }

  private async resolveRanges(sheets: sheets_v4.Schema$Sheet[]) {
    const refs = rangeRefs(sheets);
    const resolved = new Map<string, string[]>();
    if (!refs.length) return resolved;
    const res = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: refs,
      majorDimension: "COLUMNS",
    });
    res.data.valueRanges?.forEach((vr, i) => {
      const values = (vr.values ?? []).flat().map(String).filter((x) => x.trim() !== "");
      resolved.set(refs[i]!, [...new Set(values)]);
    });
    return resolved;
  }

  async fetchWorkbook(): Promise<RawWorkbook> {
    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      includeGridData: true,
      fields: `spreadsheetId,properties(title,locale,timeZone),${SHEET_FIELDS}`,
    });
    const sheets = res.data.sheets ?? [];
    const resolved = await this.resolveRanges(sheets);
    const raw = sheets.map((s) => toRawSheet(s, resolved));
    raw.forEach((s) => this.titles.set(s.sheetId, s.title));
    return {
      spreadsheetId: res.data.spreadsheetId!,
      title: res.data.properties?.title ?? "",
      locale: res.data.properties?.locale ?? "en_US",
      timeZone: res.data.properties?.timeZone ?? "Asia/Riyadh",
      sheets: raw,
    };
  }

  async sheetIdByTitle(title: string): Promise<number | null> {
    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    for (const s of res.data.sheets ?? []) this.titles.set(s.properties!.sheetId!, s.properties!.title!);
    const hit = res.data.sheets?.find((s) => s.properties?.title === title);
    return hit?.properties?.sheetId ?? null;
  }

  private async title(sheetId: number): Promise<string> {
    const cached = this.titles.get(sheetId);
    if (cached) return cached;
    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets(properties(sheetId,title))",
    });
    for (const s of res.data.sheets ?? []) this.titles.set(s.properties!.sheetId!, s.properties!.title!);
    const t = this.titles.get(sheetId);
    if (!t) throw new Error(`Sheet ${sheetId} not found`);
    return t;
  }

  async fetchSheet(sheetId: number): Promise<RawSheet> {
    const title = await this.title(sheetId);
    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      ranges: [quote(title)],
      includeGridData: true,
      fields: SHEET_FIELDS,
    });
    const s = res.data.sheets?.[0];
    if (!s) throw new Error(`Sheet ${sheetId} not found`);
    const resolved = await this.resolveRanges([s]);
    return toRawSheet(s, resolved);
  }

  async writeCells(sheetId: number, writes: CellWrite[]) {
    if (!writes.length) return;
    const title = await this.title(sheetId);
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        // USER_ENTERED so ISO dates become real date cells and URLs become links.
        valueInputOption: "USER_ENTERED",
        data: writes.map((w) => ({
          range: `${quote(title)}!${colLetter(w.col)}${w.row + 1}`,
          values: [[w.value]],
        })),
      },
    });
  }

  async clearCells(sheetId: number, cells: { row: number; col: number }[]) {
    if (!cells.length) return;
    const title = await this.title(sheetId);
    await this.api.spreadsheets.values.batchClear({
      spreadsheetId: this.spreadsheetId,
      requestBody: { ranges: cells.map((c) => `${quote(title)}!${colLetter(c.col)}${c.row + 1}`) },
    });
  }

  async ensureRows(sheetId: number, rowCount: number) {
    const sheet = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets(properties(sheetId,gridProperties(rowCount)))",
    });
    const current = sheet.data.sheets?.find((s) => s.properties?.sheetId === sheetId)?.properties
      ?.gridProperties?.rowCount;
    if (current !== undefined && current !== null && current >= rowCount) return;
    await this.batch([
      { appendDimension: { sheetId, dimension: "ROWS", length: rowCount - (current ?? 0) + 20 } },
    ]);
  }

  private async batch(requests: sheets_v4.Schema$Request[]) {
    return this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests },
    });
  }

  async duplicateSheet(sheetId: number, title: string, opts: { hidden?: boolean; index?: number }) {
    const res = await this.batch([
      { duplicateSheet: { sourceSheetId: sheetId, newSheetName: title, insertSheetIndex: opts.index } },
    ]);
    const newId = res.data.replies?.[0]?.duplicateSheet?.properties?.sheetId;
    if (newId === undefined || newId === null) throw new Error("duplicateSheet returned no id");
    this.titles.set(newId, title);
    if (opts.hidden) {
      await this.batch([
        { updateSheetProperties: { properties: { sheetId: newId, hidden: true }, fields: "hidden" } },
      ]);
    }
    return newId;
  }

  async addSheet(title: string, opts: { hidden?: boolean; index?: number }) {
    const res = await this.batch([
      { addSheet: { properties: { title, hidden: opts.hidden, index: opts.index, rightToLeft: true } } },
    ]);
    const newId = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
    if (newId === undefined || newId === null) throw new Error("addSheet returned no id");
    this.titles.set(newId, title);
    return newId;
  }

  async clearBlock(sheetId: number, b: { startRow: number; endRow: number; startCol: number; endCol: number }) {
    await this.batch([
      {
        updateCells: {
          range: {
            sheetId,
            startRowIndex: b.startRow,
            endRowIndex: b.endRow,
            startColumnIndex: b.startCol,
            endColumnIndex: b.endCol,
          },
          fields: "userEnteredValue",
        },
      },
    ]);
  }

  async clearValidation(sheetId: number, b: { startRow: number; endRow: number; startCol: number; endCol: number }) {
    await this.batch([
      {
        setDataValidation: {
          range: {
            sheetId,
            startRowIndex: b.startRow,
            endRowIndex: b.endRow,
            startColumnIndex: b.startCol,
            endColumnIndex: b.endCol,
          },
        },
      },
    ]);
  }

  async appendRow(sheetId: number, values: string[]) {
    const title = await this.title(sheetId);
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${quote(title)}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
  }
}
