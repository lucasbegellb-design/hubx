import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { lireConfigServeur } from "./config";

export type Db = SupabaseClient<Database>;

const config = lireConfigServeur();

/**
 * Client Supabase unique. `null` tant que le serveur n'est pas configuré
 * (l'app affiche alors l'écran de configuration).
 */
export const supabaseOuNull: Db | null = config
  ? createClient<Database>(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: "hubx-auth" },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;

/** À utiliser partout une fois l'app configurée (garanti par <ConfigGate>). */
export const supabase = supabaseOuNull as Db;

export const urlServeur = config?.url ?? "";

/** Transforme une erreur Supabase/PostgREST en message lisible et actionnable. */
export function messageErreur(e: unknown): string {
  if (!e) return "Erreur inconnue.";
  const err = e as { message?: string; code?: string; details?: string };
  const msg = err.message ?? String(e);
  if (/Failed to fetch|NetworkError|network/i.test(msg))
    return "Serveur injoignable. Vérifie ta connexion internet puis réessaie.";
  if (err.code === "42501" || /row-level security|permission denied/i.test(msg))
    return "Action non autorisée pour ton compte. Demande à l'administrateur.";
  if (err.code === "23505") return "Cet élément existe déjà.";
  if (err.code === "23503") return "Élément encore utilisé ailleurs : retire d'abord les liens.";
  if (err.code === "23514") return "Valeur refusée par la base : vérifie les champs saisis.";
  if (/JWT|token/i.test(msg)) return "Session expirée. Reconnecte-toi.";
  return msg;
}
