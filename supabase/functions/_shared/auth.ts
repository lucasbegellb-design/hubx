// Vérification de l'appelant : JWT Supabase + appartenance à `membres`, ou secret pg_cron.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { HttpError } from "./http.ts";

export type Appelant =
  | { type: "membre"; userId: string; role: "admin" | "membre"; nom: string }
  | { type: "systeme" };

let admin: SupabaseClient | null = null;

/** Client service role (contourne la RLS) — uniquement côté serveur. */
export function clientAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

function egaliteConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifierAppelant(
  req: Request,
  options: { autoriserCron?: boolean; adminSeulement?: boolean } = {},
): Promise<Appelant> {
  const secretCron = Deno.env.get("CRON_SECRET");
  const enteteCron = req.headers.get("x-cron-secret");
  if (options.autoriserCron && secretCron && enteteCron && egaliteConstante(enteteCron, secretCron)) {
    return { type: "systeme" };
  }

  const jeton = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!jeton) throw new HttpError(401, "Authentification requise.");

  const { data, error } = await clientAdmin().auth.getUser(jeton);
  if (error || !data.user) throw new HttpError(401, "Session invalide ou expirée. Reconnecte-toi.");

  const { data: membre } = await clientAdmin()
    .from("membres")
    .select("role, nom")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (!membre) throw new HttpError(403, "Ce compte n'est pas membre du Hub XTIM.");
  if (options.adminSeulement && membre.role !== "admin") {
    throw new HttpError(403, "Action réservée à l'administrateur.");
  }
  return { type: "membre", userId: data.user.id, role: membre.role, nom: membre.nom };
}
