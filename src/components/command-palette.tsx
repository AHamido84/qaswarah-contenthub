"use client";

import * as D from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Building2, CornerDownLeft, LayoutGrid, Lightbulb, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useWorkbook } from "@/hooks/use-hub";
import { StatusDot } from "./chips";
import { Kbd } from "./ui";

const itemCls =
  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink";

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const { data } = useWorkbook();
  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />
        <D.Content
          dir="rtl"
          aria-describedby={undefined}
          className="animate-pop-in fixed top-[14vh] left-1/2 z-50 w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
        >
          <D.Title className="sr-only">بحث</D.Title>
          <Command
            label="بحث"
            filter={(value, search) => (value.toLowerCase().includes(search.trim().toLowerCase()) ? 1 : 0)}
          >
            <Command.Input
              autoFocus
              placeholder="ابحث عن فكرة، مسؤول، أو شركة…"
              className="h-14 w-full border-b border-border bg-transparent px-5 text-[15px] text-ink placeholder:text-faint focus:outline-none"
            />
            <Command.List className="scrollbar-thin max-h-[52vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-10 text-center text-sm text-muted">لا توجد نتائج</Command.Empty>
              <Command.Group heading="انتقال" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint">
                <Command.Item value="نظرة عامة overview" onSelect={() => go("/")} className={itemCls}>
                  <LayoutGrid className="size-4 text-muted" /> نظرة عامة
                </Command.Item>
                {data?.companies.map((c) => (
                  <Command.Item key={c.id} value={`شركة ${c.name}`} onSelect={() => go(`/companies/${c.id}`)} className={itemCls}>
                    <Building2 className="size-4 text-muted" /> {c.name}
                    <span className="ms-auto text-xs text-faint">{c.ideas.length} فكرة</span>
                  </Command.Item>
                ))}
                <Command.Item value="صحة البيانات health" onSelect={() => go("/health")} className={itemCls}>
                  <ShieldAlert className="size-4 text-muted" /> صحة البيانات
                </Command.Item>
              </Command.Group>
              <Command.Group heading="الأفكار" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-faint">
                {data?.companies.flatMap((c) =>
                  c.ideas.map((i) => (
                    <Command.Item
                      key={`${c.id}-${i.row}`}
                      value={`${i.title} ${i.description} ${i.owner} ${i.platform} ${i.status} ${c.name} #${c.id}-${i.row}`}
                      onSelect={() => go(`/companies/${c.id}?idea=${i.row}`)}
                      className={itemCls}
                    >
                      <Lightbulb className="size-4 shrink-0 text-muted" />
                      <span className="min-w-0 flex-1 truncate">{i.title}</span>
                      <StatusDot status={i.status} />
                      <span className="shrink-0 text-xs text-faint">{c.name}</span>
                    </Command.Item>
                  )),
                )}
              </Command.Group>
            </Command.List>
            <div className="flex items-center gap-3 border-t border-border bg-surface-2 px-4 py-2 text-[11px] text-muted">
              <span className="flex items-center gap-1">
                <Kbd>
                  <CornerDownLeft className="size-3" />
                </Kbd>
                فتح
              </span>
              <span className="flex items-center gap-1">
                <Kbd>Esc</Kbd> إغلاق
              </span>
            </div>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
