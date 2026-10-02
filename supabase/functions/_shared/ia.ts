// Appels au fournisseur d'IA choisi dans l'app (Mistral par défaut, DeepSeek, Qwen ou service compatible
// OpenAI), au format « Chat Completions ». La clé ne quitte jamais le serveur et aucun contenu n'est journalisé.
import { clientAdmin } from "./client.ts";
import { HttpError } from "./http.ts";
import {
  conformer,
  construireCorps,
  extraireJson,
  fournisseur,
  type Fournisseur,
  lireReponse,
  majuscule,
  messageErreurIa,
  type Morceau,
  nomService,
  refusModeJson,
  type Schema,
  urlCompletions,
} from "./logic/ia.ts";
import { secret } from "./secrets.ts";

export type { Morceau };

export interface ConfigIa {
  fournisseur: Fournisseur;
  url: string;
  modele: string;
  cle: string | null;
}

const DELAI = 120_000;

export async function configIa(): Promise<ConfigIa> {
  const [{ data }, cle] = await Promise.all([
    clientAdmin().from("parametres").select("modele_ia, ia_fournisseur, ia_url").limit(1).maybeSingle(),
    secret("ia_api_key", "IA_API_KEY"),
  ]);
  const f = fournisseur(data?.ia_fournisseur);
  return {
    fournisseur: f,
    url: (data?.ia_url || f.url).trim(),
    modele: (data?.modele_ia || f.modeleDefaut).trim(),
    cle,
  };
}

export async function iaDisponible(): Promise<boolean> {
  const c = await configIa();
  return Boolean(c.cle && c.url && c.modele);
}

function verifierConfig(c: ConfigIa): string | null {
  if (!c.cle) return "aucune clé API enregistrée (Paramètres › Clés et connexions).";
  if (!c.url) return "adresse de l'API manquante (Paramètres › Clés et connexions).";
  if (!c.modele) return "modèle non renseigné (Paramètres › Clés et connexions).";
  return null;
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** POST /chat/completions ; une nouvelle tentative sur limite atteinte (429) ou panne passagère (5xx). */
async function appeler(c: ConfigIa, corps: Record<string, unknown>): Promise<{ statut: number; texte: string }> {
  for (let essai = 0; ; essai++) {
    let r: Response;
    try {
      r = await fetch(urlCompletions(c.url), {
        method: "POST",
        headers: { Authorization: `Bearer ${c.cle}`, "Content-Type": "application/json" },
        body: JSON.stringify(corps),
        signal: AbortSignal.timeout(DELAI),
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === "TimeoutError")
        throw new HttpError(
          504,
          `${majuscule(nomService(c.fournisseur))} met trop de temps à répondre. Réessaie plus tard.`,
        );
      throw new HttpError(
        502,
        `${majuscule(nomService(c.fournisseur))} injoignable depuis le serveur (adresse de l'API correcte ?).`,
      );
    }
    const texte = await r.text();
    const passager = r.status === 429 || r.status === 502 || r.status === 503 || r.status === 504;
    if (passager && essai === 0) {
      const attente = Number(r.headers.get("retry-after"));
      await pause(Number.isFinite(attente) && attente > 0 ? Math.min(attente, 10) * 1000 : 2000);
      continue;
    }
    return { statut: r.status, texte };
  }
}

/**
 * Demande une réponse JSON conforme au schéma : mode JSON du fournisseur + schéma dans la consigne,
 * mise en conformité tolérante, puis une seconde tentative en cas de réponse inexploitable.
 * Lève une HttpError au message lisible.
 */
export async function demanderJson<T>(options: {
  system: string;
  contenu: string | Morceau[];
  schema: Schema;
  maxTokens?: number;
}): Promise<T> {
  const c = await configIa();
  const manque = verifierConfig(c);
  if (manque) throw new HttpError(503, `IA indisponible : ${manque}`);

  let modeJson = true;
  let relance: { reponse: string; erreurs: string[] } | undefined;
  for (let essai = 0; essai < 3; essai++) {
    const corps = construireCorps({
      modele: c.modele,
      system: options.system,
      contenu: options.contenu,
      schema: options.schema,
      maxTokens: options.maxTokens ?? 8000,
      fournisseur: c.fournisseur,
      modeJson,
      relance,
    });
    const r = await appeler(c, corps);
    if (r.statut < 200 || r.statut >= 300) {
      if (modeJson && refusModeJson(r.statut, r.texte)) {
        modeJson = false; // service qui ignore le mode JSON : le schéma reste dans la consigne
        continue;
      }
      throw new HttpError(
        r.statut === 429 ? 503 : 502,
        messageErreurIa(r.statut, r.texte, { nom: nomService(c.fournisseur), modele: c.modele }),
      );
    }

    let reponse: { texte: string; fin: string | null };
    try {
      reponse = lireReponse(JSON.parse(r.texte));
    } catch {
      throw new HttpError(502, `Réponse de ${nomService(c.fournisseur)} illisible. Réessaie.`);
    }
    if (reponse.fin === "length") throw new HttpError(422, "Réponse IA incomplète (contenu trop long).");
    if (reponse.fin === "content_filter") throw new HttpError(422, "L'IA a refusé de traiter ce contenu.");

    let erreurs: string[];
    try {
      const resultat = conformer(extraireJson(reponse.texte), options.schema);
      if (!resultat.erreurs.length) return resultat.valeur as T;
      erreurs = resultat.erreurs;
    } catch {
      erreurs = [reponse.texte.trim() ? "ce n'est pas un objet JSON valide" : "réponse vide"];
    }
    if (relance) break; // déjà une seconde tentative
    relance = { reponse: reponse.texte, erreurs };
  }
  throw new HttpError(502, "Réponse IA inexploitable. Réessaie, ou choisis un modèle plus capable.");
}

/** Petit appel de vérification (bouton « Tester » des paramètres). */
export async function testerIa(): Promise<
  { ok: true; modele: string; fournisseur: string } | { ok: false; erreur: string }
> {
  const c = await configIa();
  const manque = verifierConfig(c);
  if (manque) return { ok: false, erreur: manque.charAt(0).toUpperCase() + manque.slice(1) };
  try {
    const r = await appeler(c, {
      model: c.modele,
      messages: [{ role: "user", content: "Réponds simplement : OK" }],
      max_tokens: 16,
    });
    if (r.statut >= 200 && r.statut < 300)
      return { ok: true, modele: c.modele, fournisseur: nomService(c.fournisseur) };
    return {
      ok: false,
      erreur: messageErreurIa(r.statut, r.texte, { nom: nomService(c.fournisseur), modele: c.modele }),
    };
  } catch (e) {
    return {
      ok: false,
      erreur: e instanceof HttpError ? e.message : `${majuscule(nomService(c.fournisseur))} injoignable.`,
    };
  }
}
