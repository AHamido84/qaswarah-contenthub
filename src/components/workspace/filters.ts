import { dueState, PRIORITY_RANK, priorityOf, stageOf, STAGES, todayIso } from "@/lib/domain";
import type { Idea } from "@/lib/sheets/types";

export type View = "board" | "table" | "calendar";
export type DueFilter = "" | "overdue" | "week" | "none";
export type SortKey = "row" | "title" | "priority" | "status" | "date";

export interface Filters {
  q: string;
  platform: string;
  priority: string;
  owner: string;
  status: string;
  due: DueFilter;
}

export const EMPTY_FILTERS: Filters = { q: "", platform: "", priority: "", owner: "", status: "", due: "" };

export function readFilters(params: URLSearchParams): Filters {
  return {
    q: params.get("q") ?? "",
    platform: params.get("platform") ?? "",
    priority: params.get("priority") ?? "",
    owner: params.get("owner") ?? "",
    status: params.get("status") ?? "",
    due: (params.get("due") as DueFilter) ?? "",
  };
}

export const activeFilterCount = (f: Filters) =>
  [f.platform, f.priority, f.owner, f.status, f.due].filter(Boolean).length;

export function applyFilters(ideas: Idea[], f: Filters, today = todayIso()): Idea[] {
  const q = f.q.trim().toLowerCase();
  return ideas.filter((i) => {
    if (q && ![i.title, i.description, i.notes, i.owner, i.platform].some((v) => v.toLowerCase().includes(q))) return false;
    if (f.platform && i.platform !== f.platform) return false;
    if (f.priority && i.priority !== f.priority) return false;
    if (f.owner && i.owner !== f.owner) return false;
    if (f.status && (f.status === "__none" ? i.status !== "" : i.status !== f.status)) return false;
    if (f.due) {
      const d = dueState(i.targetDateIso, i.status, today);
      if (f.due === "overdue" && d !== "overdue") return false;
      if (f.due === "week" && !(d === "today" || d === "soon" || d === "overdue")) return false;
      if (f.due === "none" && i.targetDateIso) return false;
    }
    return true;
  });
}

const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.key, i]));

export function sortIdeas(ideas: Idea[], key: SortKey, dir: 1 | -1): Idea[] {
  const cmp: Record<SortKey, (a: Idea, b: Idea) => number> = {
    row: (a, b) => a.row - b.row,
    title: (a, b) => a.title.localeCompare(b.title, "ar"),
    priority: (a, b) => PRIORITY_RANK[priorityOf(a.priority)] - PRIORITY_RANK[priorityOf(b.priority)],
    status: (a, b) => STAGE_ORDER[stageOf(a.status)]! - STAGE_ORDER[stageOf(b.status)]!,
    date: (a, b) => (a.targetDateIso ?? "9999").localeCompare(b.targetDateIso ?? "9999"),
  };
  return [...ideas].sort((a, b) => cmp[key](a, b) * dir || a.row - b.row);
}
