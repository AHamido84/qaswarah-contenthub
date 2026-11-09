"use client";

import { ExternalLink, Link2, Loader2, Sheet, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCreateIdea, useDeleteIdea, useUpdateIdea, useWorkbook } from "@/hooks/use-hub";
import { ApiError } from "@/lib/client-api";
import { linkHost } from "@/lib/domain";
import { FIELD_KEYS, type FieldKey, type SelectFieldKey } from "@/lib/sheets/schema";
import type { Company, Idea } from "@/lib/sheets/types";
import { ideaInputSchema, type IdeaInputValues } from "@/lib/validation";
import { Avatar, PlatformChip, PriorityBadge, StatusBadge } from "./chips";
import { DialogClose, Modal, SidePanel } from "./dialog";
import { OptionPicker } from "./option-picker";
import { useUser } from "./providers";
import { Button, Input, Kbd, Textarea } from "./ui";

const EMPTY: IdeaInputValues = {
  title: "",
  description: "",
  referenceUrl: "",
  platform: "",
  priority: "",
  status: "",
  owner: "",
  targetDate: "",
  notes: "",
};

function fromIdea(idea: Idea): IdeaInputValues {
  const v = { ...EMPTY };
  for (const k of FIELD_KEYS) v[k] = idea[k];
  v.targetDate = idea.targetDateIso ?? "";
  return v;
}

const RENDER: Record<SelectFieldKey, (v: string) => React.ReactNode> = {
  status: (v) => <StatusBadge status={v} />,
  priority: (v) => <PriorityBadge priority={v} />,
  platform: (v) => <PlatformChip platform={v} />,
  owner: (v) => (
    <span className="inline-flex items-center gap-2">
      <Avatar name={v} size={20} className="ring-0" />
      <span className="ltr">{v}</span>
    </span>
  ),
};

function Property({ label, children, htmlFor }: { label: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-center gap-3 sm:grid-cols-[130px_1fr]">
      <label htmlFor={htmlFor} className="text-[13px] text-muted">
        {label}
      </label>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function IdeaPanel({
  company,
  idea,
  open,
  onOpenChange,
  defaults,
}: {
  company: Company;
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaults?: Partial<IdeaInputValues>;
}) {
  const user = useUser();
  const canEdit = user.can("editor");
  const { data: wb } = useWorkbook();
  const isNew = !idea;
  const [values, setValues] = useState<IdeaInputValues>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [conflict, setConflict] = useState<Idea | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const create = useCreateIdea();
  const update = useUpdateIdea();
  const remove = useDeleteIdea();

  useEffect(() => {
    if (!open) return;
    setValues(idea ? fromIdea(idea) : { ...EMPTY, ...defaults });
    setErrors({});
    setConflict(null);
    // Only reset when the panel opens or switches idea, not on background refreshes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idea?.row, company.id]);

  const original = useMemo(() => (idea ? fromIdea(idea) : { ...EMPTY, ...defaults }), [idea, defaults]);
  const dirtyKeys = FIELD_KEYS.filter((k) => values[k].trim() !== original[k].trim());
  const dirty = isNew ? !!values.title.trim() : dirtyKeys.length > 0;
  const saving = create.isPending || update.isPending;
  const missing = new Set(company.layout.missingFields);

  const set = (k: FieldKey, v: string) => {
    setValues((s) => ({ ...s, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  async function save() {
    const parsed = ideaInputSchema.safeParse(values);
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) next[issue.path[0] as FieldKey] ??= issue.message;
      setErrors(next);
      if (next.title) titleRef.current?.focus();
      return;
    }
    try {
      if (isNew) {
        await create.mutateAsync({ companyId: company.id, input: parsed.data });
      } else {
        const patch: Partial<IdeaInputValues> = {};
        for (const k of dirtyKeys) patch[k] = parsed.data[k];
        await update.mutateAsync({ companyId: company.id, idea: idea!, patch });
      }
      onOpenChange(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setConflict((err.data as { current?: Idea } | undefined)?.current ?? null);
      }
      if (err instanceof ApiError && err.code === "invalid-option") {
        const field = (err.data as { field?: FieldKey } | undefined)?.field;
        if (field) setErrors((e) => ({ ...e, [field]: err.message }));
      }
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && dirty && canEdit) {
      e.preventDefault();
      void save();
    }
  };

  const sheetLink =
    wb && wb.source === "google" && idea
      ? `https://docs.google.com/spreadsheets/d/${wb.spreadsheetId}/edit#gid=${company.id}&range=A${idea.row}`
      : null;
  const host = values.referenceUrl ? linkHost(values.referenceUrl) : null;
  const readOnly = !canEdit;

  const picker = (key: SelectFieldKey) => {
    const opts = company.options[key];
    const options = opts.values.includes(values[key]) || !values[key] ? opts.values : [values[key], ...opts.values];
    return (
      <>
        <OptionPicker
          id={`f-${key}`}
          value={values[key]}
          options={options}
          onChange={(v) => set(key, v)}
          allowCustom={!opts.strict}
          disabled={readOnly || missing.has(key)}
          renderValue={RENDER[key]}
          renderOption={RENDER[key]}
          placeholder={missing.has(key) ? "العمود غير موجود" : "—"}
          className="h-9 border-transparent bg-transparent px-2 hover:bg-surface-2 hover:border-border"
        />
        {errors[key] ? <p className="mt-1 px-2 text-xs text-danger">{errors[key]}</p> : null}
      </>
    );
  };

  return (
    <SidePanel
      open={open}
      onOpenChange={(o) => {
        if (!o && dirty && canEdit && !saving && !window.confirm("لديك تعديلات غير محفوظة. هل تريد الإغلاق؟")) return;
        onOpenChange(o);
      }}
      title={isNew ? "فكرة جديدة" : values.title || "فكرة"}
      header={
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
          <div className="min-w-0 flex-1 truncate text-[13px] text-muted">
            <span>{company.name}</span>
            <span className="mx-1.5 text-faint">/</span>
            <span className="text-ink-2">{isNew ? "فكرة جديدة" : `الصف ${idea.row}`}</span>
          </div>
          {sheetLink ? (
            <a
              href={sheetLink}
              target="_blank"
              rel="noreferrer"
              className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-ink"
              title="فتح الصف في Google Sheets"
              aria-label="فتح الصف في Google Sheets"
            >
              <Sheet className="size-4" />
            </a>
          ) : null}
          {!isNew && user.can("admin") ? (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-danger-soft hover:text-danger"
              title="حذف الفكرة"
              aria-label="حذف الفكرة"
            >
              <Trash2 className="size-4" />
            </button>
          ) : null}
          <DialogClose className="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface-3 hover:text-ink" aria-label="إغلاق">
            <X className="size-4" />
          </DialogClose>
        </div>
      }
    >
      <div className="scrollbar-thin flex-1 overflow-y-auto" onKeyDown={onKeyDown}>
        {conflict ? (
          <div className="m-4 rounded-xl border border-[var(--review)]/30 bg-[var(--review-soft)] p-4 text-sm">
            <p className="font-semibold text-[var(--review)]">تم تعديل هذه الفكرة في الجدول بعد فتحها</p>
            <p className="mt-1 text-ink-2">لم يتم حفظ تعديلاتك. حمّل النسخة الحالية ثم أعد تطبيق تعديلاتك.</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                setValues(fromIdea(conflict));
                setConflict(null);
              }}
            >
              تحميل النسخة الحالية
            </Button>
          </div>
        ) : null}

        <div className="px-6 pt-6 pb-2">
          <textarea
            ref={titleRef}
            value={values.title}
            onChange={(e) => set("title", e.target.value.replace(/\n/g, " "))}
            placeholder="عنوان الفكرة"
            rows={1}
            readOnly={readOnly}
            autoFocus={isNew}
            aria-label="الفكرة"
            aria-invalid={!!errors.title}
            className="field-sizing-content w-full resize-none bg-transparent text-[22px] leading-snug font-bold tracking-tight text-ink placeholder:text-faint focus:outline-none"
          />
          {errors.title ? <p className="text-xs text-danger">{errors.title}</p> : null}
        </div>

        <div className="flex flex-col gap-1 px-4 pb-4">
          <Property label="حالة التنفيذ" htmlFor="f-status">{picker("status")}</Property>
          <Property label="الأولوية" htmlFor="f-priority">{picker("priority")}</Property>
          <Property label="المنصة" htmlFor="f-platform">{picker("platform")}</Property>
          <Property label="المسؤول" htmlFor="f-owner">{picker("owner")}</Property>
          <Property label="الموعد المستهدف" htmlFor="f-date">
            <input
              id="f-date"
              type="date"
              value={values.targetDate}
              onChange={(e) => set("targetDate", e.target.value)}
              disabled={readOnly || missing.has("targetDate")}
              className="h-9 w-full rounded-[10px] border border-transparent bg-transparent px-2 text-sm text-ink transition hover:border-border hover:bg-surface-2 focus:border-accent focus:outline-none disabled:opacity-60"
            />
            {idea && idea.targetDate && !idea.targetDateIso ? (
              <p className="mt-1 px-2 text-xs text-[var(--review)]">القيمة الحالية في الجدول «{idea.targetDate}» ليست تاريخًا صالحًا.</p>
            ) : null}
          </Property>
        </div>

        <div className="flex flex-col gap-5 border-t border-border px-6 py-5">
          <div>
            <label htmlFor="f-url" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              رابط المرجع
            </label>
            <div className="relative">
              <Link2 className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-faint" />
              <Input
                id="f-url"
                dir="ltr"
                inputMode="url"
                value={values.referenceUrl}
                onChange={(e) => set("referenceUrl", e.target.value)}
                placeholder="https://www.tiktok.com/@…"
                readOnly={readOnly}
                className="pr-9 text-left"
                aria-invalid={!!errors.referenceUrl}
              />
            </div>
            {errors.referenceUrl ? <p className="mt-1 text-xs text-danger">{errors.referenceUrl}</p> : null}
            {host && !errors.referenceUrl ? (
              <a
                href={values.referenceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-2 flex items-center gap-3 rounded-xl border border-border bg-surface-2 p-3 transition hover:border-border-strong"
              >
                <span className="grid size-9 place-items-center rounded-lg bg-surface text-muted shadow-sm">
                  <ExternalLink className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-ink">{host}</span>
                  <span className="ltr block truncate text-xs text-muted">{values.referenceUrl}</span>
                </span>
              </a>
            ) : null}
          </div>

          <div>
            <label htmlFor="f-desc" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              وصف مختصر
            </label>
            <Textarea
              id="f-desc"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="ما الفكرة؟ ما الزاوية أو الترند؟"
              readOnly={readOnly}
              className="field-sizing-content min-h-24"
            />
          </div>

          <div>
            <label htmlFor="f-notes" className="mb-1.5 block text-[13px] font-medium text-ink-2">
              ملاحظات
            </label>
            <Textarea
              id="f-notes"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="تفاصيل التصوير، الموقع، المتطلبات…"
              readOnly={readOnly}
              disabled={missing.has("notes")}
              className="field-sizing-content min-h-20"
            />
          </div>
        </div>
      </div>

      {canEdit ? (
        <footer className="flex shrink-0 items-center gap-2 border-t border-border bg-surface-2/60 px-4 py-3 sm:rounded-b-2xl">
          <p className="hidden flex-1 items-center gap-1.5 text-xs text-muted sm:flex">
            {saving ? (
              <>
                <Loader2 className="size-3.5 animate-spin" /> جارٍ الحفظ في الجدول…
              </>
            ) : dirty ? (
              <>
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd> للحفظ
              </>
            ) : (
              "لا توجد تعديلات"
            )}
          </p>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="ms-auto sm:ms-0">
            إلغاء
          </Button>
          <Button variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
            {isNew ? "إضافة الفكرة" : "حفظ التعديلات"}
          </Button>
        </footer>
      ) : (
        <footer className="border-t border-border px-6 py-3 text-xs text-muted">عرض فقط — صلاحيتك لا تسمح بالتعديل.</footer>
      )}

      {idea ? (
        <Modal
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="حذف الفكرة؟"
          description={
            <>
              سيتم مسح قيم «{idea.title}» من الصف {idea.row}. يبقى الصف وقوائمه المنسدلة، ويمكن استعادة القيم من سجل إصدارات Google
              Sheets.
            </>
          }
        >
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(
                  { companyId: company.id, idea },
                  {
                    onSuccess: () => {
                      setConfirmDelete(false);
                      onOpenChange(false);
                    },
                  },
                )
              }
            >
              حذف
            </Button>
          </div>
        </Modal>
      ) : null}
    </SidePanel>
  );
}
