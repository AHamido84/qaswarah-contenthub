import { handler, json, parseId } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { createIdea } from "@/lib/hub";
import { ideaInputSchema } from "@/lib/validation";

export const POST = handler(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireRole("editor");
  const id = parseId((await ctx.params).id);
  const input = ideaInputSchema.parse(await req.json());
  return json(await createIdea(id, input, user), { status: 201 });
});
