// Clés des services : variable d'environnement des fonctions si définie, sinon Vault
// (saisie par l'administrateur dans l'app, lue via public.lire_secret réservé au service role).
import { clientAdmin } from "./client.ts";

export type NomSecret =
  "anthropic_api_key" | "azure_tenant_id" | "azure_client_id" | "azure_client_secret" | "cron_secret" | "url";

const DUREE_CACHE = 60_000;
const cache = new Map<NomSecret, { valeur: string | null; le: number }>();

export async function secret(nom: NomSecret, variableEnv?: string): Promise<string | null> {
  const env = variableEnv ? Deno.env.get(variableEnv) : undefined;
  if (env) return env;
  const c = cache.get(nom);
  if (c && Date.now() - c.le < DUREE_CACHE) return c.valeur;
  const { data, error } = await clientAdmin().rpc("lire_secret", { p_nom: nom });
  const valeur = error ? null : ((data as string | null) ?? null) || null;
  cache.set(nom, { valeur, le: Date.now() });
  return valeur;
}

export function oublierSecrets() {
  cache.clear();
}
