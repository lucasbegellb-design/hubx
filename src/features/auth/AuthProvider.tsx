import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Membre } from "@/lib/types";
import { queryClient } from "@/lib/queryClient";

interface AuthContexte {
  session: Session | null;
  sessionChargee: boolean;
  membre: Membre | null;
  membreCharge: boolean;
  estAdmin: boolean;
  /** Ouverture précédente de l'app (« ce qui a changé depuis »). */
  ouverturePrecedente: string | null;
  userId: string;
}

const Ctx = createContext<AuthContexte | null>(null);

export function AuthProvider({ children, marquerOuverture }: { children: ReactNode; marquerOuverture: boolean }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionChargee, setSessionChargee] = useState(false);
  const [ouverturePrecedente, setOuverturePrecedente] = useState<string | null>(null);
  const ouvertureMarquee = useRef(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionChargee(true);
    });
    const { data } = supabase.auth.onAuthStateChange((evt, s) => {
      setSession(s);
      if (evt === "SIGNED_OUT") queryClient.clear();
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? "";
  const membreQ = useQuery({
    queryKey: ["membres", "moi", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("membres").select("*").eq("user_id", userId).maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60_000,
  });

  const membre = membreQ.data ?? null;
  useEffect(() => {
    if (!membre || !marquerOuverture || ouvertureMarquee.current) return;
    ouvertureMarquee.current = true;
    supabase.rpc("marquer_ouverture").then(({ data }) => setOuverturePrecedente((data as string | null) ?? null));
  }, [membre, marquerOuverture]);

  return (
    <Ctx.Provider
      value={{
        session,
        sessionChargee,
        membre,
        membreCharge: !userId || membreQ.isFetched,
        estAdmin: membre?.role === "admin",
        ouverturePrecedente,
        userId,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthContexte {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth hors AuthProvider");
  return c;
}
