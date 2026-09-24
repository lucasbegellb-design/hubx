import type { RealtimeChannel } from "@supabase/supabase-js";
import { queryClient } from "./queryClient";
import { supabase } from "./supabase";

/** Tables écoutées : toute modification invalide les requêtes dont la clé commence par le nom de table. */
const TABLES = [
  "taches",
  "postits",
  "process",
  "documents",
  "domaines",
  "projets",
  "membres",
  "chine_source",
  "chine_snapshots",
  "rapports",
  "parametres",
  "journal_activite",
] as const;

export type TableRealtime = (typeof TABLES)[number];

type Ecouteur = (table: TableRealtime, evenement: string, ligne: Record<string, unknown>) => void;
const ecouteurs = new Set<Ecouteur>();

/** Permet à un module de réagir à un événement (ex. notification de nouveau rapport). */
export function ecouterRealtime(fn: Ecouteur): () => void {
  ecouteurs.add(fn);
  return () => ecouteurs.delete(fn);
}

let canal: RealtimeChannel | null = null;
let dejaConnecte = false;

export function demarrerRealtime() {
  if (canal) return;
  let c = supabase.channel("hubx-db");
  for (const table of TABLES) {
    c = c.on("postgres_changes", { event: "*", schema: "public", table }, (payload) => {
      queryClient.invalidateQueries({ queryKey: [table] });
      if (table === "journal_activite") queryClient.invalidateQueries({ queryKey: ["aujourdhui"] });
      const ligne = (payload.new && Object.keys(payload.new).length ? payload.new : payload.old) as Record<string, unknown>;
      ecouteurs.forEach((fn) => fn(table, payload.eventType, ligne));
    });
  }
  canal = c.subscribe((statut) => {
    // Après une reconnexion, on resynchronise tout ce qui a pu être manqué.
    if (statut === "SUBSCRIBED") {
      if (dejaConnecte) queryClient.invalidateQueries();
      dejaConnecte = true;
    }
  });
}

export async function arreterRealtime() {
  if (canal) await supabase.removeChannel(canal);
  canal = null;
}
