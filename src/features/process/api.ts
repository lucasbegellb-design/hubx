import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/** Liste légère des process (sans contenu). */
export function useProcessListe() {
  return useQuery({
    queryKey: ["process", "liste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process")
        .select("id, titre, domaine_id, statut, responsable, updated_at, modifie_par, created_at")
        .is("deleted_at", null)
        .order("titre");
      if (error) throw error;
      return data;
    },
  });
}
