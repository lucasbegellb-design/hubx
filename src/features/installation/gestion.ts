// Client de l'API de gestion Supabase (https://api.supabase.com) utilisé par l'assistant
// d'installation. Le jeton d'accès n'est jamais enregistré : il reste en mémoire le temps de l'installation.
import { fetchExterne } from "@/lib/http";

const API = (import.meta.env.VITE_INSTALL_API_URL as string | undefined) ?? "https://api.supabase.com";

export class ErreurGestion extends Error {
  constructor(
    public statut: number,
    message: string,
  ) {
    super(message);
  }
}

async function messageErreur(r: Response): Promise<string> {
  let detail = "";
  try {
    const j = await r.json();
    detail = j?.message ?? j?.error ?? j?.msg ?? "";
  } catch {
    /* corps vide */
  }
  switch (r.status) {
    case 401:
      return "Jeton d'accès refusé : vérifie-le ou génères-en un nouveau sur supabase.com.";
    case 403:
      return "Ce jeton n'a pas accès à ce projet (compte ou organisation différent ?).";
    case 404:
      return "Projet introuvable : il a peut-être été supprimé.";
    case 429:
      return "Trop de requêtes vers Supabase : patiente une minute puis réessaie.";
    default:
      return r.status >= 500
        ? `Supabase est momentanément indisponible (erreur ${r.status}). Réessaie dans un instant.`
        : `Supabase a refusé la demande (${r.status})${detail ? ` : ${detail}` : "."}`;
  }
}

async function appel<T>(jeton: string, chemin: string, init: RequestInit = {}): Promise<T> {
  let r: Response;
  try {
    r = await fetchExterne(API + chemin, {
      ...init,
      headers: { Authorization: `Bearer ${jeton}`, Accept: "application/json", ...(init.headers ?? {}) },
    });
  } catch {
    throw new ErreurGestion(0, "Impossible de joindre supabase.com : vérifie ta connexion internet.");
  }
  if (!r.ok) throw new ErreurGestion(r.status, await messageErreur(r));
  const texte = await r.text();
  return (texte ? JSON.parse(texte) : null) as T;
}

export interface ProjetSupabase {
  ref: string;
  name: string;
  region: string;
  status: string;
  organization_slug?: string;
  created_at?: string;
}

export interface Organisation {
  slug: string;
  name: string;
}

export const listerProjets = (jeton: string) => appel<ProjetSupabase[]>(jeton, "/v1/projects");
export const listerOrganisations = (jeton: string) => appel<Organisation[]>(jeton, "/v1/organizations");
export const lireProjet = (jeton: string, ref: string) => appel<ProjetSupabase>(jeton, `/v1/projects/${ref}`);

export const REGIONS = [
  { code: "eu-west-3", libelle: "Paris (recommandé)" },
  { code: "eu-central-1", libelle: "Francfort" },
  { code: "eu-west-1", libelle: "Irlande" },
] as const;

export function creerProjet(
  jeton: string,
  p: { nom: string; organisation: string; region: string; motDePasse: string },
) {
  return appel<ProjetSupabase>(jeton, "/v1/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: p.nom,
      organization_slug: p.organisation,
      db_pass: p.motDePasse,
      region_selection: { type: "specific", code: p.region },
    }),
  });
}

/** Attend qu'un projet soit opérationnel (création ≈ 1 à 3 minutes). */
export async function attendreProjetActif(
  jeton: string,
  ref: string,
  onEtat: (statut: string) => void,
  delaiMax = 12 * 60_000,
) {
  const debut = Date.now();
  for (;;) {
    const p = await lireProjet(jeton, ref);
    onEtat(p.status);
    if (p.status === "ACTIVE_HEALTHY") return p;
    if (["INIT_FAILED", "REMOVED", "RESTORE_FAILED"].includes(p.status)) {
      throw new ErreurGestion(0, `La création du projet a échoué côté Supabase (${p.status}).`);
    }
    if (p.status === "INACTIVE")
      throw new ErreurGestion(0, "Ce projet est en pause : relance-le depuis supabase.com (Restore project).");
    if (Date.now() - debut > delaiMax)
      throw new ErreurGestion(0, "Le projet met trop de temps à démarrer. Réessaie dans quelques minutes.");
    await new Promise((r) => setTimeout(r, 5000));
  }
}

interface CleApi {
  name: string;
  type?: "legacy" | "publishable" | "secret" | null;
  api_key?: string | null;
}

/** Clé publique (publishable ou anon) et clé serveur (secret ou service_role) du projet. */
export async function clesProjet(jeton: string, ref: string): Promise<{ publique: string; secrete: string }> {
  const cles = await appel<CleApi[]>(jeton, `/v1/projects/${ref}/api-keys?reveal=true`);
  const trouver = (types: string[], noms: string[]) =>
    cles.find((c) => c.api_key && types.includes(c.type ?? ""))?.api_key ??
    cles.find((c) => c.api_key && noms.includes(c.name))?.api_key;
  const publique = trouver(["publishable"], ["anon"]);
  const secrete = trouver(["secret"], ["service_role"]);
  if (!publique || !secrete)
    throw new ErreurGestion(0, "Clés du projet introuvables. Vérifie que le projet est bien démarré.");
  return { publique, secrete };
}

/** Exécute du SQL avec les droits du propriétaire de la base. */
export function requeteSql<T = Record<string, unknown>[]>(jeton: string, ref: string, query: string) {
  return appel<T>(jeton, `/v1/projects/${ref}/database/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}

/** Déploie une Edge Function à partir de ses fichiers sources (chemins relatifs au dossier functions). */
export function deployerFonction(
  jeton: string,
  ref: string,
  slug: string,
  fichiers: { nom: string; contenu: string }[],
) {
  const form = new FormData();
  form.append(
    "metadata",
    new Blob([JSON.stringify({ name: slug, entrypoint_path: `${slug}/index.ts`, verify_jwt: false })], {
      type: "application/json",
    }),
  );
  for (const f of fichiers) form.append("file", new Blob([f.contenu], { type: "application/typescript" }), f.nom);
  return appel<{ slug: string; version: number; status: string }>(
    jeton,
    `/v1/projects/${ref}/functions/deploy?slug=${slug}`,
    {
      method: "POST",
      body: form,
    },
  );
}

/** Inscriptions publiques fermées : seul l'administrateur crée les comptes. */
export function fermerInscriptions(jeton: string, ref: string) {
  return appel<unknown>(jeton, `/v1/projects/${ref}/config/auth`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disable_signup: true, external_email_enabled: true }),
  });
}
