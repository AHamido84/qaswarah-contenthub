"use client";

import { formatDistanceToNowStrict } from "date-fns";
import { arSA } from "date-fns/locale";
import {
  Building2,
  LayoutGrid,
  LogOut,
  Menu,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  X,
} from "lucide-react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useRefresh, useWorkbook } from "@/hooks/use-hub";
import { ROLE_LABEL } from "@/lib/auth/roles";
import { cn } from "@/lib/cn";
import { stageOf } from "@/lib/domain";
import { Avatar } from "./chips";
import { CommandPalette } from "./command-palette";
import { CreateCompanyDialog } from "./create-company-dialog";
import { LogoMark } from "./logo";
import { useUser } from "./providers";
import { ThemeToggle } from "./theme-toggle";
import { Kbd } from "./ui";

function NavItem({
  href,
  icon,
  children,
  badge,
  active,
  onNavigate,
}: {
  href: string;
  icon: ReactNode;
  children: ReactNode;
  badge?: ReactNode;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13.5px] transition",
        active ? "bg-white/[0.08] text-rail-ink" : "text-rail-muted hover:bg-white/[0.04] hover:text-rail-ink",
      )}
    >
      {active ? <span className="absolute inset-y-2 -right-3 w-[3px] rounded-l-full bg-[#c9a46a]" /> : null}
      <span className="grid size-5 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {badge}
    </Link>
  );
}

function SyncStatus() {
  const { data, isFetching, isError } = useWorkbook();
  const refresh = useRefresh();
  const [busy, setBusy] = useState(false);
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 15_000);
    return () => clearInterval(t);
  }, []);

  const label = isError
    ? "تعذر الاتصال بالجدول"
    : data
      ? `تمت المزامنة ${formatDistanceToNowStrict(new Date(data.fetchedAt), { locale: arSA, addSuffix: true })}`
      : "جارٍ التحميل…";

  return (
    <button
      type="button"
      onClick={async () => {
        setBusy(true);
        try {
          await refresh();
          toast.success("تم تحديث البيانات من الجدول");
        } catch {
          toast.error("تعذر التحديث");
        } finally {
          setBusy(false);
        }
      }}
      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs text-rail-muted transition hover:bg-white/[0.04] hover:text-rail-ink"
      title="تحديث الآن من Google Sheets"
    >
      <span className={cn("size-1.5 rounded-full", isError ? "bg-red-400" : "bg-emerald-400")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <RefreshCw className={cn("size-3.5", (busy || isFetching) && "animate-spin")} />
    </button>
  );
}

function Sidebar({ onNavigate, onSearch, onNewCompany }: { onNavigate?: () => void; onSearch: () => void; onNewCompany: () => void }) {
  const pathname = usePathname();
  const user = useUser();
  const { data, isLoading } = useWorkbook();
  const issueCount = data?.companies.reduce((n, c) => n + c.issues.filter((i) => i.severity !== "info").length, 0) ?? 0;

  return (
    <div className="flex h-full flex-col border-s border-white/[0.06] bg-rail px-3 pt-4 pb-3 text-rail-ink">
      <div className="flex items-center gap-2.5 px-1.5 pb-5">
        <LogoMark className="size-8 rounded-[10px] text-[17px]" />
        <div className="min-w-0 leading-tight">
          <p className="text-[14px] font-semibold">منصة المحتوى</p>
          <p className="text-[11px] text-rail-muted">قسورة القابضة</p>
        </div>
      </div>

      <button
        type="button"
        onClick={onSearch}
        className="mb-4 flex h-9 items-center gap-2 rounded-[10px] border border-white/[0.08] bg-white/[0.03] px-2.5 text-[13px] text-rail-muted transition hover:border-white/[0.14] hover:text-rail-ink"
      >
        <Search className="size-4" />
        <span className="flex-1 text-start">بحث في الأفكار</span>
        <Kbd className="border-white/10 bg-white/5 text-rail-muted">⌘K</Kbd>
      </button>

      <nav className="flex flex-col gap-0.5" aria-label="التنقل الرئيسي">
        <NavItem href="/" icon={<LayoutGrid className="size-4" />} active={pathname === "/"} onNavigate={onNavigate}>
          نظرة عامة
        </NavItem>
      </nav>

      <div className="mt-6 mb-1.5 flex items-center justify-between px-2.5">
        <span className="text-[11px] font-semibold tracking-wide text-rail-muted">الشركات</span>
        {user.can("admin") ? (
          <button
            type="button"
            onClick={onNewCompany}
            className="grid size-6 place-items-center rounded-md text-rail-muted transition hover:bg-white/10 hover:text-rail-ink"
            aria-label="إضافة شركة"
            title="إضافة شركة"
          >
            <Plus className="size-3.5" />
          </button>
        ) : null}
      </div>
      <nav className="scrollbar-thin -mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1" aria-label="الشركات">
        {isLoading
          ? Array.from({ length: 2 }, (_, i) => <div key={i} className="mx-2.5 my-2 h-4 rounded bg-white/[0.06]" />)
          : data?.companies.map((c) => {
              const open = c.ideas.filter((i) => stageOf(i.status) !== "done").length;
              return (
                <NavItem
                  key={c.id}
                  href={`/companies/${c.id}`}
                  icon={<Building2 className="size-4" />}
                  active={pathname === `/companies/${c.id}`}
                  onNavigate={onNavigate}
                  badge={<span className="text-[11px] tabular-nums text-rail-muted">{open}</span>}
                >
                  {c.name}
                </NavItem>
              );
            })}
      </nav>

      <div className="mt-3 flex flex-col gap-0.5 border-t border-white/[0.06] pt-3">
        <NavItem
          href="/health"
          icon={<ShieldAlert className="size-4" />}
          active={pathname === "/health"}
          onNavigate={onNavigate}
          badge={
            issueCount ? (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-[#c9a46a]/20 px-1.5 text-[11px] font-semibold text-[#e0bd84]">
                {issueCount}
              </span>
            ) : null
          }
        >
          صحة البيانات
        </NavItem>
        <SyncStatus />
        {data?.source === "demo" ? (
          <p className="mx-2.5 mt-1 rounded-md bg-[#c9a46a]/10 px-2 py-1 text-[11px] text-[#e0bd84]">بيانات تجريبية</p>
        ) : null}
      </div>

      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2">
        <Avatar name={user.name || user.email} size={32} className="ring-0" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-[13px] font-medium">{user.name || user.email}</p>
          <p className="text-[11px] text-rail-muted">{ROLE_LABEL[user.role]}</p>
        </div>
        <ThemeToggle className="text-rail-muted hover:text-rail-ink" />
        <button
          type="button"
          onClick={() => void signOut({ callbackUrl: "/signin" })}
          className="grid size-8 place-items-center rounded-lg text-rail-muted transition hover:bg-white/10 hover:text-rail-ink"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
        >
          <LogOut className="size-4" />
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setMobileOpen(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const sidebar = (
    <Sidebar
      onNavigate={() => setMobileOpen(false)}
      onSearch={() => setPaletteOpen(true)}
      onNewCompany={() => setCompanyOpen(true)}
    />
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="sticky top-0 hidden h-dvh lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 right-0 w-[280px] shadow-lg">{sidebar}</div>
          <button
            className="absolute top-3 left-3 grid size-9 place-items-center rounded-lg bg-surface text-ink shadow-md"
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق القائمة"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-lg text-ink hover:bg-surface-3"
            aria-label="فتح القائمة"
          >
            <Menu className="size-5" />
          </button>
          <LogoMark className="size-7 rounded-lg text-[15px]" />
          <span className="text-sm font-semibold">منصة المحتوى</span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="ms-auto grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-3"
            aria-label="بحث"
          >
            <Search className="size-[18px]" />
          </button>
        </header>
        <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-10 lg:py-9">{children}</main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <CreateCompanyDialog open={companyOpen} onOpenChange={setCompanyOpen} />
    </div>
  );
}
