"use client";

import { AlertTriangle, CalendarDays, Columns3, ListFilter, Plus, Rows3, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useCompany } from "@/hooks/use-hub";
import { cn } from "@/lib/cn";
import { dueState, stageOf, todayIso } from "@/lib/domain";
import type { Idea } from "@/lib/sheets/types";
import type { IdeaInputValues } from "@/lib/validation";
import { Avatar, PlatformChip, PriorityBadge, StatusBadge } from "../chips";
import { IdeaPanel } from "../idea-panel";
import { OptionPicker } from "../option-picker";
import { useUser } from "../providers";
import { Button, EmptyState, Skeleton } from "../ui";
import { BoardView } from "./board-view";
import { CalendarView } from "./calendar-view";
import { activeFilterCount, applyFilters, readFilters, type Filters, type View } from "./filters";
import { TableView } from "./table-view";

const VIEWS: { key: View; label: string; icon: typeof Columns3 }[] = [
  { key: "board", label: "لوحة", icon: Columns3 },
  { key: "table", label: "جدول", icon: Rows3 },
  { key: "calendar", label: "تقويم", icon: CalendarDays },
];

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="flex min-w-24 flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span className={cn("text-2xl font-semibold tabular-nums tracking-tight", tone)}>{value}</span>
    </div>
  );
}

function FilterChip({
  label,
  value,
  options,
  onChange,
  render,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
  render?: (v: string) => React.ReactNode;
}) {
  return (
    <OptionPicker
      value={value}
      options={options}
      onChange={onChange}
      renderOption={render}
      align="end"
      trigger={
        <button
          type="button"
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition",
            value
              ? "border-accent/40 bg-accent-soft text-ink"
              : "border-dashed border-border-strong text-muted hover:border-solid hover:text-ink",
          )}
        >
          <span className={cn(value && "text-muted")}>{label}</span>
          {value ? <span className="max-w-32 truncate font-medium">{value === "__none" ? "بدون" : value}</span> : null}
        </button>
      }
    />
  );
}

export function CompanyWorkspace({ companyId }: { companyId: number }) {
  const { company, isLoading, isError, error } = useCompany(companyId);
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = (params.get("view") as View) || "board";
  const filters = readFilters(params);
  const openRow = params.get("idea");
  const [creating, setCreating] = useState<Partial<IdeaInputValues> | null>(null);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, pathname, router],
  );
  const setFilter = (k: keyof Filters, v: string) => setParams({ [k]: v || null });

  const visible = useMemo(() => (company ? applyFilters(company.ideas, filters) : []), [company, filters]);
  const openIdea: Idea | null = (openRow && company?.ideas.find((i) => String(i.row) === openRow)) || null;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-16 w-full max-w-xl" />
        <div className="flex gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-96 w-[300px]" />
          ))}
        </div>
      </div>
    );
  }
  if (isError) return <EmptyState icon={<AlertTriangle className="size-5" />} title="تعذر تحميل البيانات" body={(error as Error)?.message} />;
  if (!company) {
    return (
      <EmptyState
        title="الشركة غير موجودة"
        body="ربما تم حذف التبويب أو تغيير معرفه في الجدول."
        action={
          <Link href="/" className="text-sm font-medium text-accent">
            العودة للنظرة العامة
          </Link>
        }
      />
    );
  }

  const today = todayIso();
  const counts = {
    total: company.ideas.length,
    active: company.ideas.filter((i) => ["active", "review"].includes(stageOf(i.status))).length,
    done: company.ideas.filter((i) => stageOf(i.status) === "done").length,
    overdue: company.ideas.filter((i) => dueState(i.targetDateIso, i.status, today) === "overdue").length,
  };
  const severeIssues = company.issues.filter((i) => i.severity === "error");
  const nFilters = activeFilterCount(filters);
  const o = company.options;

  return (
    <div className="animate-rise flex flex-col gap-6">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13px] text-muted">أفكار المحتوى</p>
          <h1 className="mt-1 text-[28px] font-bold tracking-tight">{company.name}</h1>
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Stat label="كل الأفكار" value={counts.total} />
          <Stat label="قيد العمل" value={counts.active} tone="text-[var(--active)]" />
          <Stat label="منجزة" value={counts.done} tone="text-[var(--done)]" />
          <Stat label="متأخرة" value={counts.overdue} tone={counts.overdue ? "text-danger" : undefined} />
        </div>
      </header>

      {severeIssues.length ? (
        <Link
          href="/health"
          className="flex items-center gap-3 rounded-xl border border-[var(--review)]/25 bg-[var(--review-soft)] px-4 py-3 text-sm transition hover:border-[var(--review)]/50"
        >
          <AlertTriangle className="size-4 shrink-0 text-[var(--review)]" />
          <span className="min-w-0 flex-1">
            <span className="font-medium text-ink">{severeIssues[0]!.title}</span>
            <span className="text-muted"> — التطبيق يعمل بأمان على الأعمدة الأصلية. </span>
          </span>
          <span className="shrink-0 font-medium text-[var(--review)]">مراجعة ←</span>
        </Link>
      ) : null}

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-[11px] border border-border bg-surface p-0.5 shadow-sm" role="tablist" aria-label="طريقة العرض">
            {VIEWS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setParams({ view: key === "board" ? null : key })}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-medium transition",
                  view === key ? "bg-ink text-bg shadow-sm dark:bg-surface-3 dark:text-ink" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-48 flex-1 sm:max-w-72">
            <Search className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
            <input
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value)}
              placeholder="بحث في الأفكار"
              aria-label="بحث في الأفكار"
              className="h-9 w-full rounded-[10px] border border-border bg-surface pr-9 pl-3 text-sm shadow-sm placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-[var(--ring)] focus:outline-none"
            />
          </div>

          {user.can("editor") ? (
            <Button variant="primary" className="ms-auto" onClick={() => setCreating({})}>
              <Plus className="size-4" /> فكرة جديدة
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ListFilter className="me-1 size-4 text-faint" aria-hidden />
          {view !== "board" ? (
            <FilterChip label="الحالة" value={filters.status} options={o.status.values} onChange={(v) => setFilter("status", v)} render={(v) => <StatusBadge status={v} />} />
          ) : null}
          <FilterChip label="الأولوية" value={filters.priority} options={o.priority.values} onChange={(v) => setFilter("priority", v)} render={(v) => <PriorityBadge priority={v} />} />
          <FilterChip label="المنصة" value={filters.platform} options={o.platform.values} onChange={(v) => setFilter("platform", v)} render={(v) => <PlatformChip platform={v} />} />
          <FilterChip
            label="المسؤول"
            value={filters.owner}
            options={o.owner.values}
            onChange={(v) => setFilter("owner", v)}
            render={(v) => (
              <span className="inline-flex items-center gap-2">
                <Avatar name={v} size={20} className="ring-0" />
                <span className="ltr">{v}</span>
              </span>
            )}
          />
          <FilterChip
            label="الموعد"
            value={{ overdue: "متأخرة", week: "هذا الأسبوع", none: "بدون موعد", "": "" }[filters.due]}
            options={["متأخرة", "هذا الأسبوع", "بدون موعد"]}
            onChange={(v) => setFilter("due", ({ متأخرة: "overdue", "هذا الأسبوع": "week", "بدون موعد": "none" } as Record<string, string>)[v] ?? "")}
          />
          {nFilters || filters.q ? (
            <button
              type="button"
              onClick={() => setParams({ q: null, status: null, priority: null, platform: null, owner: null, due: null })}
              className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[13px] text-muted transition hover:text-ink"
            >
              <X className="size-3.5" /> مسح ({visible.length} من {company.ideas.length})
            </button>
          ) : null}
        </div>
      </div>

      {company.ideas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border-strong bg-surface/50">
          <EmptyState
            title="لا توجد أفكار بعد"
            body="ابدأ بإضافة أول فكرة محتوى لهذه الشركة. ستُحفظ مباشرة في تبويبها في الجدول."
            action={
              user.can("editor") ? (
                <Button variant="primary" onClick={() => setCreating({})}>
                  <Plus className="size-4" /> إضافة أول فكرة
                </Button>
              ) : null
            }
          />
        </div>
      ) : visible.length === 0 && view !== "board" ? (
        <EmptyState title="لا توجد نتائج" body="جرّب تغيير الفلاتر أو كلمات البحث." />
      ) : view === "board" ? (
        <BoardView company={company} ideas={visible} onOpen={(i) => setParams({ idea: String(i.row) })} onCreate={(d) => setCreating(d)} />
      ) : view === "table" ? (
        <TableView company={company} ideas={visible} onOpen={(i) => setParams({ idea: String(i.row) })} />
      ) : (
        <CalendarView ideas={visible} onOpen={(i) => setParams({ idea: String(i.row) })} onCreate={(d) => setCreating(d)} />
      )}

      <IdeaPanel
        company={company}
        idea={openIdea}
        open={!!openIdea}
        onOpenChange={(open) => !open && setParams({ idea: null })}
      />
      <IdeaPanel
        company={company}
        idea={null}
        open={!!creating}
        defaults={creating ?? undefined}
        onOpenChange={(open) => !open && setCreating(null)}
      />
    </div>
  );
}
