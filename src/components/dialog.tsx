"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-50 bg-black/30 backdrop-blur-[2px]" />
        <D.Content
          dir="rtl"
          className={cn(
            "animate-pop-in fixed top-[12vh] left-1/2 z-50 max-h-[80vh] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 overflow-y-auto rounded-2xl border border-border bg-surface p-6 shadow-lg focus:outline-none",
            className,
          )}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <D.Title className="text-lg font-semibold">{title}</D.Title>
              {description ? <D.Description className="mt-1 text-sm text-muted">{description}</D.Description> : null}
            </div>
            <D.Close className="grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-3 hover:text-ink" aria-label="إغلاق">
              <X className="size-4" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Side panel that slides in from the left (the trailing edge in RTL). */
export function SidePanel({
  open,
  onOpenChange,
  title,
  children,
  header,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  header?: ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="animate-fade-in fixed inset-0 z-40 bg-black/20" />
        <D.Content
          dir="rtl"
          aria-describedby={undefined}
          className="animate-sheet-in fixed inset-y-0 left-0 z-50 flex w-full max-w-[560px] flex-col border-e border-border bg-surface shadow-lg focus:outline-none sm:inset-y-2 sm:left-2 sm:rounded-2xl sm:border"
        >
          <D.Title className="sr-only">{title}</D.Title>
          {header}
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export const DialogClose = D.Close;
