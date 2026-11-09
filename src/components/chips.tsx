"use client";

import { AlarmClock, ArrowDown, ArrowUp, CalendarDays, Equal } from "lucide-react";
import {
  dueState,
  formatDate,
  initials,
  platformKey,
  priorityOf,
  relativeDue,
  stageOf,
  type Stage,
} from "@/lib/domain";
import { cn } from "@/lib/cn";

export const STAGE_STYLE: Record<Stage, { dot: string; chip: string; bar: string }> = {
  backlog: { dot: "bg-[var(--backlog)]", chip: "bg-[var(--backlog-soft)] text-[var(--backlog)]", bar: "var(--backlog)" },
  active: { dot: "bg-[var(--active)]", chip: "bg-[var(--active-soft)] text-[var(--active)]", bar: "var(--active)" },
  review: { dot: "bg-[var(--review)]", chip: "bg-[var(--review-soft)] text-[var(--review)]", bar: "var(--review)" },
  done: { dot: "bg-[var(--done)]", chip: "bg-[var(--done-soft)] text-[var(--done)]", bar: "var(--done)" },
  paused: { dot: "bg-[var(--paused)]", chip: "bg-[var(--paused-soft)] text-[var(--paused)]", bar: "var(--paused)" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const stage = stageOf(status);
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium whitespace-nowrap",
        STAGE_STYLE[stage].chip,
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", STAGE_STYLE[stage].dot)} />
      {status || "بدون حالة"}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  return <span className={cn("inline-block size-2 shrink-0 rounded-full", STAGE_STYLE[stageOf(status)].dot)} />;
}

const PRIORITY_STYLE = {
  high: { icon: ArrowUp, cls: "text-danger" },
  medium: { icon: Equal, cls: "text-[var(--review)]" },
  low: { icon: ArrowDown, cls: "text-[var(--backlog)]" },
  none: { icon: Equal, cls: "text-faint" },
} as const;

export function PriorityBadge({ priority, compact }: { priority: string; compact?: boolean }) {
  if (!priority) return null;
  const level = priorityOf(priority);
  const { icon: Icon, cls } = PRIORITY_STYLE[level];
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap", cls)} title={`الأولوية: ${priority}`}>
      <Icon className="size-3.5" strokeWidth={2.4} aria-hidden />
      {compact ? null : priority}
    </span>
  );
}

const PLATFORM_COLOR: Record<ReturnType<typeof platformKey>, string> = {
  tiktok: "#111111",
  instagram: "#d6249f",
  snapchat: "#e6c800",
  youtube: "#e62117",
  x: "#111111",
  linkedin: "#0a66c2",
  other: "var(--faint)",
};

export function PlatformChip({ platform }: { platform: string }) {
  if (!platform) return null;
  const key = platformKey(platform);
  return (
    <span className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 text-xs text-ink-2 whitespace-nowrap">
      <span
        className="size-2 rounded-[3px] ring-1 ring-black/5 dark:ring-white/20"
        style={{ background: key === "tiktok" || key === "x" ? "var(--ink)" : PLATFORM_COLOR[key] }}
        aria-hidden
      />
      {platform}
    </span>
  );
}

export function DueChip({ iso, raw, status }: { iso: string | null; raw: string; status: string }) {
  if (!iso && !raw) return null;
  if (!iso) return <span className="text-xs text-muted" title="تاريخ غير مفهوم">{raw}</span>;
  const state = dueState(iso, status);
  const style =
    state === "overdue"
      ? "text-danger bg-danger-soft"
      : state === "today"
        ? "text-[var(--review)] bg-[var(--review-soft)]"
        : state === "soon"
          ? "text-ink-2 bg-surface-3"
          : "text-muted";
  const Icon = state === "overdue" || state === "today" ? AlarmClock : CalendarDays;
  return (
    <span
      className={cn("inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-medium whitespace-nowrap", style)}
      title={formatDate(iso, true)}
    >
      <Icon className="size-3.5" aria-hidden />
      {state === "none" || state === "later" ? formatDate(iso) : relativeDue(iso)}
    </span>
  );
}

const AVATAR_HUES = [24, 200, 150, 280, 340, 45, 100];

export function Avatar({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  if (!name) return null;
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const hue = AVATAR_HUES[h % AVATAR_HUES.length];
  return (
    <span
      title={name}
      className={cn("inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-surface", className)}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, size * 0.4),
        background: `oklch(0.92 0.04 ${hue})`,
        color: `oklch(0.38 0.08 ${hue})`,
      }}
    >
      {initials(name)}
    </span>
  );
}
