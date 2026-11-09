/**
 * The canonical column set of a company tab. Headers are matched in Arabic exactly as they
 * appear in the sheet (after whitespace normalisation) and must never be renamed by the app.
 */
export const FIELDS = [
  { key: "title", header: "الفكرة", label: "الفكرة", kind: "text", required: true },
  { key: "description", header: "وصف مختصر", label: "وصف مختصر", kind: "longtext", required: false },
  { key: "referenceUrl", header: "رابط المرجع", label: "رابط المرجع", kind: "url", required: false },
  { key: "platform", header: "المنصة", label: "المنصة", kind: "select", required: false },
  { key: "priority", header: "الأولوية", label: "الأولوية", kind: "select", required: false },
  { key: "status", header: "حالة التنفيذ", label: "حالة التنفيذ", kind: "select", required: false },
  { key: "owner", header: "المسؤول", label: "المسؤول", kind: "select", required: false },
  { key: "targetDate", header: "الموعد المستهدف", label: "الموعد المستهدف", kind: "date", required: false },
  { key: "notes", header: "ملاحظات", label: "ملاحظات", kind: "longtext", required: false },
] as const;

export type FieldDef = (typeof FIELDS)[number];
export type FieldKey = FieldDef["key"];
export type SelectFieldKey = Extract<FieldDef, { kind: "select" }>["key"];

export const FIELD_KEYS = FIELDS.map((f) => f.key) as FieldKey[];
export const SELECT_FIELDS: SelectFieldKey[] = ["platform", "priority", "status", "owner"];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<
  FieldKey,
  FieldDef
>;

/** Where a freshly created tab puts its headers: row 2, starting at column B. */
export const STANDARD_HEADER_ROW = 1; // 0-based → row 2
export const STANDARD_FIRST_COL = 1; // 0-based → column B

/**
 * Used only when the sheet has no data-validation list for a field. Values seen in existing
 * rows are always merged in as well, so nothing that is already in the sheet goes missing.
 */
export const DEFAULT_OPTIONS: Record<SelectFieldKey, string[]> = {
  platform: ["تيك توك", "إنستجرام", "سناب شات", "يوتيوب", "إكس", "لينكدإن"],
  priority: ["عالية", "متوسطة", "منخفضة"],
  status: ["لم يبدأ", "قيد التنفيذ", "قيد المراجعة", "تم التنفيذ", "مؤجل"],
  owner: ["Mr Nabil", "Najd Bandar"],
};

const INVISIBLES = /[​-‏‪-‮⁦-⁩﻿]/g;

/** Normalises a header or option for comparison (whitespace, tatweel, bidi marks). */
export function normalizeLabel(value: string): string {
  return value.replace(INVISIBLES, "").replace(/ـ/g, "").replace(/\s+/g, " ").trim();
}

const HEADER_INDEX = new Map(FIELDS.map((f) => [normalizeLabel(f.header), f.key]));

export function fieldForHeader(header: string): FieldKey | undefined {
  return HEADER_INDEX.get(normalizeLabel(header));
}
