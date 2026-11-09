import { handler, json } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { loadWorkbook } from "@/lib/hub";

export const dynamic = "force-dynamic";

export const GET = handler(async (req: Request) => {
  await requireRole("viewer");
  const fresh = new URL(req.url).searchParams.get("fresh") === "1";
  return json(await loadWorkbook({ fresh }));
});
