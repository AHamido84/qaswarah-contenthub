"use client";

import * as P from "@radix-ui/react-popover";
import { Command } from "cmdk";
import { Check, ChevronDown, Plus, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface OptionPickerProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
  /** Free text allowed (only when the sheet's dropdown is not strict). */
  allowCustom?: boolean;
  allowClear?: boolean;
  renderValue?: (value: string) => ReactNode;
  renderOption?: (value: string) => ReactNode;
  trigger?: ReactNode;
  disabled?: boolean;
  id?: string;
  align?: "start" | "end" | "center";
  className?: string;
}

export function OptionPicker({
  value,
  options,
  onChange,
  placeholder = "اختر…",
  allowCustom,
  allowClear = true,
  renderValue,
  renderOption,
  trigger,
  disabled,
  id,
  align = "start",
  className,
}: OptionPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };
  const showCustom = allowCustom && search.trim() && !options.some((o) => o === search.trim());

  return (
    <P.Root open={open} onOpenChange={setOpen}>
      <P.Trigger asChild disabled={disabled}>
        {trigger ?? (
          <button
            id={id}
            type="button"
            className={cn(
              "flex h-10 w-full items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-start text-sm transition hover:border-border-strong focus:border-accent focus:ring-4 focus:ring-[var(--ring)] focus:outline-none disabled:opacity-60 data-[state=open]:border-accent",
              className,
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {value ? (renderValue ? renderValue(value) : value) : <span className="text-faint">{placeholder}</span>}
            </span>
            <ChevronDown className="size-4 shrink-0 text-faint" />
          </button>
        )}
      </P.Trigger>
      <P.Portal>
        <P.Content
          align={align}
          sideOffset={6}
          dir="rtl"
          className="animate-pop-in z-[60] w-[var(--radix-popover-trigger-width)] min-w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <Command>
            {options.length > 6 || allowCustom ? (
              <Command.Input
                value={search}
                onValueChange={setSearch}
                placeholder={allowCustom ? "ابحث أو أضف…" : "ابحث…"}
                className="h-10 w-full border-b border-border bg-transparent px-3 text-sm focus:outline-none"
              />
            ) : null}
            <Command.List className="scrollbar-thin max-h-64 overflow-y-auto p-1">
              <Command.Empty className="px-3 py-4 text-center text-xs text-muted">لا توجد خيارات</Command.Empty>
              {options.map((o) => (
                <Command.Item
                  key={o}
                  value={o}
                  onSelect={() => pick(o)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-ink-2 data-[selected=true]:bg-surface-3 data-[selected=true]:text-ink"
                >
                  <span className="min-w-0 flex-1 truncate">{renderOption ? renderOption(o) : o}</span>
                  {o === value ? <Check className="size-4 text-accent" /> : null}
                </Command.Item>
              ))}
              {showCustom ? (
                <Command.Item
                  value={`__custom ${search}`}
                  onSelect={() => pick(search.trim())}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-accent data-[selected=true]:bg-accent-soft"
                >
                  <Plus className="size-4" /> استخدام «{search.trim()}»
                </Command.Item>
              ) : null}
              {allowClear && value ? (
                <Command.Item
                  value="__clear"
                  onSelect={() => pick("")}
                  className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border-t border-border px-2.5 py-2 text-sm text-muted data-[selected=true]:bg-surface-3"
                >
                  <X className="size-4" /> مسح القيمة
                </Command.Item>
              ) : null}
            </Command.List>
          </Command>
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
