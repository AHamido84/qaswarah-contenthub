import { handler, json, parseId } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { applyDuplicateFix, planHash, previewDuplicateFix } from "@/lib/hub";
import { duplicateFixSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string }> };

/** Read-only: what the fix would do. Nothing in the sheet changes. */
export const GET = handler(async (_req: Request, ctx: Ctx) => {
  await requireRole("admin");
  const plan = await previewDuplicateFix(parseId((await ctx.params).id));
  return json({ plan, planHash: planHash(plan) });
});

/** Applies the reviewed plan. Requires the company name typed back and the plan's hash. */
export const POST = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireRole("admin");
  const { confirmName, planHash: hash } = duplicateFixSchema.parse(await req.json());
  return json(await applyDuplicateFix(parseId((await ctx.params).id), confirmName, hash, user));
});
