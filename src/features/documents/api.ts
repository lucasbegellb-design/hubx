import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { appelerFonction } from "@/lib/fonctions";
import { supabase } from "@/lib/supabase";
import type { DocumentXtim, MiseAJour } from "@/lib/types";
import { verifierEcriture } from "@/hooks/useEcriture";
import { schemaDocument, valider } from "@/lib/schemas";

export const TAILLE_MAX = 50 * 1024 * 1024;

export interface InfoCle {
  libelle: string;
  valeur: string;
}
export interface TacheSuggeree {
  titre: string;
  echeance: string | null;
  ajoutee?: boolean;
}

export function useDocuments() {
  return useQuery({
    queryKey: ["documents", "liste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
}

/** Nom de fichier sûr pour le stockage (le nom d'origine reste dans `documents.nom`). */
function cheminStockage(nom: string): string {
  const propre = nom
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-120);
  return `${crypto.randomUUID()}/${propre || "fichier"}`;
}

/** Lance l'analyse IA ; si le service est injoignable, le document passe en « erreur » (jamais bloqué « en cours »). */
export async function lancerAnalyse(id: string) {
  try {
    return await appelerFonction<{ ok: boolean; erreur?: string }>("analyze-document", { document_id: id });
  } catch (e) {
    await supabase
      .from("documents")
      .update({ analyse_statut: "erreur", analyse_message: (e as Error).message })
      .eq("id", id)
      .eq("analyse_statut", "en_attente");
    throw e;
  }
}

export function useDeposerDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      fichiers,
      domaine_id,
      projet_id,
    }: {
      fichiers: File[];
      domaine_id: string | null;
      projet_id: string | null;
    }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const crees: DocumentXtim[] = [];
      for (const f of fichiers) {
        if (f.size > TAILLE_MAX) {
          toast.error(`« ${f.name} » dépasse 50 Mo : compresse-le ou dépose un extrait.`);
          continue;
        }
        const chemin = cheminStockage(f.name);
        const up = await supabase.storage
          .from("documents")
          .upload(chemin, f, { contentType: f.type || undefined, upsert: false });
        if (up.error) throw up.error;
        const { data, error } = await supabase
          .from("documents")
          .insert({ nom: f.name, storage_path: chemin, mime: f.type || null, taille: f.size, domaine_id, projet_id })
          .select()
          .single();
        if (error) throw error;
        crees.push(data);
      }
      return crees;
    },
    onSuccess: (crees) => {
      qc.invalidateQueries({ queryKey: ["documents"] });
      if (crees.length) toast.success(crees.length > 1 ? `${crees.length} documents déposés` : "Document déposé");
      // Analyse IA en arrière-plan ; le statut se met à jour en temps réel.
      for (const d of crees) lancerAnalyse(d.id).catch(() => qc.invalidateQueries({ queryKey: ["documents"] }));
    },
  });
}

export function useMajDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...maj }: MiseAJour<"documents"> & { id: string }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { data, error } = await supabase
        .from("documents")
        .update(valider(schemaDocument, maj))
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...maj }) => {
      const cle = ["documents", "liste"];
      await qc.cancelQueries({ queryKey: cle });
      const avant = qc.getQueryData<DocumentXtim[]>(cle);
      qc.setQueryData<DocumentXtim[]>(cle, (l) =>
        l?.map((d) => (d.id === id ? ({ ...d, ...maj } as DocumentXtim) : d)),
      );
      return { avant };
    },
    onError: (_e, _v, ctx) => ctx?.avant && qc.setQueryData(["documents", "liste"], ctx.avant),
    onSettled: () => qc.invalidateQueries({ queryKey: ["documents"] }),
  });
}

export async function urlSignee(chemin: string, telechargement?: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("documents")
    .createSignedUrl(chemin, 600, telechargement ? { download: telechargement } : undefined);
  if (error) throw error;
  return data.signedUrl;
}

export async function telecharger(chemin: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from("documents").download(chemin);
  if (error) throw error;
  return data;
}
