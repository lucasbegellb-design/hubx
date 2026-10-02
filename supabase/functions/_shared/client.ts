// Client Supabase « service role » (contourne la RLS) — uniquement côté serveur.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

let admin: SupabaseClient | null = null;

/** Clé serveur : clé « service_role » historique, sinon première clé secrète (nouveau format sb_secret_…). */
function cleServeur(): string {
  const historique = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (historique) return historique;
  try {
    const cles = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}") as Record<string, string>;
    const premiere = cles.default ?? Object.values(cles)[0];
    if (premiere) return premiere;
  } catch {
    /* format inattendu */
  }
  throw new HttpError(500, "Clé serveur Supabase absente de l'environnement des fonctions.");
}

/** Client service role (contourne la RLS) — uniquement côté serveur. */
export function clientAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(Deno.env.get("SUPABASE_URL")!, cleServeur(), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}
