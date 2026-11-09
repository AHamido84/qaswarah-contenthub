"use client";

import { ShieldCheck, PenLine, Eye } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { Button } from "@/components/ui";

const ROLES = [
  { role: "admin", label: "مدير", desc: "كل الصلاحيات: إضافة شركات وإصلاح البيانات", icon: ShieldCheck },
  { role: "editor", label: "محرر", desc: "إضافة الأفكار وتعديلها", icon: PenLine },
  { role: "viewer", label: "مشاهد", desc: "عرض فقط", icon: Eye },
] as const;

export function SignInButtons({ demo }: { demo: boolean }) {
  const [pending, setPending] = useState<string | null>(null);

  if (demo) {
    return (
      <div className="flex flex-col gap-2.5">
        {ROLES.map(({ role, label, desc, icon: Icon }) => (
          <button
            key={role}
            disabled={!!pending}
            onClick={() => {
              setPending(role);
              void signIn("demo", { role, callbackUrl: "/" });
            }}
            className="group flex items-center gap-3.5 rounded-xl border border-border bg-surface p-3.5 text-start shadow-sm transition hover:border-accent hover:shadow-md disabled:opacity-60"
          >
            <span className="grid size-10 place-items-center rounded-[10px] bg-accent-soft text-accent">
              <Icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="block text-xs text-muted">{desc}</span>
            </span>
            {pending === role ? <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" /> : null}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      className="w-full"
      loading={!!pending}
      onClick={() => {
        setPending("google");
        void signIn("google", { callbackUrl: "/" });
      }}
    >
      <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden>
        <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.6 2.3 2.3 6.6 2.3 12s4.3 9.7 9.7 9.7c5.6 0 9.3-3.9 9.3-9.5 0-.6-.1-1.1-.2-1.6H12z" />
      </svg>
      المتابعة باستخدام Google
    </Button>
  );
}
