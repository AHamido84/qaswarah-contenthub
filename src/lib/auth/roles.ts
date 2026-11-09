export type Role = "admin" | "editor" | "viewer";

const RANK: Record<Role, number> = { viewer: 0, editor: 1, admin: 2 };

export const ROLE_LABEL: Record<Role, string> = { admin: "مدير", editor: "محرر", viewer: "مشاهد" };

export function hasRole(role: Role | undefined, needed: Role): boolean {
  return !!role && RANK[role] >= RANK[needed];
}

const list = (v: string | undefined) =>
  (v ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

/** Resolves a Google account to a role from the env allowlists; null = not allowed in. */
export function roleForEmail(email: string | null | undefined): Role | null {
  if (!email) return null;
  const e = email.toLowerCase();
  if (list(process.env.ADMIN_EMAILS).includes(e)) return "admin";
  if (list(process.env.EDITOR_EMAILS).includes(e)) return "editor";
  if (list(process.env.VIEWER_EMAILS).includes(e)) return "viewer";
  const domain = process.env.VIEWER_DOMAIN?.trim().toLowerCase();
  if (domain && e.endsWith(`@${domain}`)) return "viewer";
  return null;
}
