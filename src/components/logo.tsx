import { cn } from "@/lib/cn";

/** Monogram: a stylised «ق» set in a brass square. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 place-items-center rounded-[11px] bg-gradient-to-br from-[#c9a46a] to-[#8a6a36] text-[19px] font-bold text-[#16130d] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_6px_16px_-6px_rgb(148_116_63/0.6)]",
        className,
      )}
      aria-hidden
    >
      ق
    </span>
  );
}
