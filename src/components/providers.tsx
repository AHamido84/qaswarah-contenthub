"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import { Toaster } from "sonner";
import { hasRole, type Role } from "@/lib/auth/roles";

export interface SessionUser {
  name?: string | null;
  email: string;
  image?: string | null;
  role: Role;
}

const UserContext = createContext<SessionUser | null>(null);

export function useUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser outside provider");
  return { ...user, can: (role: Role) => hasRole(user.role, role) };
}

export function Providers({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 1, refetchOnReconnect: true } },
      }),
  );
  return (
    <UserContext.Provider value={user}>
      <QueryClientProvider client={client}>
        {children}
        <Toaster
          position="bottom-left"
          dir="rtl"
          toastOptions={{
            className: "!font-sans !rounded-xl !border-border !bg-surface !text-ink !shadow-lg",
            descriptionClassName: "!text-muted",
          }}
        />
      </QueryClientProvider>
    </UserContext.Provider>
  );
}
