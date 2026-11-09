"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCreateCompany, useWorkbook } from "@/hooks/use-hub";
import { FIELDS } from "@/lib/sheets/schema";
import { Modal } from "./dialog";
import { Button, Field, Input } from "./ui";

export function CreateCompanyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const create = useCreateCompany();
  const router = useRouter();
  const { data } = useWorkbook();
  const exists = data?.companies.some((c) => c.name.trim() === name.trim());
  const invalid = /[\[\]*?:/\\]/.test(name);

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setName("");
      }}
      title="إضافة شركة"
      description="ينشئ تبويبًا جديدًا في الجدول بنفس العناوين والقوائم المنسدلة."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate(name.trim(), {
            onSuccess: (res) => {
              onOpenChange(false);
              setName("");
              router.push(`/companies/${res.id}`);
            },
          });
        }}
        className="flex flex-col gap-5"
      >
        <Field
          label="اسم الشركة"
          htmlFor="company-name"
          required
          error={exists ? "يوجد تبويب بهذا الاسم" : invalid ? "لا يمكن استخدام [ ] * ? : / \\" : undefined}
          hint="سيظهر كاسم التبويب في Google Sheets."
        >
          <Input id="company-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="مثال: قسورة كابيتال" autoFocus maxLength={80} />
        </Field>
        <div className="rounded-xl border border-border bg-surface-2 p-3.5">
          <p className="mb-2 text-xs font-medium text-muted">الأعمدة (الصف 2، من B إلى J)</p>
          <div className="flex flex-wrap gap-1.5">
            {FIELDS.map((f) => (
              <span key={f.key} className="rounded-md border border-border bg-surface px-2 py-0.5 text-xs text-ink-2">
                {f.header}
              </span>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button type="submit" variant="primary" loading={create.isPending} disabled={name.trim().length < 2 || exists || invalid}>
            إنشاء التبويب
          </Button>
        </div>
      </form>
    </Modal>
  );
}
