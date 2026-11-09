import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <p className="text-sm font-medium text-accent">404</p>
        <h1 className="mt-2 text-2xl font-bold">الصفحة غير موجودة</h1>
        <Link href="/" className="mt-6 inline-block text-sm font-medium text-accent hover:underline">
          العودة للرئيسية
        </Link>
      </div>
    </main>
  );
}
