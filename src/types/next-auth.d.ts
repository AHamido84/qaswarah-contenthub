import type { Role } from "@/lib/auth/roles";

declare module "next-auth" {
  interface Session {
    user: { name?: string | null; email: string; image?: string | null; role: Role };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    provider?: string;
  }
}
