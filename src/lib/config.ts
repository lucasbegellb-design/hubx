/**
 * Configuration du serveur Supabase.
 * Priorité : variables injectées au build (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY),
 * sinon valeurs saisies au premier lancement (écran « Connexion au serveur »).
 */
const CLE = "hubx-serveur";

export interface ConfigServeur {
  url: string;
  anonKey: string;
}

export function lireConfigServeur(): ConfigServeur | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  if (url && anonKey) return { url, anonKey };
  try {
    const brut = localStorage.getItem(CLE);
    if (!brut) return null;
    const c = JSON.parse(brut) as ConfigServeur;
    return c.url && c.anonKey ? c : null;
  } catch {
    return null;
  }
}

export function configViaBuild(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

export function enregistrerConfigServeur(c: ConfigServeur | null) {
  if (c) localStorage.setItem(CLE, JSON.stringify(c));
  else localStorage.removeItem(CLE);
}
