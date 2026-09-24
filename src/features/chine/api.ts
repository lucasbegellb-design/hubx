import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { aujourdhuiParis } from "@shared/dates.ts";
import {
  appliquerMapping,
  calculerAlertes,
  calculerKpi,
  lireDonnees,
  lireMapping,
  mappingConfigure,
  validerMapping,
  type MappingChine,
} from "@shared/chine.ts";
import { appelerFonction } from "@/lib/fonctions";
import { supabase } from "@/lib/supabase";
import type { Json } from "@/lib/database.types";

export function useChineSource() {
  return useQuery({
    queryKey: ["chine_source"],
    queryFn: async () => {
      const { data, error } = await supabase.from("chine_source").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });
}

/** Snapshot le plus récent (données complètes). */
export function useDernierSnapshot() {
  return useQuery({
    queryKey: ["chine_snapshots", "dernier"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chine_snapshots")
        .select("id, taken_at, source, hash, data")
        .order("taken_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? { ...data, donnees: lireDonnees(data.data) } : null;
    },
    staleTime: 5 * 60_000,
  });
}

export function useListeSnapshots(actif: boolean) {
  return useQuery({
    queryKey: ["chine_snapshots", "liste"],
    enabled: actif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chine_snapshots")
        .select("id, taken_at, source")
        .order("taken_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
  });
}

export function useSnapshot(id: string | null) {
  return useQuery({
    queryKey: ["chine_snapshots", "detail", id],
    enabled: Boolean(id),
    staleTime: Infinity,
    queryFn: async () => {
      const { data, error } = await supabase.from("chine_snapshots").select("id, taken_at, data").eq("id", id!).single();
      if (error) throw error;
      return { ...data, donnees: lireDonnees(data.data) };
    },
  });
}

/** Données dérivées du dernier snapshot + mapping : lignes typées, KPI, alertes, problèmes de mapping. */
export function useAnalyseChine() {
  const source = useChineSource();
  const snap = useDernierSnapshot();
  return useMemo(() => {
    const mapping = lireMapping(source.data?.mapping);
    const donnees = snap.data?.donnees ?? { onglets: [] };
    const configure = mappingConfigure(mapping);
    const lignes = configure ? appliquerMapping(donnees, mapping) : [];
    const aujourdhui = aujourdhuiParis();
    return {
      charge: source.isSuccess && snap.isSuccess,
      source: source.data,
      snapshot: snap.data,
      donnees,
      mapping,
      configure,
      problemes: configure && donnees.onglets.length ? validerMapping(donnees, mapping).problemes : [],
      lignes,
      kpi: calculerKpi(lignes, aujourdhui),
      alertes: calculerAlertes(lignes, aujourdhui),
    };
  }, [source.data, snap.data, source.isSuccess, snap.isSuccess]);
}

export function useActualiserChine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => appelerFonction<{ ok: boolean; change: boolean; snapshot: boolean }>("sync-chine"),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["chine_source"] });
      qc.invalidateQueries({ queryKey: ["chine_snapshots"] });
    },
    onError: () => undefined, // l'erreur est affichée depuis chine_source.last_error
  });
}

export function testerConnexionChine() {
  return appelerFonction<{ ok: boolean; mode: string; nom: string; modifie_le: string | null }>("sync-chine", { test: true });
}

export function useMajSourceChine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (maj: { share_url?: string | null; mapping?: MappingChine }) => {
      const { data: s } = await supabase.from("chine_source").select("id").limit(1).single();
      const { error } = await supabase
        .from("chine_source")
        .update({ ...maj, mapping: maj.mapping as unknown as Json | undefined })
        .eq("id", s!.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chine_source"] }),
  });
}
