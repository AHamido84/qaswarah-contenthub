"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, AlertTriangle, CheckCircle2, ExternalLink, Info, Wrench } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useRefresh, useWorkbook } from "@/hooks/use-hub";
import { api, ApiError } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { FIELD_BY_KEY } from "@/lib/sheets/schema";
import type { Company, Issue } from "@/lib/sheets/types";
import { Modal } from "./dialog";
import { useUser } from "./providers";
import { Button, Card, EmptyState, Input, Skeleton } from "./ui";

interface Plan {
  companyName: string;
  columns: { field: string; header: string; primary: string; duplicate: string }[];
  moves: { row: number; field: keyof typeof FIELD_BY_KEY; value: string }[];
  conflicts: { row: number; field: keyof typeof FIELD_BY_KEY; primary: string; duplicate: string }[];
  orphans: { row: number; field: keyof typeof FIELD_BY_KEY; value: string }[];
  identical: number;
  canPreserveConflicts: boolean;
}

const SEVERITY = {
  error: { icon: AlertOctagon, cls: "text-danger bg-danger-soft", label: "يحتاج إجراء" },
  warning: { icon: AlertTriangle, cls: "text-[var(--review)] bg-[var(--review-soft)]", label: "تنبيه" },
  info: { icon: Info, cls: "text-muted bg-surface-3", label: "معلومة" },
} as const;

function IssueRow({ issue, action }: { issue: Issue; action?: React.ReactNode }) {
  const s = SEVERITY[issue.severity];
  return (
    <li className="flex gap-3 px-5 py-4">
      <span className={cn("mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg", s.cls)} title={s.label}>
        <s.icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{issue.title}</p>
        <p className="mt-1 text-[13px] leading-relaxed whitespace-pre-line text-muted">{issue.detail}</p>
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </li>
  );
}

function PlanTable({ title, note, rows }: { title: string; note: string; rows: { row: number; field: string; text: React.ReactNode }[] }) {
  if (!rows.length) return null;
  return (
    <div>
      <p className="text-sm font-medium">
        {title} <span className="text-muted">({rows.length})</span>
      </p>
      <p className="mb-2 text-xs text-muted">{note}</p>
      <div className="scrollbar-thin max-h-44 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-border/60 last:border-0">
                <td className="w-14 px-2.5 py-1.5 text-faint tabular-nums">صف {r.row}</td>
                <td className="w-28 px-2.5 py-1.5 text-muted">{r.field}</td>
                <td className="px-2.5 py-1.5">{r.text}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DuplicateFixDialog({ company, open, onOpenChange }: { company: Company; open: boolean; onOpenChange: (o: boolean) => void }) {
  const [confirm, setConfirm] = useState("");
  const [applying, setApplying] = useState(false);
  const refresh = useRefresh();
  const preview = useQuery({
    queryKey: ["duplicate-plan", company.id],
    queryFn: () => api<{ plan: Plan; planHash: string }>(`/api/companies/${company.id}/duplicates`),
    enabled: open,
    staleTime: 0,
  });
  const plan = preview.data?.plan;
  const header = (f: string) => FIELD_BY_KEY[f as keyof typeof FIELD_BY_KEY]?.header ?? f;

  async function apply() {
    if (!preview.data) return;
    setApplying(true);
    try {
      const res = await api<{ backupTab: string }>(`/api/companies/${company.id}/duplicates`, {
        method: "POST",
        json: { confirmName: confirm, planHash: preview.data.planHash },
      });
      await refresh();
      toast.success("تم إصلاح الأعمدة المكررة", { description: `نسخة احتياطية مخفية: «${res.backupTab}»` });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "تعذر تطبيق الإصلاح");
      if (err instanceof ApiError && err.code === "plan-changed") void preview.refetch();
    } finally {
      setApplying(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConfirm("");
      }}
      title={`إصلاح الأعمدة المكررة — ${company.name}`}
      description="راجع ما سيحدث بالضبط. لن يتغير شيء في الجدول قبل موافقتك."
      className="max-w-2xl"
    >
      {preview.isLoading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-32" />
        </div>
      ) : preview.isError || !plan ? (
        <p className="text-sm text-danger">{(preview.error as Error)?.message ?? "تعذر تحميل الخطة"}</p>
      ) : (
        <div className="flex flex-col gap-5">
          <ol className="flex flex-col gap-2 rounded-xl border border-border bg-surface-2 p-4 text-[13px] leading-relaxed text-ink-2">
            <li>
              <b>١.</b> إنشاء نسخة احتياطية كاملة من التبويب (مخفية) قبل أي تعديل.
            </li>
            <li>
              <b>٢.</b> نقل {plan.moves.length} قيمة موجودة فقط في الأعمدة المكررة إلى الأعمدة الأصلية.
            </li>
            <li>
              <b>٣.</b> حفظ {plan.conflicts.length} قيمة متعارضة داخل «ملاحظات» نفس الصف بدل حذفها.
            </li>
            <li>
              <b>٤.</b> تفريغ الأعمدة {plan.columns.map((c) => c.duplicate).join("، ")} (العنوان والقيم والقوائم المنسدلة). لا يتم حذف الأعمدة، فلا يتحرك شيء في
              الجدول.
            </li>
            {plan.identical ? <li className="text-muted">{plan.identical} قيمة مطابقة للأصل — لا تحتاج إلى نقل.</li> : null}
          </ol>

          <PlanTable
            title="قيم سيتم نقلها"
            note="الخلية الأصلية فارغة، والقيمة موجودة فقط في العمود المكرر."
            rows={plan.moves.map((m) => ({ row: m.row, field: header(m.field), text: m.value }))}
          />
          <PlanTable
            title="قيم متعارضة"
            note="تبقى القيمة الأصلية، وتُضاف القيمة المكررة إلى «ملاحظات»."
            rows={plan.conflicts.map((c) => ({
              row: c.row,
              field: header(c.field),
              text: (
                <span>
                  <span className="text-ink">{c.primary}</span>
                  <span className="mx-1.5 text-faint">مقابل</span>
                  <span className="text-[var(--review)]">{c.duplicate}</span>
                </span>
              ),
            }))}
          />
          <PlanTable
            title="قيم في صفوف بلا فكرة"
            note="ستبقى محفوظة في النسخة الاحتياطية فقط."
            rows={plan.orphans.map((o) => ({ row: o.row, field: header(o.field), text: o.value }))}
          />

          <div className="border-t border-border pt-4">
            <label htmlFor="confirm-name" className="text-[13px] font-medium">
              للموافقة، اكتب اسم الشركة: <span className="font-semibold text-ink">{company.name}</span>
            </label>
            <Input id="confirm-name" className="mt-2" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="off" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              إلغاء
            </Button>
            <Button
              variant="primary"
              loading={applying}
              disabled={confirm.trim() !== company.name.trim() || (plan.conflicts.length > 0 && !plan.canPreserveConflicts)}
              onClick={() => void apply()}
            >
              <Wrench className="size-4" /> أوافق — طبّق الإصلاح
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

export function DataHealth() {
  const { data, isLoading } = useWorkbook();
  const user = useUser();
  const [fixing, setFixing] = useState<Company | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-10 w-60" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const sheetUrl = data.source === "google" ? `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}/edit` : null;

  return (
    <div className="animate-rise flex flex-col gap-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">صحة البيانات</h1>
          <p className="mt-1 text-[15px] text-muted">ما اكتشفه التطبيق في بنية الجدول، وما يقترحه لإصلاحه. لا يتم حذف أي بيانات دون موافقتك.</p>
        </div>
        {sheetUrl ? (
          <a href={sheetUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline">
            فتح الجدول <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </header>

      {data.companies.map((c) => {
        const sorted = [...c.issues].sort((a, b) => ["error", "warning", "info"].indexOf(a.severity) - ["error", "warning", "info"].indexOf(b.severity));
        return (
          <Card key={c.id}>
            <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-5 py-4">
              <h2 className="text-[15px] font-semibold">{c.name}</h2>
              <span className="text-xs text-muted">
                {c.ideas.length} فكرة · {c.placeholderRows} صف فارغ تم تجاهله · العناوين في الصف {c.layout.headerRow + 1}
              </span>
              <div className="ms-auto flex flex-wrap gap-1.5">
                {(["status", "priority", "platform", "owner"] as const).map((k) => (
                  <span
                    key={k}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px]",
                      c.options[k].source === "validation" ? "bg-[var(--done-soft)] text-[var(--done)]" : "bg-[var(--review-soft)] text-[var(--review)]",
                    )}
                    title={c.options[k].values.join("، ")}
                  >
                    {FIELD_BY_KEY[k].header}: {c.options[k].source === "validation" ? "من الجدول" : "مقترحة"}
                  </span>
                ))}
              </div>
            </header>
            {sorted.length === 0 ? (
              <div className="flex items-center gap-3 px-5 py-5 text-sm text-muted">
                <CheckCircle2 className="size-5 text-[var(--done)]" /> لا توجد مشاكل في هذا التبويب.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {sorted.map((issue, idx) => (
                  <IssueRow
                    key={idx}
                    issue={issue}
                    action={
                      issue.code === "duplicate-columns" ? (
                        user.can("admin") ? (
                          <Button size="sm" onClick={() => setFixing(c)}>
                            <Wrench className="size-3.5" /> معاينة الإصلاح المقترح
                          </Button>
                        ) : (
                          <p className="text-xs text-faint">يمكن للمدير مراجعة الإصلاح وتطبيقه.</p>
                        )
                      ) : undefined
                    }
                  />
                ))}
              </ul>
            )}
          </Card>
        );
      })}

      {data.ignoredTabs.length ? (
        <Card>
          <header className="border-b border-border px-5 py-4">
            <h2 className="text-[15px] font-semibold">تبويبات غير معروضة</h2>
          </header>
          <ul className="divide-y divide-border">
            {data.ignoredTabs.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-xs text-muted">{t.reason}</span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {data.companies.length === 0 ? <EmptyState title="لا توجد تبويبات شركات" /> : null}
      {fixing ? <DuplicateFixDialog company={fixing} open={!!fixing} onOpenChange={(o) => !o && setFixing(null)} /> : null}
    </div>
  );
}
