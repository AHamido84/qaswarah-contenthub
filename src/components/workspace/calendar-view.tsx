"use client";

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { stageOf, todayIso } from "@/lib/domain";
import type { Idea } from "@/lib/sheets/types";
import { STAGE_STYLE } from "../chips";
import { useUser } from "../providers";
import { Button } from "../ui";

const WEEKDAYS = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const monthFmt = new Intl.DateTimeFormat("ar-SA-u-nu-latn-ca-gregory", { month: "long", year: "numeric" });

export function CalendarView({
  ideas,
  onOpen,
  onCreate,
}: {
  ideas: Idea[];
  onOpen: (i: Idea) => void;
  onCreate: (defaults: { targetDate: string }) => void;
}) {
  const user = useUser();
  const today = todayIso();
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${today}T00:00:00`)));

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 }),
      }),
    [month],
  );
  const byDay = useMemo(() => {
    const m = new Map<string, Idea[]>();
    for (const i of ideas) if (i.targetDateIso) m.set(i.targetDateIso, [...(m.get(i.targetDateIso) ?? []), i]);
    return m;
  }, [ideas]);
  const unscheduled = ideas.filter((i) => !i.targetDateIso);

  return (
    <div className="flex flex-col gap-4 xl:flex-row">
      <div className="min-w-0 flex-1 overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <h3 className="text-[15px] font-semibold">{monthFmt.format(month)}</h3>
          <div className="ms-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setMonth(startOfMonth(new Date(`${today}T00:00:00`)))}>
              اليوم
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="الشهر السابق">
              <ChevronRight className="size-4" />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="الشهر التالي">
              <ChevronLeft className="size-4" />
            </Button>
          </div>
        </header>
        <div className="scrollbar-thin overflow-x-auto">
          <div className="grid min-w-[760px] grid-cols-7">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b border-border bg-surface-2 px-2 py-2 text-center text-xs font-medium text-muted">
                {d}
              </div>
            ))}
            {days.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const list = byDay.get(iso) ?? [];
              const inMonth = isSameMonth(day, month);
              const isToday = iso === today;
              return (
                <div
                  key={iso}
                  onDoubleClick={() => user.can("editor") && onCreate({ targetDate: iso })}
                  className={cn(
                    "group min-h-28 border-b border-l border-border/70 p-1.5 [&:nth-child(7n)]:border-l-0",
                    !inMonth && "bg-surface-2/60",
                  )}
                >
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span
                      className={cn(
                        "grid size-6 place-items-center rounded-full text-xs tabular-nums",
                        isToday ? "bg-ink font-semibold text-bg dark:bg-accent dark:text-accent-ink" : inMonth ? "text-ink-2" : "text-faint",
                      )}
                    >
                      {day.getDate()}
                    </span>
                    {user.can("editor") ? (
                      <button
                        type="button"
                        onClick={() => onCreate({ targetDate: iso })}
                        className="hidden size-5 place-items-center rounded text-xs text-muted hover:bg-surface-3 group-hover:grid"
                        aria-label={`إضافة فكرة في ${iso}`}
                      >
                        +
                      </button>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-1">
                    {list.slice(0, 3).map((i) => (
                      <button
                        key={i.row}
                        type="button"
                        onClick={() => onOpen(i)}
                        className="flex items-center gap-1.5 truncate rounded-md bg-surface-3/80 px-1.5 py-1 text-start text-[11.5px] text-ink-2 transition hover:bg-accent-soft hover:text-ink"
                        title={i.title}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full", STAGE_STYLE[stageOf(i.status)].dot)} />
                        <span className={cn("truncate", stageOf(i.status) === "done" && "text-muted line-through decoration-faint")}>{i.title}</span>
                      </button>
                    ))}
                    {list.length > 3 ? <span className="px-1.5 text-[11px] text-muted">+{list.length - 3} أخرى</span> : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 self-start rounded-2xl border border-border bg-surface p-4 shadow-sm xl:w-72">
        <h3 className="text-sm font-semibold">بدون موعد</h3>
        <p className="mt-0.5 text-xs text-muted">{unscheduled.length} فكرة تحتاج تاريخًا مستهدفًا</p>
        <div className="mt-3 flex flex-col gap-1">
          {unscheduled.slice(0, 12).map((i) => (
            <button
              key={i.row}
              onClick={() => onOpen(i)}
              className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-[13px] text-ink-2 transition hover:bg-surface-3"
            >
              <span className={cn("size-1.5 shrink-0 rounded-full", STAGE_STYLE[stageOf(i.status)].dot)} />
              <span className="truncate">{i.title}</span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
