import { useQueryClient } from "@tanstack/react-query";
import { createContext, use, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { refreshSession, setAccessToken, setSessionExpiredHandler } from "@/api/client";
import { authApi } from "@/api/endpoints";
import type { Me } from "@/api/mappers";
import { useMe } from "@/api/queries";

type Status = "restoring" | "authenticated" | "anonymous";

type Session = {
  status: Status;
  me: Me | undefined;
  can: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>("restoring");
  const meQuery = useMe(status === "authenticated");

  const endSession = useCallback(() => {
    setAccessToken(null);
    queryClient.clear();
    setStatus("anonymous");
  }, [queryClient]);

  useEffect(() => {
    setSessionExpiredHandler(() => {
      endSession();
      toast.info(t("auth.session_expired"));
    });
    // A reload keeps no token in memory: the HttpOnly refresh cookie restores the session, if any.
    refreshSession()
      .then(() => setStatus("authenticated"))
      .catch(() => setStatus("anonymous"));
  }, [endSession, t]);

  const login = useCallback(
    async (email: string, password: string) => {
      const tokens = await authApi.login({ email, password });
      setAccessToken(tokens.access_token);
      setStatus("authenticated");
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      endSession();
    }
  }, [endSession]);

  const value = useMemo<Session>(() => {
    const granted = new Set(meQuery.data?.permissions ?? []);
    return {
      status: status === "authenticated" && !meQuery.data && !meQuery.isError ? "restoring" : status,
      me: meQuery.data,
      can: (permission) => granted.has(permission),
      login,
      logout,
    };
  }, [status, meQuery.data, meQuery.isError, login, logout]);

  return <SessionContext value={value}>{children}</SessionContext>;
}

export function useSession(): Session {
  const session = use(SessionContext);
  if (!session) throw new Error("useSession must be used inside SessionProvider");
  return session;
}
