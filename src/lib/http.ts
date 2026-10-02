import { estTauri } from "./tauri";

/**
 * fetch pour les services externes sans CORS (API de gestion Supabase) :
 * dans l'app de bureau, la requête part du processus Rust (plugin http) ; dans le navigateur, fetch standard.
 */
export async function fetchExterne(entree: string, init?: RequestInit): Promise<Response> {
  if (estTauri()) {
    const { fetch: fetchTauri } = await import("@tauri-apps/plugin-http");
    return fetchTauri(entree, init);
  }
  return fetch(entree, init);
}
