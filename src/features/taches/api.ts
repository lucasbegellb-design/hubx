import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ajouterJours, aujourdhuiParis } from "@shared/dates.ts";
import { supabase } from "@/lib/supabase";
import type { Insertion, MiseAJour, Tache } from "@/lib/types";
import { verifierEcriture } from "@/hooks/useEcriture";

const CLE_LISTE = ["taches", "liste"] as const;

/** Tâches actives + tâches faites des 30 derniers jours. */
export function useTaches() {
  return useQuery({
    queryKey: CLE_LISTE,
    queryFn: async () => {
      const depuis = ajouterJours(aujourdhuiParis(), -30);
      const { data, error } = await supabase
        .from("taches")
        .select("*")
        .is("deleted_at", null)
        .or(`statut.neq.fait,done_at.gte.${depuis}`)
        .order("created_at", { ascending: true })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
}

/** Historique complet des tâches faites (filtre statut « Fait »). */
export function useTachesFaites(actif: boolean) {
  return useQuery({
    queryKey: ["taches", "faites"],
    enabled: actif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taches")
        .select("*")
        .is("deleted_at", null)
        .eq("statut", "fait")
        .order("done_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

function nettoyer(v: Partial<Tache>) {
  const { id: _i, created_at: _c, updated_at: _u, ...reste } = v;
  return reste;
}

export function useCreerTache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Insertion<"taches">) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { data, error } = await supabase.from("taches").insert(t).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (t) => {
      qc.setQueryData<Tache[]>(CLE_LISTE, (l) => (l && !l.some((x) => x.id === t.id) ? [...l, t] : l));
      qc.invalidateQueries({ queryKey: ["taches"] });
    },
  });
}

/** Mise à jour optimiste : la liste réagit immédiatement. */
export function useMajTache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...maj }: MiseAJour<"taches"> & { id: string }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { data, error } = await supabase.from("taches").update(nettoyer(maj)).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...maj }) => {
      await qc.cancelQueries({ queryKey: CLE_LISTE });
      const avant = qc.getQueryData<Tache[]>(CLE_LISTE);
      qc.setQueryData<Tache[]>(CLE_LISTE, (l) =>
        l?.map((t) =>
          t.id === id
            ? {
                ...t,
                ...maj,
                done_at:
                  maj.statut === "fait" && t.statut !== "fait"
                    ? new Date().toISOString()
                    : maj.statut && maj.statut !== "fait"
                      ? null
                      : t.done_at,
              }
            : t,
        ),
      );
      return { avant };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.avant) qc.setQueryData(CLE_LISTE, ctx.avant);
      if ((e as Error).message !== "hors-ligne") toast.error("Modification non enregistrée. Réessaie.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["taches"] }),
  });
}

export function useBasculerFait() {
  const maj = useMajTache();
  return (t: Tache) => {
    const fait = t.statut !== "fait";
    maj.mutate(
      { id: t.id, statut: fait ? "fait" : "a_faire" },
      {
        onSuccess: () =>
          toast.success(fait ? "Marquée faite" : "Rouverte", {
            action: { label: "Annuler", onClick: () => maj.mutate({ id: t.id, statut: t.statut }) },
          }),
      },
    );
  };
}

/** Suppression douce avec annulation. */
export function useSupprimerTache() {
  const maj = useMajTache();
  return (t: Tache) => {
    maj.mutate(
      { id: t.id, deleted_at: new Date().toISOString() },
      {
        onSuccess: () =>
          toast.success("Supprimée", {
            action: { label: "Annuler", onClick: () => maj.mutate({ id: t.id, deleted_at: null }) },
          }),
      },
    );
  };
}
