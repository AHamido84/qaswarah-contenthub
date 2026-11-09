import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { HubError } from "@/lib/hub";

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

/** Wraps a route handler with consistent error responses. */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HubError) {
        return json({ error: { code: err.code, message: err.message, data: err.data } }, { status: err.status });
      }
      if (err instanceof ZodError) {
        const first = err.issues[0];
        return json(
          { error: { code: "invalid-input", message: first?.message ?? "مدخلات غير صالحة", data: { issues: err.issues } } },
          { status: 422 },
        );
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("[api]", err);
      // Google API errors carry a status; surface quota/permission problems clearly.
      const status = (err as { code?: number }).code;
      if (status === 403) {
        return json({ error: { code: "sheet-permission", message: "حساب الخدمة لا يملك صلاحية تعديل الجدول. شارك الجدول معه كمحرر." } }, { status: 502 });
      }
      if (status === 429) {
        return json({ error: { code: "rate-limited", message: "تم تجاوز حد طلبات Google مؤقتًا. حاول بعد دقيقة." } }, { status: 503 });
      }
      if (/data validation/i.test(message)) {
        return json({ error: { code: "invalid-option", message: "القيمة ليست ضمن خيارات القائمة المنسدلة في الجدول." } }, { status: 422 });
      }
      return json({ error: { code: "internal", message: "حدث خطأ غير متوقع أثناء الاتصال بالجدول." } }, { status: 500 });
    }
  };
}

export function parseId(value: string, label = "id"): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) throw new HubError(400, "bad-request", `${label} غير صالح`);
  return n;
}
