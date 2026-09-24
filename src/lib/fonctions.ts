import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const URL_DEV = import.meta.env.VITE_FUNCTIONS_URL as string | undefined;

/** Développement : appel direct du serveur scripts/fonctions-dev.ts. */
async function appelerDev<T>(nom: string, corps: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const r = await fetch(`${URL_DEV}/${nom}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
    body: JSON.stringify(corps),
  }).catch(() => {
    throw new Error(`Service « ${nom} » injoignable (serveur de développement arrêté ?).`);
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j?.erreur ?? `Le service « ${nom} » a répondu avec une erreur.`);
  return j as T;
}

/** Appelle une Edge Function et renvoie son JSON, ou lève une Error au message lisible. */
export async function appelerFonction<T>(nom: string, corps: Record<string, unknown> = {}): Promise<T> {
  if (URL_DEV) return appelerDev<T>(nom, corps);
  const { data, error } = await supabase.functions.invoke(nom, { body: corps });
  if (!error) return data as T;
  if (error instanceof FunctionsHttpError) {
    let message = `Le service « ${nom} » a répondu avec une erreur.`;
    try {
      const j = await error.context.json();
      if (j?.erreur) message = j.erreur;
    } catch {
      /* corps non JSON */
    }
    throw new Error(message);
  }
  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    throw new Error(`Service « ${nom} » injoignable. Vérifie qu'il est déployé (SETUP.md) et ta connexion.`);
  }
  throw new Error(error.message);
}
