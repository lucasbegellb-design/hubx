import { aujourdhuiParis } from "@shared/dates.ts";
import { etapesDuContenu, type Noeud } from "@shared/process";
import type { JSONContent } from "@tiptap/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { appelerFonction } from "@/lib/fonctions";
import { supabase } from "@/lib/supabase";
import type { MiseAJour } from "@/lib/types";
import { verifierEcriture } from "@/hooks/useEcriture";
import { schemaProcess, schemaTache, valider } from "@/lib/schemas";
import { modeleVide, texteBrut, type SectionsStructurees } from "./modele";

/** Liste légère des process (sans contenu). */
export function useProcessListe() {
  return useQuery({
    queryKey: ["process", "liste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process")
        .select(
          "id, titre, domaine_id, statut, responsable, updated_at, modifie_par, created_at, revision_mois, revise_le",
        )
        .is("deleted_at", null)
        .order("titre");
      if (error) throw error;
      return data;
    },
  });
}

/** Recherche plein texte (titre + contenu), config française. */
export function useRechercheProcess(q: string) {
  const terme = q.trim();
  return useQuery({
    queryKey: ["process", "recherche", terme],
    enabled: terme.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process")
        .select("id")
        .is("deleted_at", null)
        .textSearch("recherche", terme, { type: "websearch", config: "french" });
      if (error) throw error;
      return new Set(data.map((d) => d.id));
    },
    placeholderData: (prev) => prev,
  });
}

export function useProcess(id: string | undefined) {
  return useQuery({
    queryKey: ["process", "detail", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const { data, error } = await supabase.from("process").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useVersions(processId: string | undefined, actif: boolean) {
  return useQuery({
    queryKey: ["process", "versions", processId],
    enabled: Boolean(processId) && actif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("process_versions")
        .select("*")
        .eq("process_id", processId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreerProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (champs: { titre?: string; domaine_id?: string | null }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const contenu = modeleVide();
      const { data, error } = await supabase
        .from("process")
        .insert({
          titre: champs.titre ?? "Nouveau process",
          domaine_id: champs.domaine_id ?? null,
          contenu,
          contenu_texte: "",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["process"] }),
  });
}

export function useEnregistrerProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, contenu, ...champs }: MiseAJour<"process"> & { id: string; contenu?: JSONContent }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const maj: MiseAJour<"process"> = { ...champs };
      if (contenu) {
        maj.contenu = contenu as MiseAJour<"process">["contenu"];
        maj.contenu_texte = texteBrut(contenu);
      }
      const { data, error } = await supabase
        .from("process")
        .update(valider(schemaProcess, maj))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      qc.setQueryData(["process", "detail", p.id], p);
      qc.invalidateQueries({ queryKey: ["process"] });
    },
  });
}

/** Tous les process actifs avec contenu (pack de passation). */
export async function chargerProcessActifs() {
  const { data, error } = await supabase
    .from("process")
    .select("*")
    .is("deleted_at", null)
    .eq("statut", "actif")
    .order("titre");
  if (error) throw error;
  return data;
}

export function structurerBrouillon(texte: string) {
  return appelerFonction<SectionsStructurees>("structure-process", { texte });
}

/** « Exécuter ce process » : une tâche du jour dont les étapes reprennent celles du process. */
export function useExecuterProcess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: {
      process: { id: string; titre: string; domaine_id: string | null };
      contenu: JSONContent;
      userId: string;
    }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const etapes = etapesDuContenu(o.contenu as Noeud);
      const { data: tache, error } = await supabase
        .from("taches")
        .insert({
          ...valider(schemaTache, {
            titre: o.process.titre.slice(0, 300),
            notes: `Exécution du process « ${o.process.titre} ».`,
            domaine_id: o.process.domaine_id,
            echeance: aujourdhuiParis(),
            assigne_a: o.userId,
            statut: "a_faire",
            priorite: "normale",
          }),
          process_id: o.process.id,
        })
        .select()
        .single();
      if (error) throw error;
      if (etapes.length) {
        const { error: e2 } = await supabase
          .from("sous_taches")
          .insert(etapes.map((titre, ordre) => ({ tache_id: tache.id, titre, ordre })));
        if (e2) throw e2;
      }
      return { tache, etapes: etapes.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["taches"] });
      qc.invalidateQueries({ queryKey: ["sous_taches"] });
    },
  });
}

/** Dernières exécutions d'un process (tâches créées par « Exécuter »). */
export function useExecutions(processId: string) {
  return useQuery({
    queryKey: ["taches", "executions", processId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("taches")
        .select("id, titre, statut, created_at, done_at, assigne_a")
        .eq("process_id", processId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}
