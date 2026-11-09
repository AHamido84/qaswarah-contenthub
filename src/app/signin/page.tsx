import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { isDemoAuth } from "@/lib/auth/options";
import { currentUser } from "@/lib/auth/session";
import { SignInButtons } from "./sign-in-buttons";

export const metadata = { title: "تسجيل الدخول" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;
  const demo = isDemoAuth();

  return (
    <main className="relative grid min-h-dvh lg:grid-cols-[1fr_minmax(420px,520px)]">
      <section className="relative hidden overflow-hidden bg-rail text-rail-ink lg:block">
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            background:
              "radial-gradient(60% 50% at 70% 30%, rgb(201 164 106 / 0.22), transparent 70%), radial-gradient(40% 40% at 20% 80%, rgb(201 164 106 / 0.10), transparent 70%)",
          }}
        />
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "linear-gradient(rgb(255 255 255) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255) 1px, transparent 1px)", backgroundSize: "48px 48px" }} />
        <div className="relative flex h-full flex-col justify-between p-14">
          <div className="flex items-center gap-3">
            <LogoMark />
            <span className="text-[15px] font-semibold">قسورة القابضة</span>
          </div>
          <div className="max-w-lg">
            <p className="mb-4 text-sm font-medium tracking-wide text-[#c9a46a]">منصة المحتوى</p>
            <h1 className="text-[44px] leading-[1.15] font-bold tracking-tight">
              من الفكرة
              <br />
              إلى النشر، في مكان واحد.
            </h1>
            <p className="mt-5 text-[17px] leading-relaxed text-rail-muted">
              خطط لأفكار المحتوى لكل شركات المجموعة، تابع التنفيذ والمواعيد، وابقَ متزامنًا مع جدول Google مباشرة.
            </p>
          </div>
          <p className="text-xs text-rail-muted">© {new Date().getFullYear()} قسورة القابضة</p>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-rise">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <LogoMark />
            <span className="text-[15px] font-semibold">منصة المحتوى</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">تسجيل الدخول</h2>
          <p className="mt-2 text-sm text-muted">
            {demo ? "وضع التجربة: اختر دورًا لاستكشاف المنصة." : "استخدم حساب Google المعتمد لدى فريق المحتوى."}
          </p>
          {error ? (
            <div className="mt-6 rounded-xl border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
              {error === "AccessDenied"
                ? "هذا الحساب غير مصرح له بالدخول. تواصل مع مدير المنصة لإضافتك."
                : "تعذر تسجيل الدخول. حاول مرة أخرى."}
            </div>
          ) : null}
          <div className="mt-8">
            <SignInButtons demo={demo} />
          </div>
        </div>
      </section>
    </main>
  );
}
