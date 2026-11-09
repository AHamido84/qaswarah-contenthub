import { z } from "zod";
import { handler, json, parseId } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { deleteIdea, updateIdea } from "@/lib/hub";
import { ideaPatchSchema } from "@/lib/validation";

type Ctx = { params: Promise<{ id: string; row: string }> };

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireRole("editor");
  const p = await ctx.params;
  const { version, patch } = ideaPatchSchema.parse(await req.json());
  return json(await updateIdea(parseId(p.id), parseId(p.row, "row"), version, patch, user));
});

export const DELETE = handler(async (req: Request, ctx: Ctx) => {
  const user = await requireRole("admin");
  const p = await ctx.params;
  const { version } = z.object({ version: z.string().min(1) }).parse(await req.json());
  await deleteIdea(parseId(p.id), parseId(p.row, "row"), version, user);
  return json({ ok: true });
});
