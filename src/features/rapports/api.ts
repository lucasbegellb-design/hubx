import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DonneesRapport } from "@shared/rapport.ts";
import { appelerFonction } from "@/lib/fonctions";
import { supabase } from "@/lib/supabase";
import { verifierEcriture } from "@/hooks/useEcriture";

export function useRapports() {
  return useQuery({
    queryKey: ["rapports", "liste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rapports")
        .select("id, type, periode_debut, periode_fin, filtres, statut, erreur, genere_par, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw error;
      return data;
    },
  });
}

export function useRapport(id: string | null) {
  return useQuery({
    queryKey: ["rapports", "detail", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("rapports").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data ? { ...data, d: data.statut === "pret" ? (data.donnees as unknown as DonneesRapport) : null } : null;
    },
  });
}

export function useGenererRapport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      periode_debut: string;
      periode_fin: string;
      filtres: { domaines: string[]; projets: string[] };
    }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      return appelerFonction<{ ok: boolean; id: string }>("generate-report", { type: "demande", ...p });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["rapports"] }),
    onError: () => undefined,
  });
}

export function useSupprimerRapport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { error } = await supabase.from("rapports").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rapports"] }),
  });
}
