import type { SheetGateway } from "./gateway";
import { FIELDS } from "./schema";
import type { CellWrite, RawCell, RawSheet, RawValidation, RawWorkbook } from "./types";

/**
 * In-memory stand-in for the real spreadsheet. It reproduces the layout described for the
 * production sheet – empty row 1, headers on row 2 from column B, placeholder rows with empty
 * dropdown chips, and duplicate headers in K–N on «قسورة العقارية» – so the full read/write
 * path can be exercised without credentials.
 */

const PLATFORMS = ["تيك توك", "إنستجرام", "سناب شات", "يوتيوب"];
const PRIORITIES = ["عالية", "متوسطة", "منخفضة"];
const STATUSES = ["فكرة جديدة", "قيد التنفيذ", "قيد المراجعة", "تم النشر", "مؤجلة"];
const OWNERS = ["Mr Nabil", "Najd Bandar"];

const list = (values: string[]): RawValidation => ({ kind: "list", values, strict: true });
const VALIDATION: Record<number, RawValidation> = {
  4: list(PLATFORMS), // E
  5: list(PRIORITIES), // F
  6: list(STATUSES), // G
  7: list(OWNERS), // H
};

function isoToSerial(iso: string) {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000 + 25569;
}
function serialText(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${m}/${d}/${y}`;
}
function addDays(days: number) {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

type Seed = [title: string, desc: string, url: string, platform: string, priority: string, status: string, owner: string, due: number | null, notes: string];

const HOLDING: Seed[] = [
  ["يوم في حياة الرئيس التنفيذي", "لقطات سريعة من يوم عمل كامل: اجتماعات، زيارات مشاريع، وقرارات.", "https://www.tiktok.com/@example/video/7301", "تيك توك", "عالية", "قيد التنفيذ", "Mr Nabil", 3, "التصوير يوم الأحد في المكتب الرئيسي"],
  ["ثلاث قواعد للاستثمار طويل المدى", "مقطع تعليمي قصير بأسلوب الرسوم المتحركة.", "https://www.tiktok.com/@example/video/7302", "تيك توك", "عالية", "قيد المراجعة", "Najd Bandar", 1, ""],
  ["خلف الكواليس: افتتاح مكتب المدينة", "قبل وبعد تجهيز المكتب الجديد، بأسلوب الأبيض والأسود ثم الألوان.", "https://www.tiktok.com/@example/video/7303", "إنستجرام", "متوسطة", "تم النشر", "Najd Bandar", -12, "حقق أعلى تفاعل هذا الشهر"],
  ["سؤال وجواب مع فريق الاستثمار", "أسئلة المتابعين في التعليقات والرد عليها بالفيديو.", "", "تيك توك", "متوسطة", "فكرة جديدة", "Mr Nabil", 14, ""],
  ["قصة تأسيس قسورة", "سرد قصصي لبداية المجموعة وأهم المحطات.", "https://www.tiktok.com/@example/video/7305", "يوتيوب", "عالية", "فكرة جديدة", "Mr Nabil", 21, "يحتاج أرشيف صور قديمة"],
  ["ترند: وش تسوي لو معك مليون؟", "ركوب الترند بإجابات الموظفين.", "https://www.tiktok.com/@example/video/7306", "تيك توك", "منخفضة", "مؤجلة", "Najd Bandar", null, "مؤجل لبعد موسم الشتاء"],
  ["إنفوجرافيك: محفظة المجموعة", "عرض متحرك لقطاعات الاستثمار ونسبها.", "", "إنستجرام", "متوسطة", "قيد التنفيذ", "Najd Bandar", -2, ""],
];

const REALESTATE: Seed[] = [
  ["القمر بالنسبة لك منظر… ولشركائنا دخل", "ربط إطلالة القمر على المدينة بموعد توزيع الأرباح كل ٣ شهور.", "https://www.tiktok.com/@example/video/7401", "تيك توك", "عالية", "قيد التنفيذ", "Najd Bandar", 2, "استخدام لقطات الدرون من السطح"],
  ["كل رقم هنا فرصة", "أرقام الطلب على الغرف الفندقية في المدينة المنورة.", "https://www.tiktok.com/@example/video/7402", "تيك توك", "عالية", "قيد المراجعة", "Mr Nabil", 0, ""],
  ["ما في استثمار بدون مخاطر", "مقطع توعوي صريح عن إدارة المخاطر.", "", "إنستجرام", "متوسطة", "فكرة جديدة", "Mr Nabil", 9, ""],
  ["جولة داخل الوحدة المؤثثة", "جولة POV داخل وحدة جاهزة للتأجير.", "https://www.tiktok.com/@example/video/7404", "تيك توك", "عالية", "تم النشر", "Najd Bandar", -6, ""],
  ["٣ أسئلة قبل ما تشتري عقار استثماري", "", "https://www.tiktok.com/@example/video/7405", "سناب شات", "متوسطة", "فكرة جديدة", "Najd Bandar", 5, ""],
  ["شهادة شريك", "مقابلة قصيرة مع أحد الشركاء الأوائل.", "", "يوتيوب", "منخفضة", "فكرة جديدة", "Mr Nabil", -1, "بانتظار موافقة الشريك"],
];

function makeSheet(sheetId: number, title: string, index: number, seeds: Seed[], withDuplicates: boolean): RawSheet {
  const cells: RawCell[][] = [[]];
  const header: RawCell[] = [{ text: "" }, ...FIELDS.map((f) => ({ text: f.header }))];
  if (withDuplicates) {
    header.push({ text: "حالة التنفيذ" }, { text: "المسؤول" }, { text: "الموعد المستهدف" }, { text: "ملاحظات" });
  }
  cells.push(header);

  const rows = seeds.length + 14;
  for (let i = 0; i < rows; i++) {
    const s = seeds[i];
    const row: RawCell[] = [{ text: "" }];
    for (let c = 1; c <= 9; c++) row[c] = { text: "", validation: VALIDATION[c] };
    if (s) {
      const [t, d, u, p, pr, st, o, due, n] = s;
      row[1]!.text = t;
      row[2]!.text = d;
      row[3] = u ? { text: u, link: u } : { text: "" };
      row[4]!.text = p;
      row[5]!.text = pr;
      row[6]!.text = st;
      row[7]!.text = o;
      if (due !== null) {
        const iso = addDays(due);
        row[8] = { text: serialText(iso), number: isoToSerial(iso) };
      }
      row[9]!.text = n;
    }
    if (withDuplicates) {
      // Legacy duplicate columns K–N: a few stray values, one of which conflicts.
      row[10] = { text: i === 1 ? "قيد التنفيذ" : "", validation: VALIDATION[6] };
      row[11] = { text: i === 2 ? "Mr Nabil" : i === 4 ? "Najd Bandar" : "" };
      row[12] = { text: "" };
      row[13] = { text: i === 4 ? "تواصل مع فريق التصوير" : "" };
    }
    cells.push(row);
  }
  return { sheetId, title, index, hidden: false, rowCount: cells.length + 20, columnCount: 26, merges: [], cells };
}

function seed(): RawWorkbook {
  return {
    spreadsheetId: "demo",
    title: "أفكار الشركات | التخطيط والتنفيذ",
    locale: "en_US",
    timeZone: "Asia/Riyadh",
    sheets: [
      makeSheet(1387480453, "قسورة القابضة", 0, HOLDING, false),
      makeSheet(61667299, "قسورة العقارية", 1, REALESTATE, true),
    ],
  };
}

const store = globalThis as unknown as { __qchDemo?: RawWorkbook };

const clone = <T,>(v: T): T => structuredClone(v);

export class DemoSheetGateway implements SheetGateway {
  readonly kind = "demo" as const;

  private get wb() {
    return (store.__qchDemo ??= seed());
  }

  private sheet(sheetId: number) {
    const s = this.wb.sheets.find((x) => x.sheetId === sheetId);
    if (!s) throw new Error(`Sheet ${sheetId} not found`);
    return s;
  }

  async fetchWorkbook() {
    return clone(this.wb);
  }

  async fetchSheet(sheetId: number) {
    return clone(this.sheet(sheetId));
  }

  async writeCells(sheetId: number, writes: CellWrite[]) {
    const s = this.sheet(sheetId);
    // Validate everything first, the way the API rejects the whole batch.
    for (const w of writes) {
      const v = s.cells[w.row]?.[w.col]?.validation;
      const literal = w.value.replace(/^'/, "");
      if (v?.strict && literal && !v.values.includes(literal)) {
        throw new Error(`Invalid value "${w.value}" violates data validation`);
      }
    }
    for (const w of writes) {
      const row = (s.cells[w.row] ??= []);
      const prev = row[w.col];
      const cell: RawCell = { text: w.value, validation: prev?.validation };
      if (w.value.startsWith("'")) {
        // Like Sheets with USER_ENTERED: a leading apostrophe means "literal text" and is not shown.
        cell.text = w.value.slice(1);
      } else if (/^\d{4}-\d{2}-\d{2}$/.test(w.value)) {
        cell.number = isoToSerial(w.value);
        cell.text = serialText(w.value);
      } else if (/^https?:\/\//.test(w.value)) {
        cell.link = w.value;
      }
      row[w.col] = cell;
    }
  }

  async clearCells(sheetId: number, cells: { row: number; col: number }[]) {
    const s = this.sheet(sheetId);
    for (const c of cells) {
      const prev = s.cells[c.row]?.[c.col];
      if (prev) s.cells[c.row]![c.col] = { text: "", validation: prev.validation };
    }
  }

  async ensureRows(sheetId: number, rowCount: number) {
    const s = this.sheet(sheetId);
    if (s.rowCount < rowCount) s.rowCount = rowCount + 20;
  }

  async duplicateSheet(sheetId: number, title: string, opts: { hidden?: boolean; index?: number }) {
    const src = this.sheet(sheetId);
    const newId = Math.floor(Math.random() * 2_000_000_000);
    const copy = { ...clone(src), sheetId: newId, title, hidden: !!opts.hidden, index: opts.index ?? this.wb.sheets.length };
    this.wb.sheets.push(copy);
    return newId;
  }

  async addSheet(title: string, opts: { hidden?: boolean; index?: number }) {
    const newId = Math.floor(Math.random() * 2_000_000_000);
    this.wb.sheets.push({
      sheetId: newId,
      title,
      index: opts.index ?? this.wb.sheets.length,
      hidden: !!opts.hidden,
      rowCount: 1000,
      columnCount: 26,
      merges: [],
      cells: [],
    });
    return newId;
  }

  async clearBlock(sheetId: number, b: { startRow: number; endRow: number; startCol: number; endCol: number }) {
    const s = this.sheet(sheetId);
    for (let r = b.startRow; r < Math.min(b.endRow, s.cells.length); r++)
      for (let c = b.startCol; c < b.endCol; c++) {
        const prev = s.cells[r]?.[c];
        if (prev) s.cells[r]![c] = { text: "", validation: prev.validation };
      }
  }

  async clearValidation(sheetId: number, b: { startRow: number; endRow: number; startCol: number; endCol: number }) {
    const s = this.sheet(sheetId);
    for (let r = b.startRow; r < Math.min(b.endRow, s.cells.length); r++)
      for (let c = b.startCol; c < b.endCol; c++) {
        const prev = s.cells[r]?.[c];
        if (prev) delete prev.validation;
      }
  }

  async appendRow(sheetId: number, values: string[]) {
    const s = this.sheet(sheetId);
    s.cells.push(values.map((text) => ({ text })));
  }

  async sheetIdByTitle(title: string) {
    return this.wb.sheets.find((s) => s.title === title)?.sheetId ?? null;
  }
}
