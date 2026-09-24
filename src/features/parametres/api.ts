import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appelerFonction } from "@/lib/fonctions";
import { supabase } from "@/lib/supabase";
import type { MiseAJour } from "@/lib/types";
import { verifierEcriture } from "@/hooks/useEcriture";

export function useParametres() {
  return useQuery({
    queryKey: ["parametres"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parametres").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useMajParametres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...maj }: MiseAJour<"parametres"> & { id: string }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { error } = await supabase.from("parametres").update(maj).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["parametres"] }),
  });
}

export function gererMembre(corps: Record<string, unknown>) {
  return appelerFonction<{ ok: boolean }>("manage-members", corps);
}

/** Écriture générique sur un référentiel (domaines / projets) avec invalidation. */
export function useEcrireReferentiel(table: "domaines" | "projets") {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (op: { type: "ajouter"; valeurs: Record<string, unknown> } | { type: "maj"; id: string; valeurs: Record<string, unknown> } | { type: "supprimer"; id: string }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const q = supabase.from(table);
      const { error } =
        op.type === "ajouter"
          ? await q.insert(op.valeurs as never)
          : op.type === "maj"
            ? await q.update(op.valeurs as never).eq("id", op.id)
            : await q.delete().eq("id", op.id);
      if (error) throw error;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: [table] }),
  });
}
