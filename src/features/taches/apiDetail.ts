import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { toast } from "sonner";
import { verifierEcriture } from "@/hooks/useEcriture";
import { schemaCommentaire, schemaSousTache, valider } from "@/lib/schemas";
import { supabase } from "@/lib/supabase";
import type { Commentaire, SousTache } from "@/lib/types";

// Sous-tâches et commentaires : volumes faibles, chargés en une fois et regroupés par tâche côté client.

const CLE_ETAPES = ["sous_taches"] as const;
const CLE_COMMENTAIRES = ["commentaires"] as const;

function grouper<T extends { tache_id: string }>(lignes: T[] | undefined): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const l of lignes ?? []) m.set(l.tache_id, [...(m.get(l.tache_id) ?? []), l]);
  return m;
}

export function useSousTaches() {
  const q = useQuery({
    queryKey: CLE_ETAPES,
    queryFn: async () => {
      const { data, error } = await supabase.from("sous_taches").select("*").order("ordre").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  return useMemo(() => grouper(q.data), [q.data]);
}

type ActionEtape =
  | { type: "creer"; tache_id: string; titre: string; ordre: number }
  | { type: "maj"; id: string; titre?: string; fait?: boolean; ordre?: number }
  | { type: "supprimer"; id: string };

/** Écritures sur la checklist, avec mise à jour optimiste. */
export function useEcrireSousTache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: ActionEtape) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      if (a.type === "creer") {
        const { error } = await supabase
          .from("sous_taches")
          .insert({
            tache_id: a.tache_id,
            ...valider(schemaSousTache, { titre: a.titre, fait: false, ordre: a.ordre }, false),
          });
        if (error) throw error;
      } else if (a.type === "maj") {
        const { id, type: _t, ...champs } = a;
        const { error } = await supabase.from("sous_taches").update(valider(schemaSousTache, champs)).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sous_taches").delete().eq("id", a.id);
        if (error) throw error;
      }
    },
    onMutate: async (a) => {
      await qc.cancelQueries({ queryKey: CLE_ETAPES });
      const avant = qc.getQueryData<SousTache[]>(CLE_ETAPES);
      qc.setQueryData<SousTache[]>(CLE_ETAPES, (l = []) => {
        if (a.type === "creer") {
          const maintenant = new Date().toISOString();
          return [
            ...l,
            {
              id: `tmp-${crypto.randomUUID()}`,
              tache_id: a.tache_id,
              titre: a.titre.trim(),
              fait: false,
              ordre: a.ordre,
              created_at: maintenant,
              updated_at: maintenant,
            },
          ];
        }
        if (a.type === "maj") {
          const { id, type: _t, ...champs } = a;
          return l.map((s) => (s.id === id ? { ...s, ...champs } : s));
        }
        return l.filter((s) => s.id !== a.id);
      });
      return { avant };
    },
    onError: (e, _a, ctx) => {
      if (ctx?.avant) qc.setQueryData(CLE_ETAPES, ctx.avant);
      if ((e as Error).message !== "hors-ligne") toast.error((e as Error).message || "Étape non enregistrée.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CLE_ETAPES }),
  });
}

export function useCommentaires() {
  const q = useQuery({
    queryKey: CLE_COMMENTAIRES,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commentaires")
        .select("*")
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
  return { parTache: useMemo(() => grouper(q.data), [q.data]), tous: q.data ?? [] };
}

type ActionCommentaire =
  | { type: "creer"; tache_id: string; contenu: string; mentions: string[] }
  | { type: "modifier"; id: string; contenu: string; mentions: string[] }
  | { type: "supprimer"; id: string };

export function useEcrireCommentaire() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: ActionCommentaire) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const requete =
        a.type === "creer"
          ? supabase.from("commentaires").insert({
              tache_id: a.tache_id,
              ...valider(schemaCommentaire, { contenu: a.contenu, mentions: a.mentions }),
            })
          : a.type === "modifier"
            ? supabase
                .from("commentaires")
                .update(
                  valider(schemaCommentaire, {
                    contenu: a.contenu,
                    mentions: a.mentions,
                    modifie_at: new Date().toISOString(),
                  }),
                )
                .eq("id", a.id)
            : supabase.from("commentaires").update({ deleted_at: new Date().toISOString() }).eq("id", a.id);
      const { error } = await requete;
      if (error) throw error;
    },
    onError: (e) => {
      if ((e as Error).message !== "hors-ligne") toast.error((e as Error).message || "Commentaire non enregistré.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: CLE_COMMENTAIRES }),
  });
}

export type { Commentaire };
