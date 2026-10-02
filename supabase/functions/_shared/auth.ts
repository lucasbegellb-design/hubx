// Vérification de l'appelant : JWT Supabase + appartenance à `membres`, ou secret pg_cron.
import { clientAdmin } from "./client.ts";
import { HttpError } from "./http.ts";
import { secret } from "./secrets.ts";

export { clientAdmin };

export type Appelant = { type: "membre"; userId: string; role: "admin" | "membre"; nom: string } | { type: "systeme" };

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
  const secretCron = options.autoriserCron ? await secret("cron_secret", "CRON_SECRET") : null;
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
