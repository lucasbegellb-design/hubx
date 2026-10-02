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

// ---------------------------------------------------------------------------
// Code d'invitation : adresse + clé publique du serveur en une seule chaîne à copier-coller
// (l'administrateur l'envoie à un collègue, qui le colle au premier lancement).
// ---------------------------------------------------------------------------
const PREFIXE_CODE = "HUBX1.";

function versBase64Url(texte: string): string {
  const octets = new TextEncoder().encode(texte);
  let binaire = "";
  octets.forEach((o) => (binaire += String.fromCharCode(o)));
  return btoa(binaire).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function depuisBase64Url(code: string): string {
  const b64 = code.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((code.length + 3) % 4);
  const binaire = atob(b64);
  return new TextDecoder().decode(Uint8Array.from(binaire, (c) => c.charCodeAt(0)));
}

export function codeInvitation(c: ConfigServeur): string {
  return PREFIXE_CODE + versBase64Url(JSON.stringify({ u: c.url, k: c.anonKey }));
}

/** Renvoie la configuration contenue dans un code d'invitation, ou null s'il est invalide. */
export function lireCodeInvitation(code: string): ConfigServeur | null {
  const propre = code.trim().replace(/\s+/g, "");
  if (!propre.startsWith(PREFIXE_CODE)) return null;
  try {
    const { u, k } = JSON.parse(depuisBase64Url(propre.slice(PREFIXE_CODE.length))) as { u?: string; k?: string };
    if (!u || !k || !/^https?:\/\//.test(u)) return null;
    return { url: u.replace(/\/$/, ""), anonKey: k };
  } catch {
    return null;
  }
}

/** Référence du projet (« abcd… ») d'après son adresse https://abcd….supabase.co */
export function refProjet(url: string): string | null {
  return /^https:\/\/([a-z]{20})\.supabase\.co\/?$/.exec(url)?.[1] ?? null;
}
