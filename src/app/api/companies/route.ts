import { handler, json } from "@/lib/api";
import { requireRole } from "@/lib/auth/session";
import { createCompany } from "@/lib/hub";
import { companyInputSchema } from "@/lib/validation";

export const POST = handler(async (req: Request) => {
  const user = await requireRole("admin");
  const { name } = companyInputSchema.parse(await req.json());
  return json(await createCompany(name, user), { status: 201 });
});
