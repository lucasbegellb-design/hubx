import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/lib/supabase";

export function useDomaines() {
  return useQuery({
    queryKey: ["domaines"],
    queryFn: async () => {
      const { data, error } = await supabase.from("domaines").select("*").order("ordre").order("nom");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

export function useProjets() {
  return useQuery({
    queryKey: ["projets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projets").select("*").order("statut").order("nom");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

export function useMembres() {
  return useQuery({
    queryKey: ["membres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membres").select("*").order("nom");
      if (error) throw error;
      return data;
    },
    staleTime: 10 * 60_000,
  });
}

/** Dictionnaires id → objet pour l'affichage. */
export function useReferentiels() {
  const d = useDomaines();
  const p = useProjets();
  const m = useMembres();
  return useMemo(() => {
    const domaines = new Map((d.data ?? []).map((x) => [x.id, x]));
    const projets = new Map((p.data ?? []).map((x) => [x.id, x]));
    const membres = new Map((m.data ?? []).map((x) => [x.user_id, x]));
    return {
      domaines,
      projets,
      membres,
      listeDomaines: d.data ?? [],
      listeProjets: p.data ?? [],
      projetsActifs: (p.data ?? []).filter((x) => x.statut === "actif"),
      listeMembres: m.data ?? [],
      nomMembre: (userId: string | null | undefined) => (userId ? (membres.get(userId)?.nom ?? "Ancien membre") : ""),
      charge: d.isSuccess && p.isSuccess && m.isSuccess,
    };
  }, [d.data, p.data, m.data, d.isSuccess, p.isSuccess, m.isSuccess]);
}
