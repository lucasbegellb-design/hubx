import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Activité des autres membres depuis ma dernière ouverture. */
export function useChangementsDepuis(depuis: string | null, userId: string) {
  return useQuery({
    queryKey: ["aujourdhui", "journal", depuis, userId],
    enabled: Boolean(depuis),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_activite")
        .select("*")
        .gt("at", depuis!)
        .or(`user_id.neq.${userId},user_id.is.null`)
        .order("at", { ascending: false })
        .limit(60);
      if (error) throw error;
      // Une seule ligne par élément et par action (la plus récente)
      const vus = new Set<string>();
      return data.filter((j) => {
        const cle = `${j.entite_id}-${j.action}`;
        if (vus.has(cle)) return false;
        vus.add(cle);
        return true;
      });
    },
  });
}

export function useDernierRapport() {
  return useQuery({
    queryKey: ["rapports", "dernier"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rapports")
        .select("id, type, periode_debut, periode_fin, created_at, statut")
        .eq("statut", "pret")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useSnapshotsDepuis(depuis: string | null) {
  return useQuery({
    queryKey: ["chine_snapshots", "depuis", depuis],
    enabled: Boolean(depuis),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("chine_snapshots")
        .select("id", { count: "exact", head: true })
        .gt("taken_at", depuis!);
      if (error) throw error;
      return count ?? 0;
    },
  });
}
