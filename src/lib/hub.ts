import "server-only";
import { cellToIsoDate, isMonthFirstLocale, serialToIso } from "./sheets/dates";
import { DemoSheetGateway } from "./sheets/demo-gateway";
import type { SheetGateway } from "./sheets/gateway";
import { GoogleSheetGateway } from "./sheets/google-gateway";
import {
  analyzeLayout,
  buildCompany,
  cellAt,
  colLetter,
  hashFields,
  readRowFields,
} from "./sheets/parse";
import {
  FIELDS,
  FIELD_BY_KEY,
  FIELD_KEYS,
  SELECT_FIELDS,
  STANDARD_FIRST_COL,
  STANDARD_HEADER_ROW,
  normalizeLabel,
  type FieldKey,
} from "./sheets/schema";
import type { CellWrite, Company, Idea, IdeaFields, RawSheet, SheetLayout, Workbook } from "./sheets/types";

// ─── Errors ──────────────────────────────────────────────────────────────────

export class HubError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public data?: unknown,
  ) {
    super(message);
  }
}

// ─── Gateway & cache ─────────────────────────────────────────────────────────

const AUDIT_TAB = "_سجل_التطبيق";
const BACKUP_PREFIX = "نسخة احتياطية";

/**
 * Process-wide state. Next.js bundles each route handler separately, so module-level variables
 * would give every route its own cache and its own write lock; keeping them on globalThis means
 * a write in one route invalidates the cache the others read, and all writes share one queue.
 */
interface HubState {
  gateway: SheetGateway | null;
  cache: { value: Workbook; at: number } | null;
  inflight: Promise<Workbook> | null;
  queue: Promise<unknown>;
  locale: string;
  auditTabId: number | null | undefined;
}
const state: HubState = ((globalThis as { __qchHub?: HubState }).__qchHub ??= {
  gateway: null,
  cache: null,
  inflight: null,
  queue: Promise.resolve(),
  locale: "en_US",
  auditTabId: undefined,
});

export function getGateway(): SheetGateway {
  if (state.gateway) return state.gateway;
  if (process.env.DATA_SOURCE === "demo") return (state.gateway = new DemoSheetGateway());
  const id = process.env.SPREADSHEET_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY;
  if (!id || !email || !key) {
    throw new HubError(
      500,
      "not-configured",
      "لم يتم إعداد الاتصال بـ Google Sheets. أضف SPREADSHEET_ID وبيانات حساب الخدمة، أو استخدم DATA_SOURCE=demo.",
    );
  }
  return (state.gateway = new GoogleSheetGateway(id, { email, key }));
}

const TTL_MS = Number(process.env.SHEET_CACHE_TTL ?? 15) * 1000;

function isCompanyTab(title: string, hidden: boolean) {
  return !hidden && !title.startsWith("_") && !title.startsWith(BACKUP_PREFIX);
}

export async function loadWorkbook(opts: { fresh?: boolean } = {}): Promise<Workbook> {
  if (!opts.fresh && state.cache && Date.now() - state.cache.at < TTL_MS) return state.cache.value;
  if (state.inflight) return state.inflight;
  state.inflight = (async () => {
    const gw = getGateway();
    const raw = await gw.fetchWorkbook();
    state.locale = raw.locale;
    const companies: Company[] = [];
    const ignoredTabs: Workbook["ignoredTabs"] = [];
    for (const sheet of [...raw.sheets].sort((a, b) => a.index - b.index)) {
      if (!isCompanyTab(sheet.title, sheet.hidden)) continue;
      const layout = analyzeLayout(sheet);
      if (!layout) {
        ignoredTabs.push({ id: sheet.sheetId, name: sheet.title, reason: "لا يحتوي على صف عناوين فيه «الفكرة»" });
        continue;
      }
      companies.push(buildCompany(sheet, layout, raw.locale));
    }
    const value: Workbook = {
      spreadsheetId: raw.spreadsheetId,
      title: raw.title,
      timeZone: raw.timeZone,
      companies,
      ignoredTabs,
      fetchedAt: new Date().toISOString(),
      source: gw.kind,
    };
    state.cache = { value, at: Date.now() };
    return value;
  })().finally(() => {
    state.inflight = null;
  });
  return state.inflight;
}

function invalidate() {
  state.cache = null;
}

// Writes are serialised per process so two creates can never claim the same empty row.
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = state.queue.then(fn, fn);
  state.queue = run.catch(() => undefined);
  return run;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export interface Actor {
  email: string;
  name?: string | null;
}

export type IdeaInput = IdeaFields;

/**
 * Values are written with USER_ENTERED (so dates become dates), which also means a leading
 * "=" would become a formula. Text that Sheets would reinterpret is prefixed with an apostrophe,
 * which Sheets treats as "literal text" and does not display.
 */
export function toCellValue(key: FieldKey, value: string): string {
  const v = value.trim();
  if (!v) return "";
  const kind = FIELD_BY_KEY[key].kind;
  if (kind === "date" || kind === "url") return v;
  if (/^[=+\-@]/.test(v) || /^[\d\s.,/%:$-]+$/.test(v) || /^(true|false)$/i.test(v)) return `'${v}`;
  return v;
}

async function freshSheet(companyId: number): Promise<{ sheet: RawSheet; layout: SheetLayout }> {
  const gw = getGateway();
  let sheet: RawSheet;
  try {
    sheet = await gw.fetchSheet(companyId);
  } catch {
    throw new HubError(404, "company-not-found", "لم يتم العثور على الشركة. ربما تم حذف التبويب أو إعادة تسميته.");
  }
  const layout = analyzeLayout(sheet);
  if (!layout) throw new HubError(409, "no-header", "لم يتم العثور على صف العناوين في هذا التبويب.");
  return { sheet, layout };
}

function companyFrom(sheet: RawSheet, layout: SheetLayout) {
  return buildCompany(sheet, layout, state.locale);
}

function validateOptions(company: Company, input: Partial<IdeaInput>) {
  for (const key of SELECT_FIELDS) {
    const value = input[key];
    if (value === undefined || value === "") continue;
    const opts = company.options[key];
    if (opts.strict && !opts.values.includes(normalizeLabel(value))) {
      throw new HubError(422, "invalid-option", `«${value}» ليست من خيارات «${FIELD_BY_KEY[key].header}» في الجدول.`, {
        field: key,
        allowed: opts.values,
      });
    }
  }
}

function ideaAt(sheet: RawSheet, layout: SheetLayout, row: number): Idea | null {
  const fields = readRowFields(sheet, layout, row - 1);
  if (!fields.title) return null;
  const dateCol = layout.columns.targetDate;
  const targetDateIso =
    dateCol === undefined ? null : cellToIsoDate(cellAt(sheet, row - 1, dateCol), isMonthFirstLocale(state.locale));
  return { ...fields, row, version: hashFields(fields), targetDateIso };
}

async function audit(actor: Actor, action: string, company: string, row: number | "", details: unknown) {
  const gw = getGateway();
  try {
    state.auditTabId ??= await gw.sheetIdByTitle(AUDIT_TAB);
    if (state.auditTabId === null) {
      state.auditTabId = await gw.addSheet(AUDIT_TAB, { hidden: true });
      await gw.appendRow(state.auditTabId, ["الوقت (UTC)", "المستخدم", "العملية", "الشركة", "الصف", "التفاصيل"]);
    }
    await gw.appendRow(state.auditTabId, [
      new Date().toISOString(),
      actor.email,
      action,
      company,
      String(row),
      JSON.stringify(details),
    ]);
  } catch (err) {
    state.auditTabId = undefined;
    console.error("[audit] failed to write audit entry", err);
  }
}

// ─── Ideas ───────────────────────────────────────────────────────────────────

function isEmptyRow(sheet: RawSheet, layout: SheetLayout, r: number) {
  const cols = [
    ...(Object.values(layout.columns) as number[]),
    ...layout.duplicates.map((d) => d.duplicateCol),
  ];
  return cols.every((c) => !(cellAt(sheet, r, c)?.text ?? "").trim());
}

export async function createIdea(companyId: number, input: IdeaInput, actor: Actor): Promise<Idea> {
  return exclusive(async () => {
    const gw = getGateway();
    const { sheet, layout } = await freshSheet(companyId);
    if (layout.columns.title === undefined) throw new HubError(409, "no-title-column", "عمود «الفكرة» غير موجود.");
    const company = companyFrom(sheet, layout);
    validateOptions(company, input);

    // Reuse the first placeholder row (keeps its dropdown chips); otherwise go below the data.
    let target = -1;
    for (let r = layout.headerRow + 1; r < sheet.cells.length; r++) {
      if (isEmptyRow(sheet, layout, r)) {
        target = r;
        break;
      }
    }
    if (target === -1) {
      target = Math.max(sheet.cells.length, layout.headerRow + 1);
      await gw.ensureRows(companyId, target + 1);
    }

    const writes: CellWrite[] = [];
    for (const key of FIELD_KEYS) {
      const col = layout.columns[key];
      const value = toCellValue(key, input[key] ?? "");
      if (col !== undefined && value) writes.push({ row: target, col, value });
    }
    await gw.writeCells(companyId, writes);
    invalidate();

    const after = await gw.fetchSheet(companyId);
    const idea = ideaAt(after, layout, target + 1);
    if (!idea) throw new HubError(500, "write-failed", "تعذر التحقق من حفظ الفكرة.");
    await audit(actor, "إضافة فكرة", sheet.title, target + 1, { title: input.title });
    return idea;
  });
}

export async function updateIdea(
  companyId: number,
  row: number,
  version: string,
  patch: Partial<IdeaInput>,
  actor: Actor,
): Promise<Idea> {
  return exclusive(async () => {
    const gw = getGateway();
    const { sheet, layout } = await freshSheet(companyId);
    const current = ideaAt(sheet, layout, row);
    if (!current) throw new HubError(404, "idea-not-found", "هذه الفكرة لم تعد موجودة في الجدول.");
    if (current.version !== version) {
      throw new HubError(409, "conflict", "تم تعديل هذه الفكرة في الجدول بعد فتحك لها. راجع النسخة الحالية ثم أعد المحاولة.", {
        current,
      });
    }
    if (patch.title !== undefined && !patch.title.trim()) {
      throw new HubError(422, "title-required", "عنوان الفكرة مطلوب.");
    }
    validateOptions(companyFrom(sheet, layout), patch);

    const writes: CellWrite[] = [];
    const clears: { row: number; col: number }[] = [];
    const changed: Partial<Record<FieldKey, { from: string; to: string }>> = {};
    for (const key of FIELD_KEYS) {
      const next = patch[key];
      const col = layout.columns[key];
      if (next === undefined || col === undefined) continue;
      const prev = key === "targetDate" ? (current.targetDateIso ?? current.targetDate) : current[key];
      if (next.trim() === prev.trim()) continue;
      changed[key] = { from: current[key], to: next };
      const value = toCellValue(key, next);
      if (value) writes.push({ row: row - 1, col, value });
      else clears.push({ row: row - 1, col });
    }
    if (!writes.length && !clears.length) return current;

    await gw.writeCells(companyId, writes);
    await gw.clearCells(companyId, clears);
    invalidate();

    const after = await gw.fetchSheet(companyId);
    const idea = ideaAt(after, layout, row);
    if (!idea) throw new HubError(500, "write-failed", "تعذر التحقق من حفظ التعديل.");
    await audit(actor, "تعديل فكرة", sheet.title, row, changed);
    return idea;
  });
}

export async function deleteIdea(companyId: number, row: number, version: string, actor: Actor) {
  return exclusive(async () => {
    const gw = getGateway();
    const { sheet, layout } = await freshSheet(companyId);
    const current = ideaAt(sheet, layout, row);
    if (!current) throw new HubError(404, "idea-not-found", "هذه الفكرة لم تعد موجودة في الجدول.");
    if (current.version !== version) {
      throw new HubError(409, "conflict", "تم تعديل هذه الفكرة في الجدول بعد فتحك لها.", { current });
    }
    // Values are cleared, not the row: the row keeps its dropdown chips and nothing below moves.
    const cells = (Object.values(layout.columns) as number[]).map((col) => ({ row: row - 1, col }));
    await gw.clearCells(companyId, cells);
    invalidate();
    await audit(actor, "حذف فكرة", sheet.title, row, current);
  });
}

// ─── Companies ───────────────────────────────────────────────────────────────

export function validateCompanyName(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  if (n.length < 2 || n.length > 80) throw new HubError(422, "invalid-name", "اسم الشركة يجب أن يكون بين 2 و80 حرفًا.");
  if (/[\[\]*?:/\\]/.test(n)) throw new HubError(422, "invalid-name", "اسم الشركة لا يمكن أن يحتوي على [ ] * ? : / \\");
  if (n.startsWith("_") || n.startsWith(BACKUP_PREFIX)) throw new HubError(422, "invalid-name", "هذا الاسم محجوز.");
  return n;
}

export async function createCompany(rawName: string, actor: Actor): Promise<{ id: number; name: string; from: string | null }> {
  const name = validateCompanyName(rawName);
  return exclusive(async () => {
    const gw = getGateway();
    const raw = await gw.fetchWorkbook();
    if (raw.sheets.some((s) => normalizeLabel(s.title) === normalizeLabel(name))) {
      throw new HubError(409, "exists", "يوجد تبويب بنفس الاسم.");
    }
    const visible = raw.sheets.filter((s) => isCompanyTab(s.title, s.hidden)).sort((a, b) => a.index - b.index);
    const lastIndex = visible.length ? Math.max(...visible.map((s) => s.index)) + 1 : 0;

    // Prefer cloning a healthy company tab: it carries formatting, widths and dropdown chips.
    const template = visible.find((s) => {
      const l = analyzeLayout(s);
      return l && !l.duplicates.length && !l.missingFields.length;
    });

    let id: number;
    if (template) {
      const layout = analyzeLayout(template)!;
      id = await gw.duplicateSheet(template.sheetId, name, { index: lastIndex });
      await gw.clearBlock(id, {
        startRow: layout.headerRow + 1,
        endRow: Math.max(template.rowCount, template.cells.length),
        startCol: 0,
        endCol: template.columnCount,
      });
    } else {
      id = await gw.addSheet(name, { index: lastIndex });
      await gw.writeCells(
        id,
        FIELDS.map((f, i) => ({ row: STANDARD_HEADER_ROW, col: STANDARD_FIRST_COL + i, value: f.header })),
      );
    }
    invalidate();
    await audit(actor, "إضافة شركة", name, "", { template: template?.title ?? null });
    return { id, name, from: template?.title ?? null };
  });
}

// ─── Duplicate-column fix ────────────────────────────────────────────────────

export interface DuplicateFixPlan {
  companyId: number;
  companyName: string;
  columns: { field: FieldKey; header: string; primary: string; duplicate: string }[];
  /** Values copied into the empty primary cell. */
  moves: { row: number; field: FieldKey; value: string }[];
  /** Values that differ from the primary cell: appended to «ملاحظات» so nothing is lost. */
  conflicts: { row: number; field: FieldKey; primary: string; duplicate: string }[];
  /** Values in rows without an idea title: preserved only in the backup tab. */
  orphans: { row: number; field: FieldKey; value: string }[];
  identical: number;
  canPreserveConflicts: boolean;
}

function dupValue(sheet: RawSheet, r: number, col: number, field: FieldKey): string {
  const cell = cellAt(sheet, r, col);
  if (!cell) return "";
  if (FIELD_BY_KEY[field].kind === "date" && typeof cell.number === "number") {
    return serialToIso(cell.number) ?? cell.text.trim();
  }
  return (cell.link && FIELD_BY_KEY[field].kind === "url" ? cell.link : cell.text).trim();
}

export function planDuplicateFix(sheet: RawSheet, layout: SheetLayout): DuplicateFixPlan {
  const plan: DuplicateFixPlan = {
    companyId: sheet.sheetId,
    companyName: sheet.title,
    columns: layout.duplicates.map((d) => ({
      field: d.field,
      header: d.header,
      primary: colLetter(d.primaryCol),
      duplicate: colLetter(d.duplicateCol),
    })),
    moves: [],
    conflicts: [],
    orphans: [],
    identical: 0,
    canPreserveConflicts: layout.columns.notes !== undefined,
  };
  const titleCol = layout.columns.title;
  for (const d of layout.duplicates) {
    for (let r = layout.headerRow + 1; r < sheet.cells.length; r++) {
      const value = dupValue(sheet, r, d.duplicateCol, d.field);
      if (!value) continue;
      const hasTitle = titleCol !== undefined && !!(cellAt(sheet, r, titleCol)?.text ?? "").trim();
      if (!hasTitle) {
        plan.orphans.push({ row: r + 1, field: d.field, value });
        continue;
      }
      const primary = dupValue(sheet, r, d.primaryCol, d.field);
      if (!primary) plan.moves.push({ row: r + 1, field: d.field, value });
      else if (normalizeLabel(primary) === normalizeLabel(value)) plan.identical++;
      else plan.conflicts.push({ row: r + 1, field: d.field, primary, duplicate: value });
    }
  }
  return plan;
}

export async function previewDuplicateFix(companyId: number): Promise<DuplicateFixPlan> {
  const { sheet, layout } = await freshSheet(companyId);
  if (!layout.duplicates.length) throw new HubError(409, "no-duplicates", "لا توجد أعمدة مكررة في هذا التبويب.");
  return planDuplicateFix(sheet, layout);
}

export async function applyDuplicateFix(
  companyId: number,
  confirmName: string,
  expectedPlanHash: string,
  actor: Actor,
): Promise<{ backupTab: string; plan: DuplicateFixPlan }> {
  return exclusive(async () => {
    const gw = getGateway();
    const { sheet, layout } = await freshSheet(companyId);
    if (normalizeLabel(confirmName) !== normalizeLabel(sheet.title)) {
      throw new HubError(422, "confirm-mismatch", "اسم التأكيد لا يطابق اسم الشركة.");
    }
    if (!layout.duplicates.length) throw new HubError(409, "no-duplicates", "لا توجد أعمدة مكررة في هذا التبويب.");
    const plan = planDuplicateFix(sheet, layout);
    if (planHash(plan) !== expectedPlanHash) {
      throw new HubError(409, "plan-changed", "تغيرت بيانات التبويب منذ عرض الخطة. راجع الخطة الجديدة ثم وافق مرة أخرى.", { plan });
    }
    if (plan.conflicts.length && !plan.canPreserveConflicts) {
      throw new HubError(409, "cannot-preserve", "توجد قيم متعارضة ولا يوجد عمود «ملاحظات» لحفظها.");
    }

    // 1. Full backup of the tab, hidden, before anything changes.
    const stamp = new Date().toISOString().slice(0, 16).replace("T", " ");
    const backupTab = `${BACKUP_PREFIX} — ${sheet.title} — ${stamp}`.slice(0, 99);
    await gw.duplicateSheet(companyId, backupTab, { hidden: true });

    // 2. Move values that exist only in the duplicate columns.
    const writes: CellWrite[] = plan.moves.map((m) => ({
      row: m.row - 1,
      col: layout.columns[m.field]!,
      value: toCellValue(m.field, m.value),
    }));

    // 3. Preserve conflicting values in «ملاحظات».
    const notesCol = layout.columns.notes;
    if (notesCol !== undefined) {
      const byRow = new Map<number, string[]>();
      for (const c of plan.conflicts) {
        const list = byRow.get(c.row) ?? [];
        list.push(`[${FIELD_BY_KEY[c.field].header} (عمود مكرر): ${c.duplicate}]`);
        byRow.set(c.row, list);
      }
      for (const [row, extra] of byRow) {
        const existing = (cellAt(sheet, row - 1, notesCol)?.text ?? "").trim();
        writes.push({ row: row - 1, col: notesCol, value: toCellValue("notes", [existing, ...extra].filter(Boolean).join("\n")) });
      }
    }
    await gw.writeCells(companyId, writes);

    // 4. Retire the duplicate columns (header + values + validation). Columns are not deleted,
    //    so nothing to their right moves.
    const endRow = Math.max(sheet.rowCount, sheet.cells.length);
    for (const d of layout.duplicates) {
      const block = { startRow: layout.headerRow, endRow, startCol: d.duplicateCol, endCol: d.duplicateCol + 1 };
      await gw.clearBlock(companyId, block);
      await gw.clearValidation(companyId, block);
    }
    invalidate();
    await audit(actor, "إصلاح الأعمدة المكررة", sheet.title, "", {
      backupTab,
      moved: plan.moves.length,
      conflictsPreserved: plan.conflicts.length,
      orphansInBackupOnly: plan.orphans.length,
    });
    return { backupTab, plan };
  });
}

export function planHash(plan: DuplicateFixPlan): string {
  return hashFields({
    title: JSON.stringify(plan.columns),
    description: JSON.stringify(plan.moves),
    referenceUrl: JSON.stringify(plan.conflicts),
    platform: JSON.stringify(plan.orphans),
    priority: String(plan.identical),
    status: "",
    owner: "",
    targetDate: "",
    notes: "",
  });
}
