import { useQuery } from "@tanstack/react-query";
import { appelerFonction } from "@/lib/fonctions";
import { supabase } from "@/lib/supabase";
import { VERSION_SCHEMA_APP } from "./paquet";

export interface EtatConfiguration {
  ia: boolean;
  azure: boolean;
  cron: boolean;
  url: boolean;
  modele: string;
  snapshots: number;
}

/** Présence des clés côté serveur (booléens seulement). */
export function useEtatConfiguration(actif = true) {
  return useQuery({
    queryKey: ["parametres", "configuration"],
    enabled: actif,
    staleTime: 5 * 60_000,
    retry: 1,
    queryFn: () => appelerFonction<EtatConfiguration>("configuration", { action: "etat" }),
  });
}

/** Version du schéma serveur comparée à celle attendue par l'app. */
export function useVersionServeur() {
  return useQuery({
    queryKey: ["parametres", "version_schema"],
    staleTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("version_schema");
      // Ancien serveur sans la fonction : considéré comme à mettre à jour
      const serveur = error ? null : ((data as string | null) ?? null);
      return { serveur, app: VERSION_SCHEMA_APP, enRetard: !serveur || serveur < VERSION_SCHEMA_APP };
    },
  });
}
