import "server-only";
import { getServerSession } from "next-auth";
import { HubError } from "@/lib/hub";
import { authOptions } from "./options";
import { hasRole, type Role } from "./roles";

export async function currentUser() {
  const session = await getServerSession(authOptions);
  return session?.user?.role ? session.user : null;
}

export async function requireRole(role: Role) {
  const user = await currentUser();
  if (!user) throw new HubError(401, "unauthenticated", "يجب تسجيل الدخول.");
  if (!hasRole(user.role, role)) throw new HubError(403, "forbidden", "لا تملك صلاحية لهذه العملية.");
  return user;
}
