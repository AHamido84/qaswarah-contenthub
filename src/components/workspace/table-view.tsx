"use client";

import { ArrowDown, ArrowUp, ArrowUpDown, ExternalLink } from "lucide-react";
import { useState } from "react";
import { useUpdateIdea } from "@/hooks/use-hub";
import { cn } from "@/lib/cn";
import { linkHost } from "@/lib/domain";
import type { Company, Idea } from "@/lib/sheets/types";
import { Avatar, DueChip, PlatformChip, PriorityBadge, StatusBadge } from "../chips";
import { OptionPicker } from "../option-picker";
import { useUser } from "../providers";
import { sortIdeas, type SortKey } from "./filters";

function SortHeader({
  label,
  k,
  sort,
  onSort,
  className,
}: {
  label: string;
  k: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (k: SortKey) => void;
  className?: string;
}) {
  const active = sort.key === k;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th scope="col" className={cn("px-3 py-2.5 text-start font-medium", className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex items-center gap-1 transition hover:text-ink", active && "text-ink")}>
        {label}
        <Icon className={cn("size-3", !active && "opacity-40")} />
      </button>
    </th>
  );
}

export function TableView({ company, ideas, onOpen }: { company: Company; ideas: Idea[]; onOpen: (i: Idea) => void }) {
  const user = useUser();
  const canEdit = user.can("editor");
  const update = useUpdateIdea();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "row", dir: 1 });
  const onSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
  const rows = sortIdeas(ideas, sort.key, sort.dir);
  const statusOpts = company.options.status;

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead className="border-b border-border bg-surface-2 text-xs text-muted">
            <tr>
              <SortHeader label="#" k="row" sort={sort} onSort={onSort} className="w-14" />
              <SortHeader label="الفكرة" k="title" sort={sort} onSort={onSort} />
              <SortHeader label="الحالة" k="status" sort={sort} onSort={onSort} className="w-44" />
              <SortHeader label="الأولوية" k="priority" sort={sort} onSort={onSort} className="w-28" />
              <th scope="col" className="w-32 px-3 py-2.5 text-start font-medium">المنصة</th>
              <th scope="col" className="w-40 px-3 py-2.5 text-start font-medium">المسؤول</th>
              <SortHeader label="الموعد" k="date" sort={sort} onSort={onSort} className="w-32" />
              <th scope="col" className="w-36 px-3 py-2.5 text-start font-medium">المرجع</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr
                key={i.row}
                onClick={() => onOpen(i)}
                className="group cursor-pointer border-b border-border/70 transition-colors last:border-0 hover:bg-surface-2"
              >
                <td className="px-3 py-3 text-xs tabular-nums text-faint">{i.row}</td>
                <td className="max-w-0 px-3 py-3">
                  <p className="truncate font-medium text-ink">{i.title}</p>
                  {i.description ? <p className="mt-0.5 truncate text-xs text-muted">{i.description}</p> : null}
                </td>
                <td className="px-3 py-2" onClick={(e) => canEdit && e.stopPropagation()}>
                  {canEdit ? (
                    <OptionPicker
                      value={i.status}
                      options={statusOpts.values}
                      allowCustom={!statusOpts.strict}
                      onChange={(status) => status !== i.status && update.mutate({ companyId: company.id, idea: i, patch: { status } })}
                      renderOption={(v) => <StatusBadge status={v} />}
                      trigger={
                        <button type="button" className="rounded-full transition hover:ring-2 hover:ring-border" aria-label="تغيير الحالة">
                          <StatusBadge status={i.status} />
                        </button>
                      }
                    />
                  ) : (
                    <StatusBadge status={i.status} />
                  )}
                </td>
                <td className="px-3 py-3">
                  <PriorityBadge priority={i.priority} />
                </td>
                <td className="px-3 py-3">
                  <PlatformChip platform={i.platform} />
                </td>
                <td className="px-3 py-3">
                  {i.owner ? (
                    <span className="inline-flex items-center gap-2">
                      <Avatar name={i.owner} size={22} className="ring-0" />
                      <span className="ltr truncate text-[13px] text-ink-2">{i.owner}</span>
                    </span>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
                <td className="px-3 py-3">
                  <DueChip iso={i.targetDateIso} raw={i.targetDate} status={i.status} />
                </td>
                <td className="px-3 py-3">
                  {i.referenceUrl ? (
                    <a
                      href={i.referenceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex max-w-full items-center gap-1 text-xs text-muted transition hover:text-accent"
                    >
                      <ExternalLink className="size-3.5 shrink-0" />
                      <span className="ltr truncate">{linkHost(i.referenceUrl) ?? i.referenceUrl}</span>
                    </a>
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
