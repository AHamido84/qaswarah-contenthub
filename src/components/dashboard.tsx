"use client";

import { AlarmClock, ArrowLeft, Building2, CheckCircle2, Lightbulb, Loader } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { useWorkbook } from "@/hooks/use-hub";
import { cn } from "@/lib/cn";
import { dueState, formatDate, stageOf, STAGES, todayIso, type Stage } from "@/lib/domain";
import type { Company, Idea } from "@/lib/sheets/types";
import { Avatar, DueChip, STAGE_STYLE, StatusDot } from "./chips";
import { useUser } from "./providers";
import { Card, CardHeader, EmptyState, Skeleton } from "./ui";

type Row = Idea & { company: Company };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en", { hour: "numeric", hour12: false, timeZone: "Asia/Riyadh" }).format(new Date()));
  return h < 12 ? "صباح الخير" : "مساء الخير";
}

function StageBar({ ideas, className }: { ideas: Idea[]; className?: string }) {
  const counts = STAGES.map((s) => ({ ...s, n: ideas.filter((i) => stageOf(i.status) === s.key).length }));
  const total = ideas.length || 1;
  return (
    <div className={cn("flex h-2 w-full gap-[3px] overflow-hidden rounded-full bg-surface-3", className)} role="img" aria-label={counts.map((c) => `${c.label}: ${c.n}`).join("، ")}>
      {counts
        .filter((c) => c.n)
        .map((c) => (
          <div key={c.key} className="h-full first:rounded-r-full last:rounded-l-full" style={{ width: `${(c.n / total) * 100}%`, background: STAGE_STYLE[c.key].bar }} title={`${c.label}: ${c.n}`} />
        ))}
    </div>
  );
}

function Kpi({ label, value, hint, icon, tone }: { label: string; value: number; hint: string; icon: React.ReactNode; tone: string }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-muted">{label}</span>
        <span className={cn("grid size-8 place-items-center rounded-[10px]", tone)}>{icon}</span>
      </div>
      <p className="mt-3 text-[32px] leading-none font-semibold tracking-tight tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </Card>
  );
}

export function Dashboard() {
  const { data, isLoading, isError, error } = useWorkbook();
  const user = useUser();
  const today = todayIso();

  const all: Row[] = useMemo(() => data?.companies.flatMap((c) => c.ideas.map((i) => ({ ...i, company: c }))) ?? [], [data]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (isError || !data) return <EmptyState title="تعذر تحميل البيانات" body={(error as Error)?.message} />;

  const by = (s: Stage) => all.filter((i) => stageOf(i.status) === s).length;
  const overdue = all.filter((i) => dueState(i.targetDateIso, i.status, today) === "overdue").sort((a, b) => a.targetDateIso!.localeCompare(b.targetDateIso!));
  const upcoming = all
    .filter((i) => ["today", "soon"].includes(dueState(i.targetDateIso, i.status, today)))
    .sort((a, b) => a.targetDateIso!.localeCompare(b.targetDateIso!));
  const owners = [...new Set(all.map((i) => i.owner).filter(Boolean))]
    .map((o) => ({ name: o, ideas: all.filter((i) => i.owner === o) }))
    .sort((a, b) => b.ideas.length - a.ideas.length);
  const unassigned = all.filter((i) => !i.owner && stageOf(i.status) !== "done").length;
  const platforms = [...new Set(all.map((i) => i.platform).filter(Boolean))]
    .map((p) => ({ name: p, n: all.filter((i) => i.platform === p).length }))
    .sort((a, b) => b.n - a.n);
  const maxPlatform = Math.max(1, ...platforms.map((p) => p.n));

  const firstName = (user.name || "").split(" ")[0];

  return (
    <div className="animate-rise flex flex-col gap-8">
      <header>
        <p className="text-[13px] text-muted">{formatDate(today, true)}</p>
        <h1 className="mt-1 text-[28px] font-bold tracking-tight">
          {greeting()}
          {firstName ? `، ${firstName}` : ""}
        </h1>
        <p className="mt-1 text-[15px] text-muted">
          {overdue.length
            ? `لديكم ${overdue.length} ${overdue.length === 1 ? "فكرة متأخرة" : "أفكار متأخرة"} و${upcoming.length} مستحقة خلال الأسبوع.`
            : upcoming.length
              ? `${upcoming.length} أفكار مستحقة خلال الأسبوع القادم.`
              : "كل شيء في موعده."}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="كل الأفكار" value={all.length} hint={`في ${data.companies.length} شركات`} icon={<Lightbulb className="size-4" />} tone="bg-accent-soft text-accent" />
        <Kpi label="قيد العمل" value={by("active") + by("review")} hint={`${by("review")} بانتظار المراجعة`} icon={<Loader className="size-4" />} tone="bg-[var(--active-soft)] text-[var(--active)]" />
        <Kpi label="منجزة" value={by("done")} hint={`${Math.round((by("done") / Math.max(1, all.length)) * 100)}% من الأفكار`} icon={<CheckCircle2 className="size-4" />} tone="bg-[var(--done-soft)] text-[var(--done)]" />
        <Kpi label="متأخرة" value={overdue.length} hint={overdue.length ? "تحتاج متابعة" : "لا يوجد تأخير"} icon={<AlarmClock className="size-4" />} tone="bg-danger-soft text-danger" />
      </div>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-[15px] font-semibold">الشركات</h2>
          <div className="hidden items-center gap-3 text-xs text-muted sm:flex">
            {STAGES.map((s) => (
              <span key={s.key} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", STAGE_STYLE[s.key].dot)} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.companies.map((c) => {
            const late = c.ideas.filter((i) => dueState(i.targetDateIso, i.status, today) === "overdue").length;
            const errors = c.issues.filter((i) => i.severity === "error").length;
            return (
              <Link
                key={c.id}
                href={`/companies/${c.id}`}
                className="group rounded-2xl border border-border bg-surface p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-surface-3 text-ink-2">
                    <Building2 className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-[15px] font-semibold">{c.name}</h3>
                    <p className="text-xs text-muted">
                      {c.ideas.length} فكرة
                      {late ? <span className="text-danger"> · {late} متأخرة</span> : null}
                      {errors ? <span className="text-[var(--review)]"> · تحتاج مراجعة</span> : null}
                    </p>
                  </div>
                  <ArrowLeft className="size-4 text-faint transition group-hover:-translate-x-0.5 group-hover:text-ink" />
                </div>
                <StageBar ideas={c.ideas} className="mt-5" />
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>{c.ideas.filter((i) => ["active", "review"].includes(stageOf(i.status))).length} قيد العمل</span>
                  <span>{c.ideas.filter((i) => stageOf(i.status) === "done").length} منجزة</span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="المواعيد" subtitle="المتأخر أولًا، ثم المستحق خلال ٧ أيام" />
          {overdue.length + upcoming.length === 0 ? (
            <EmptyState title="لا توجد مواعيد قريبة" body="لا توجد أفكار متأخرة أو مستحقة هذا الأسبوع." className="py-10" />
          ) : (
            <ul className="px-2 pb-2">
              {[...overdue, ...upcoming].slice(0, 9).map((i) => (
                <li key={`${i.company.id}-${i.row}`}>
                  <Link
                    href={`/companies/${i.company.id}?idea=${i.row}`}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
                  >
                    <StatusDot status={i.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.title}</span>
                      <span className="block truncate text-xs text-muted">
                        {i.company.name}
                        {i.status ? ` · ${i.status}` : ""}
                      </span>
                    </span>
                    {i.owner ? <Avatar name={i.owner} size={24} className="ring-0" /> : null}
                    <span className="w-24 text-end">
                      <DueChip iso={i.targetDateIso} raw={i.targetDate} status={i.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader title="فريق العمل" subtitle={unassigned ? `${unassigned} أفكار مفتوحة بدون مسؤول` : "توزيع الأفكار على المسؤولين"} />
            <ul className="flex flex-col gap-4 px-5 pb-5">
              {owners.map((o) => {
                const open = o.ideas.filter((i) => stageOf(i.status) !== "done").length;
                const late = o.ideas.filter((i) => dueState(i.targetDateIso, i.status, today) === "overdue").length;
                return (
                  <li key={o.name} className="flex items-center gap-3">
                    <Avatar name={o.name} size={34} className="ring-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="ltr truncate text-sm font-medium">{o.name}</span>
                        <span className="shrink-0 text-xs text-muted">
                          {open} مفتوحة{late ? <span className="text-danger"> · {late} متأخرة</span> : null}
                        </span>
                      </div>
                      <StageBar ideas={o.ideas} className="mt-2 h-1.5" />
                    </div>
                  </li>
                );
              })}
              {owners.length === 0 ? <p className="text-sm text-muted">لم يتم تعيين مسؤولين بعد.</p> : null}
            </ul>
          </Card>

          <Card>
            <CardHeader title="المنصات" />
            <ul className="flex flex-col gap-3 px-5 pb-5">
              {platforms.map((p) => (
                <li key={p.name} className="grid grid-cols-[88px_1fr_28px] items-center gap-3 text-sm">
                  <span className="truncate text-ink-2">{p.name}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-surface-3">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(p.n / maxPlatform) * 100}%`, background: "var(--accent)" }}
                    />
                  </span>
                  <span className="text-end text-xs tabular-nums text-muted">{p.n}</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
