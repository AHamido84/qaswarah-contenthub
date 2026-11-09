import "server-only";
import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { roleForEmail, type Role } from "./roles";

/** Env values pasted into dashboards often carry stray spaces, newlines or quotes. */
export const cleanEnv = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "").trim();

/** Why Google sign-in cannot work with the current settings, or null when it can. */
export function googleAuthProblem(): string | null {
  const id = cleanEnv(process.env.GOOGLE_CLIENT_ID);
  const secret = cleanEnv(process.env.GOOGLE_CLIENT_SECRET);
  if (!id) return "GOOGLE_CLIENT_ID غير مضبوط في إعدادات الخادم.";
  if (/REPLACE|\s/.test(id) || !id.endsWith(".apps.googleusercontent.com")) {
    return "قيمة GOOGLE_CLIENT_ID غير صحيحة؛ يجب أن تنتهي بـ .apps.googleusercontent.com.";
  }
  if (!secret || /REPLACE/.test(secret)) return "GOOGLE_CLIENT_SECRET غير مضبوط في إعدادات الخادم.";
  if (!cleanEnv(process.env.NEXTAUTH_SECRET)) return "NEXTAUTH_SECRET غير مضبوط في إعدادات الخادم.";
  return null;
}

export const isDemoAuth = () =>
  process.env.AUTH_MODE === "demo" &&
  (process.env.NODE_ENV !== "production" || process.env.ALLOW_DEMO_AUTH_IN_PRODUCTION === "true");

const DEMO_USERS: Record<Role, { name: string; email: string }> = {
  admin: { name: "مدير تجريبي", email: "admin@demo.local" },
  editor: { name: "Najd Bandar", email: "editor@demo.local" },
  viewer: { name: "مشاهد تجريبي", email: "viewer@demo.local" },
};

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET ?? (isDemoAuth() ? "demo-only-secret-not-for-production" : undefined),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/signin", error: "/signin" },
  providers: isDemoAuth()
    ? [
        CredentialsProvider({
          id: "demo",
          name: "Demo",
          credentials: { role: { type: "text" } },
          authorize(credentials) {
            const role = credentials?.role as Role | undefined;
            if (!role || !(role in DEMO_USERS)) return null;
            return { id: role, ...DEMO_USERS[role] };
          },
        }),
      ]
    : [
        GoogleProvider({
          clientId: cleanEnv(process.env.GOOGLE_CLIENT_ID),
          clientSecret: cleanEnv(process.env.GOOGLE_CLIENT_SECRET),
          authorization: { params: { prompt: "select_account" } },
        }),
      ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === "demo") return true;
      const verified = (profile as { email_verified?: boolean } | undefined)?.email_verified;
      if (verified === false) return false;
      return roleForEmail(user.email) ? true : "/signin?error=AccessDenied";
    },
    async jwt({ token, user, account }) {
      if (account) token.provider = account.provider;
      if (token.provider === "demo") {
        if (!isDemoAuth()) token.role = undefined;
        else if (user?.id && user.id in DEMO_USERS) token.role = user.id as Role;
        return token;
      }
      // Google users are re-checked on every request so allowlist changes apply immediately.
      token.role = roleForEmail(token.email) ?? undefined;
      return token;
    },
    async session({ session, token }) {
      if (!token.role) return { ...session, user: undefined } as never;
      session.user = {
        name: token.name,
        email: token.email ?? "",
        image: token.picture,
        role: token.role,
      };
      return session;
    },
  },
};
