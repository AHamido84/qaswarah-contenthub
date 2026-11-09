/**
 * Client-safe domain helpers: status stages, priority ranking, deadline maths.
 * Status labels come from the sheet, so their meaning is inferred from the wording.
 */
import { normalizeLabel } from "./sheets/schema";

export type Stage = "backlog" | "active" | "review" | "done" | "paused";

export const STAGES: { key: Stage; label: string }[] = [
  { key: "backlog", label: "لم يبدأ" },
  { key: "active", label: "قيد التنفيذ" },
  { key: "review", label: "مراجعة" },
  { key: "done", label: "منجز" },
  { key: "paused", label: "متوقف" },
];

export function stageOf(status: string): Stage {
  const s = normalizeLabel(status);
  if (!s) return "backlog";
  if (/(مؤجل|ملغ|متوقف|معلق|إلغاء|الغاء)/.test(s)) return "paused";
  if (/(^تم|^اكتمل|منشور|^نُشر|^نشر|مكتمل|منجز|انتهى)/.test(s)) return "done";
  if (/(مراجع|اعتماد|موافقة)/.test(s)) return "review";
  if (/(قيد|جار|جاري|تصوير|مونتاج|كتابة|تنفيذ|تحرير|إنتاج|انتاج)/.test(s)) return "active";
  return "backlog";
}

export type PriorityLevel = "high" | "medium" | "low" | "none";

export function priorityOf(priority: string): PriorityLevel {
  const s = normalizeLabel(priority);
  if (/عالي|عاجل|مرتفع/.test(s)) return "high";
  if (/متوسط/.test(s)) return "medium";
  if (/منخفض|ضعيف/.test(s)) return "low";
  return "none";
}

export const PRIORITY_RANK: Record<PriorityLevel, number> = { high: 0, medium: 1, low: 2, none: 3 };

/** Today's date (yyyy-mm-dd) in Riyadh, where the team works. */
export function todayIso(timeZone = "Asia/Riyadh"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 86_400_000);
}

export type DueState = "overdue" | "today" | "soon" | "later" | "none";

export function dueState(targetIso: string | null, status: string, today = todayIso()): DueState {
  if (!targetIso) return "none";
  const st = stageOf(status);
  if (st === "done" || st === "paused") return "none";
  const d = daysBetween(today, targetIso);
  if (d < 0) return "overdue";
  if (d === 0) return "today";
  if (d <= 7) return "soon";
  return "later";
}

const dateFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const dateFmtYear = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export function formatDate(isoDate: string, withYear = false): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  return (withYear ? dateFmtYear : dateFmt).format(d);
}

export function relativeDue(targetIso: string, today = todayIso()): string {
  const d = daysBetween(today, targetIso);
  if (d === 0) return "اليوم";
  if (d === 1) return "غدًا";
  if (d === -1) return "أمس";
  if (d < 0) return `متأخر ${-d} يوم`;
  if (d <= 10) return `بعد ${d} أيام`;
  return formatDate(targetIso);
}

export function platformKey(platform: string): "tiktok" | "instagram" | "snapchat" | "youtube" | "x" | "linkedin" | "other" {
  const s = normalizeLabel(platform).toLowerCase();
  if (/تيك|tiktok/.test(s)) return "tiktok";
  if (/[اإ]نست|instagram/.test(s)) return "instagram";
  if (/سناب|snap/.test(s)) return "snapchat";
  if (/يوتيوب|youtube/.test(s)) return "youtube";
  if (/^(x|إكس|اكس|تويتر|twitter)$/.test(s)) return "x";
  if (/لينكد|linkedin/.test(s)) return "linkedin";
  return "other";
}

export function linkHost(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** Initials for avatars; works for Arabic and Latin names. */
export function initials(name: string): string {
  const parts = name.replace(/^(mr|mrs|ms|dr|أ\.|م\.|د\.)\s+/i, "").trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
