import { describe, expect, it } from "vitest";
import { parseDateText, serialToIso } from "./dates";
import { analyzeLayout, buildCompany, colLetter, findHeaderRow } from "./parse";
import { FIELDS } from "./schema";
import type { RawCell, RawSheet } from "./types";

const H = FIELDS.map((f) => f.header);
const c = (text: string, extra: Partial<RawCell> = {}): RawCell => ({ text, ...extra });
const list = (values: string[]) => ({ kind: "list" as const, values, strict: true });

function sheet(rows: (RawCell | undefined)[][], merges: RawSheet["merges"] = []): RawSheet {
  return { sheetId: 1, title: "t", index: 0, hidden: false, rowCount: 100, columnCount: 26, merges, cells: rows as RawCell[][] };
}

/** Row 1 empty, headers on row 2 from column B – the documented layout. */
function standard(dataRows: string[][], extraHeaders: string[] = []) {
  return sheet([[], [c(""), ...[...H, ...extraHeaders].map((h) => c(h))], ...dataRows.map((r) => [c(""), ...r.map((v) => c(v))])]);
}

describe("layout", () => {
  it("finds headers on row 2 and maps B→J", () => {
    const s = standard([]);
    expect(findHeaderRow(s)).toBe(1);
    const l = analyzeLayout(s)!;
    expect(colLetter(l.columns.title!)).toBe("B");
    expect(colLetter(l.columns.notes!)).toBe("J");
    expect(l.missingFields).toEqual([]);
    expect(l.duplicates).toEqual([]);
  });

  it("tolerates header whitespace / bidi marks and a moved header row", () => {
    const s = sheet([[], [], [], [c(""), ...H.map((h) => c(`‏ ${h}  `))]]);
    const l = analyzeLayout(s)!;
    expect(l.headerRow).toBe(3);
    expect(l.missingFields).toEqual([]);
  });

  it("returns null for tabs without an idea header", () => {
    expect(analyzeLayout(sheet([[c("hello")]]))).toBeNull();
  });

  it("detects duplicate columns K–N and classifies their values", () => {
    const row = (title: string, status: string, owner: string, dupStatus: string, dupOwner: string) => [
      title, "", "", "", "", status, owner, "", "", dupStatus, dupOwner, "", "",
    ];
    const s = standard(
      [
        row("a", "", "Mr Nabil", "قيد التنفيذ", "Mr Nabil"), // recoverable status, identical owner
        row("b", "تم", "Najd Bandar", "", "Mr Nabil"), // conflicting owner
        row("", "", "", "", "Najd Bandar"), // orphan value
      ],
      ["حالة التنفيذ", "المسؤول", "الموعد المستهدف", "ملاحظات"],
    );
    const l = analyzeLayout(s)!;
    expect(l.duplicates.map((d) => colLetter(d.duplicateCol))).toEqual(["K", "L", "M", "N"]);
    const status = l.duplicates.find((d) => d.field === "status")!;
    expect(status.recoverableRows).toEqual([3]);
    const owner = l.duplicates.find((d) => d.field === "owner")!;
    expect(owner.identicalRows).toEqual([3]);
    expect(owner.conflictingRows).toEqual([4]);
    expect(owner.recoverableRows).toEqual([5]);
    // The app keeps reading the primary columns.
    expect(colLetter(l.columns.status!)).toBe("G");
  });

  it("reads a title merged across B:C", () => {
    const headers = [c(""), c("الفكرة"), c(""), ...H.slice(1).map((h) => c(h))];
    const s = sheet(
      [[], headers, [c(""), c(""), c("فكرة في C"), c("وصف")]],
      [{ startRow: 1, endRow: 2, startCol: 1, endCol: 3 }],
    );
    const l = analyzeLayout(s)!;
    const company = buildCompany(s, l, "en_US");
    expect(company.ideas[0]?.title).toBe("فكرة في C");
    expect(company.ideas[0]?.description).toBe("وصف");
    expect(company.issues.some((i) => i.code === "merged-cells")).toBe(true);
  });
});

describe("rows", () => {
  it("ignores placeholder rows without an idea and keeps sheet row numbers", () => {
    const s = standard([["فكرة ١"], [], ["", "وصف بلا فكرة"], ["فكرة ٢"]]);
    const company = buildCompany(s, analyzeLayout(s)!, "en_US");
    expect(company.ideas.map((i) => [i.title, i.row])).toEqual([["فكرة ١", 3], ["فكرة ٢", 6]]);
    expect(company.placeholderRows).toBe(2);
  });

  it("prefers the hyperlink target for reference links", () => {
    const s = standard([]);
    s.cells.push([c(""), c("x"), c(""), c("مقطع تيك توك", { link: "https://www.tiktok.com/@a/video/1" })]);
    const company = buildCompany(s, analyzeLayout(s)!, "en_US");
    expect(company.ideas[0]?.referenceUrl).toBe("https://www.tiktok.com/@a/video/1");
  });

  it("parses serial and typed dates", () => {
    const s = standard([]);
    s.cells.push([c(""), c("x"), ...Array(6).fill(c("")), c("11/20/2026", { number: 46346 })]);
    s.cells.push([c(""), c("y"), ...Array(6).fill(c("")), c("2026-12-01")]);
    s.cells.push([c(""), c("z"), ...Array(6).fill(c("")), c("بكرة")]);
    const company = buildCompany(s, analyzeLayout(s)!, "en_US");
    expect(company.ideas.map((i) => i.targetDateIso)).toEqual(["2026-11-20", "2026-12-01", null]);
    expect(company.issues.some((i) => i.code === "unparsed-dates")).toBe(true);
  });
});

describe("options", () => {
  it("uses validation lists and reports off-list values", () => {
    const s = standard([]);
    const v = list(["عالية", "متوسطة", "منخفضة"]);
    s.cells.push([c(""), c("a"), c(""), c(""), c(""), c("عالية", { validation: v })]);
    s.cells.push([c(""), c("b"), c(""), c(""), c(""), c("عاجلة", { validation: v })]);
    const company = buildCompany(s, analyzeLayout(s)!, "en_US");
    expect(company.options.priority).toMatchObject({ source: "validation", strict: true, offList: ["عاجلة"] });
    expect(company.options.priority.values).toEqual(["عالية", "متوسطة", "منخفضة"]);
  });

  it("falls back to defaults plus observed values", () => {
    const s = standard([["a", "", "", "", "", "", "Someone New"]]);
    const company = buildCompany(s, analyzeLayout(s)!, "en_US");
    expect(company.options.owner.source).toBe("default");
    expect(company.options.owner.values).toContain("Someone New");
    expect(company.issues.some((i) => i.code === "missing-validation")).toBe(true);
  });
});

describe("dates", () => {
  it("converts serials", () => expect(serialToIso(45658)).toBe("2025-01-01"));
  it("respects locale for ambiguous dates", () => {
    expect(parseDateText("03/04/2026", true)).toBe("2026-03-04");
    expect(parseDateText("03/04/2026", false)).toBe("2026-04-03");
    expect(parseDateText("25/04/2026", true)).toBe("2026-04-25");
    expect(parseDateText("٢٠٢٦-٠٤-٠٥", true)).toBe("2026-04-05");
    expect(parseDateText("31/02/2026", false)).toBeNull();
  });
});
