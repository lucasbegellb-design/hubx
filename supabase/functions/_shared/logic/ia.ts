// IA : fournisseurs compatibles avec l'API « Chat Completions » (format OpenAI) et outils purs pour obtenir
// une réponse JSON fiable quel que soit le modèle. Partagé par l'app (choix du fournisseur) et les Edge Functions.

export type IdFournisseur = "mistral" | "deepseek" | "qwen" | "autre";

export interface Fournisseur {
  id: IdFournisseur;
  nom: string;
  description: string;
  /** Adresse de base de l'API (sans « /chat/completions ») ; vide pour « autre ». */
  url: string;
  modeleDefaut: string;
  modeles: { id: string; libelle: string }[];
  lienCle: string | null;
  /** Le modèle par défaut lit les images. */
  images: boolean;
  /** Lit les PDF sans texte (scannés), envoyés tels quels. */
  pdf: boolean;
  /** Plafond de jetons de sortie demandé au fournisseur. */
  maxSortie: number;
}

export const FOURNISSEURS: readonly Fournisseur[] = [
  {
    id: "mistral",
    nom: "Mistral AI",
    description:
      "Recommandé. Gratuit avec l'offre Experiment (sans carte bancaire ; les échanges peuvent alors servir à " +
      "entraîner les modèles), entreprise française, serveurs en Europe. Lit aussi les images et les PDF scannés.",
    url: "https://api.mistral.ai/v1",
    modeleDefaut: "mistral-small-latest",
    modeles: [
      { id: "mistral-small-latest", libelle: "rapide et économique (défaut)" },
      { id: "mistral-medium-latest", libelle: "plus précis" },
      { id: "mistral-large-latest", libelle: "le plus capable" },
    ],
    lienCle: "https://console.mistral.ai/api-keys",
    images: true,
    pdf: true,
    maxSortie: 16_000,
  },
  {
    id: "deepseek",
    nom: "DeepSeek",
    description:
      "Crédit d'essai à l'inscription, puis très bon marché. Texte uniquement (pas d'images ni de PDF scannés), " +
      "serveurs en Chine.",
    url: "https://api.deepseek.com",
    modeleDefaut: "deepseek-flash",
    modeles: [
      { id: "deepseek-flash", libelle: "rapide (défaut)" },
      { id: "deepseek-v4-pro", libelle: "plus précis" },
    ],
    lienCle: "https://platform.deepseek.com/api_keys",
    images: false,
    pdf: false,
    maxSortie: 8_000,
  },
  {
    id: "qwen",
    nom: "Qwen (Alibaba Cloud)",
    description:
      "Quota gratuit à l'ouverture du compte (région internationale, Singapour), puis bon marché. " +
      "Texte uniquement avec les modèles proposés.",
    url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    modeleDefaut: "qwen-plus",
    modeles: [
      { id: "qwen-flash", libelle: "rapide" },
      { id: "qwen-plus", libelle: "équilibré (défaut)" },
      { id: "qwen-max", libelle: "le plus capable" },
    ],
    lienCle: "https://www.alibabacloud.com/help/en/model-studio/get-api-key",
    images: false,
    pdf: false,
    maxSortie: 8_000,
  },
  {
    id: "autre",
    nom: "Autre (compatible OpenAI)",
    description:
      "Tout service au format Chat Completions : OpenRouter (modèles gratuits), Groq, Gemini, serveur Ollama " +
      "accessible en ligne… Renseigne son adresse et le nom du modèle.",
    url: "",
    modeleDefaut: "",
    modeles: [],
    lienCle: null,
    images: true,
    pdf: false,
    maxSortie: 8_000,
  },
];

export const ID_FOURNISSEURS = FOURNISSEURS.map((f) => f.id) as [IdFournisseur, ...IdFournisseur[]];

export function fournisseur(id: string | null | undefined): Fournisseur {
  return FOURNISSEURS.find((f) => f.id === id) ?? FOURNISSEURS[0];
}

/** Nom employé dans les messages (« le service d'IA » pour un service personnalisé). */
export function nomService(f: Fournisseur): string {
  return f.id === "autre" ? "le service d'IA" : f.nom;
}

export const majuscule = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Adresse acceptée pour l'API : https, ou http sur la machine locale (développement). */
export function urlApiValide(url: string): boolean {
  return (
    /^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/i.test(url) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/i.test(url)
  );
}

export function urlCompletions(base: string): string {
  return (
    base
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/chat\/completions$/, "") + "/chat/completions"
  );
}

// ---------------------------------------------------------------------------------------------
// Requête
// ---------------------------------------------------------------------------------------------

export type Morceau =
  { type: "texte"; texte: string } | { type: "image"; mime: string; base64: string } | { type: "pdf"; base64: string };

export type Schema = {
  type?: string;
  enum?: readonly string[];
  anyOf?: Schema[];
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  description?: string;
  format?: string;
};

/** Exemple de réponse construit depuis le schéma (aide les modèles en mode JSON simple). */
export function exempleSchema(s: Schema): unknown {
  if (s.anyOf) return exempleSchema(s.anyOf.find((b) => b.type !== "null") ?? s.anyOf[0]);
  if (s.enum) return s.enum[0];
  switch (s.type) {
    case "object":
      return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, v]) => [k, exempleSchema(v)]));
    case "array":
      return s.items ? [exempleSchema(s.items)] : [];
    case "string":
      return s.format === "date" ? "2026-01-31" : "…";
    case "number":
    case "integer":
      return 0;
    case "boolean":
      return false;
    default:
      return null;
  }
}

export function consigneJson(schema: Schema): string {
  return (
    "Format de réponse : uniquement un objet JSON valide, sans texte autour ni bloc de code, " +
    "conforme à ce schéma JSON (respecte les noms de champs, les valeurs autorisées « enum » et les champs " +
    "obligatoires ; dates au format AAAA-MM-JJ ; null quand une valeur facultative est inconnue).\n" +
    `Schéma : ${JSON.stringify(schema)}\n` +
    `Exemple de forme (valeurs fictives) : ${JSON.stringify(exempleSchema(schema))}`
  );
}

export interface OptionsRequete {
  modele: string;
  system: string;
  contenu: string | Morceau[];
  schema: Schema;
  maxTokens: number;
  fournisseur: Fournisseur;
  /** `response_format: json_object` (désactivé si le service le refuse). */
  modeJson: boolean;
  /** Seconde tentative : réponse précédente et défauts constatés. */
  relance?: { reponse: string; erreurs: string[] };
}

function contenuUtilisateur(contenu: string | Morceau[]): unknown {
  if (typeof contenu === "string") return contenu;
  // Texte seul : une simple chaîne, comprise par tous les services.
  if (contenu.every((m) => m.type === "texte")) return contenu.map((m) => m.texte).join("\n\n");
  return contenu.map((m) =>
    m.type === "texte"
      ? { type: "text", text: m.texte }
      : m.type === "image"
        ? { type: "image_url", image_url: { url: `data:${m.mime};base64,${m.base64}` } }
        : { type: "document_url", document_url: `data:application/pdf;base64,${m.base64}` },
  );
}

export function construireCorps(o: OptionsRequete): Record<string, unknown> {
  const messages: unknown[] = [
    { role: "system", content: `${o.system}\n\n${consigneJson(o.schema)}` },
    { role: "user", content: contenuUtilisateur(o.contenu) },
  ];
  if (o.relance) {
    messages.push(
      { role: "assistant", content: o.relance.reponse.slice(0, 20_000) || "(réponse vide)" },
      {
        role: "user",
        content:
          `Ta réponse n'est pas exploitable : ${o.relance.erreurs.slice(0, 8).join(" ; ")}. ` +
          "Renvoie uniquement l'objet JSON complet et corrigé.",
      },
    );
  }
  return {
    model: o.modele,
    messages,
    max_tokens: Math.min(o.maxTokens, o.fournisseur.maxSortie),
    temperature: 0.2,
    ...(o.modeJson ? { response_format: { type: "json_object" } } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Réponse
// ---------------------------------------------------------------------------------------------

/** Texte et raison d'arrêt d'une réponse Chat Completions. */
export function lireReponse(corps: unknown): { texte: string; fin: string | null } {
  const choix = (corps as { choices?: { message?: { content?: unknown }; finish_reason?: string }[] })?.choices?.[0];
  const c = choix?.message?.content;
  const texte =
    typeof c === "string"
      ? c
      : Array.isArray(c)
        ? c.map((p) => (typeof p === "string" ? p : typeof p?.text === "string" ? p.text : "")).join("")
        : "";
  return { texte, fin: choix?.finish_reason ?? null };
}

/** Extrait l'objet JSON d'une réponse (raisonnement <think>, bloc de code ou texte autour tolérés). */
export function extraireJson(texte: string): unknown {
  let t = texte.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const bloc = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (bloc) t = bloc[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    const debut = t.indexOf("{");
    const fin = t.lastIndexOf("}");
    if (debut >= 0 && fin > debut) return JSON.parse(t.slice(debut, fin + 1));
    throw new SyntaxError("Aucun objet JSON dans la réponse.");
  }
}

function sansAccents(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function dateIso(v: string): string | null {
  const t = v.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const fr = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (fr) return `${fr[3]}-${fr[2].padStart(2, "0")}-${fr[1].padStart(2, "0")}`;
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})T/);
  return iso ? iso[1] : null;
}

const VIDE = Symbol("vide");

function accepteNull(s: Schema): boolean {
  return s.type === "null" || Boolean(s.anyOf?.some((b) => b.type === "null"));
}

/** Valeur par défaut d'un champ obligatoire absent, ou VIDE si aucune n'est sûre. */
function parDefaut(s: Schema): unknown {
  if (accepteNull(s)) return null;
  if (s.enum) return s.enum.includes("Autre") ? "Autre" : VIDE;
  if (s.type === "string") return "";
  if (s.type === "array") return [];
  return VIDE;
}

/**
 * Met la réponse en conformité avec le schéma en corrigeant ce qui est sans risque (casse des valeurs
 * autorisées, dates JJ/MM/AAAA, champs superflus, chaîne vide pour null, éléments de liste invalides
 * écartés…). Les écarts restants sont listés dans `erreurs` (déclenchent une seconde tentative).
 */
export function conformer(valeur: unknown, schema: Schema, chemin = "réponse"): { valeur: unknown; erreurs: string[] } {
  const erreurs: string[] = [];

  function c(v: unknown, s: Schema, ch: string): unknown {
    if (s.anyOf) {
      if ((v === undefined || v === "" || v === "null") && accepteNull(s)) return null;
      for (const branche of s.anyOf) {
        const essai = conformer(v, branche, ch);
        if (!essai.erreurs.length) return essai.valeur;
      }
      if (accepteNull(s)) return null; // valeur facultative inexploitable
      erreurs.push(`${ch} : valeur inattendue`);
      return v;
    }
    if (s.enum) {
      if (typeof v === "string") {
        const texte = v;
        const trouve = s.enum.find((e) => e === texte) ?? s.enum.find((e) => sansAccents(e) === sansAccents(texte));
        if (trouve !== undefined) return trouve;
      }
      if (s.enum.includes("Autre")) return "Autre";
      erreurs.push(`${ch} doit valoir l'une de : ${s.enum.join(", ")}`);
      return v;
    }
    switch (s.type) {
      case "null":
        if (v === null || v === undefined || v === "" || v === "null") return null;
        erreurs.push(`${ch} doit être null`);
        return v;
      case "string":
        if (v === null) return ""; // texte facultatif laissé vide
        if (typeof v === "number" || typeof v === "boolean") v = String(v);
        if (typeof v !== "string") {
          erreurs.push(`${ch} doit être un texte`);
          return v;
        }
        if (s.format === "date") {
          const d = dateIso(v);
          if (!d) erreurs.push(`${ch} doit être une date AAAA-MM-JJ`);
          return d ?? v;
        }
        return v;
      case "number":
      case "integer": {
        const n = typeof v === "string" ? Number(v.replace(",", ".")) : v;
        if (typeof n !== "number" || !Number.isFinite(n)) {
          erreurs.push(`${ch} doit être un nombre`);
          return v;
        }
        return s.type === "integer" ? Math.round(n) : n;
      }
      case "boolean":
        if (typeof v === "boolean") return v;
        if (v === "true" || v === "false") return v === "true";
        erreurs.push(`${ch} doit être vrai ou faux`);
        return v;
      case "array": {
        if (v === null) return [];
        if (typeof v === "string" && s.items?.type === "string") return v.trim() ? [v.trim()] : [];
        if (!Array.isArray(v)) {
          erreurs.push(`${ch} doit être une liste`);
          return v;
        }
        if (!s.items) return v;
        const items = s.items;
        return v.flatMap((el) => {
          const r = conformer(el, items, `${ch}[]`);
          return r.erreurs.length ? [] : [r.valeur]; // élément inexploitable : écarté
        });
      }
      case "object": {
        if (typeof v !== "object" || v === null || Array.isArray(v)) {
          erreurs.push(`${ch} doit être un objet`);
          return v;
        }
        let o = v as Record<string, unknown>;
        const props = s.properties ?? {};
        const requis = s.required ?? [];
        // Réponse enveloppée ({ "resultat": { … } }) : on prend l'objet intérieur.
        const cles = Object.keys(o);
        if (requis.length > 1 && cles.length === 1 && !requis.includes(cles[0])) {
          const interieur = o[cles[0]];
          if (interieur && typeof interieur === "object" && !Array.isArray(interieur))
            o = interieur as Record<string, unknown>;
        }
        const manquants = requis.filter((k) => o[k] === undefined);
        if (manquants.length && manquants.length >= requis.length / 2) {
          erreurs.push(`${ch} : champs obligatoires absents (${manquants.join(", ")})`);
          return v;
        }
        const sortie: Record<string, unknown> = {};
        for (const [k, sp] of Object.entries(props)) {
          if (o[k] === undefined) {
            if (!requis.includes(k)) continue;
            const d = parDefaut(sp);
            if (d === VIDE) erreurs.push(`${ch}.${k} est obligatoire`);
            else sortie[k] = d;
            continue;
          }
          sortie[k] = c(o[k], sp, `${ch}.${k}`);
        }
        if (s.additionalProperties !== false) {
          for (const k of Object.keys(o)) if (!(k in props)) sortie[k] = o[k];
        }
        return sortie;
      }
      default:
        return v;
    }
  }

  const resultat = c(valeur, schema, chemin);
  return { valeur: resultat, erreurs };
}

// ---------------------------------------------------------------------------------------------
// Erreurs
// ---------------------------------------------------------------------------------------------

/** Message lisible pour une réponse HTTP en erreur du fournisseur (le corps n'est jamais affiché tel quel). */
export function messageErreurIa(statut: number, corps: string, f: { nom: string; modele: string }): string {
  return majuscule(messageBrut(statut, corps, f));
}

function messageBrut(statut: number, corps: string, f: { nom: string; modele: string }): string {
  const t = corps.toLowerCase();
  const modeleInconnu =
    /model/.test(t) &&
    /(not found|does not exist|invalid model|unknown model|not exist|no such|unsupported model)/.test(t);
  if (statut === 401)
    return `Clé API refusée par ${f.nom} (invalide ou révoquée) : vérifie-la dans Paramètres › Clés et connexions.`;
  if (statut === 402) return `Crédit ${f.nom} épuisé : recharge le compte ou choisis un autre fournisseur.`;
  if (statut === 403)
    return `Accès refusé par ${f.nom} : clé sans droit sur ce modèle, ou offre non activée sur le compte.`;
  if (statut === 404 || modeleInconnu)
    return `Modèle « ${f.modele} » introuvable chez ${f.nom} (ou adresse de l'API incorrecte) : corrige-le dans Paramètres › Clés et connexions.`;
  if (statut === 413) return `Contenu trop volumineux pour ${f.nom}.`;
  if (statut === 429)
    return `Limite d'utilisation de ${f.nom} atteinte (les offres gratuites limitent le nombre de requêtes). Réessaie dans quelques minutes.`;
  if (statut === 400 || statut === 422) {
    if (/(image|vision|document_url|multimodal|image_url)/.test(t))
      return `Le modèle « ${f.modele} » ne lit pas ce type de fichier : choisis un modèle qui lit les images (ex. Mistral).`;
    if (/(context|too long|maximum|token)/.test(t)) return `Contenu trop long pour le modèle « ${f.modele} ».`;
    return `Requête refusée par ${f.nom} (format non pris en charge par ce modèle).`;
  }
  if (statut >= 500) return `${f.nom} est indisponible pour le moment (erreur ${statut}). Réessaie plus tard.`;
  return `${f.nom} a répondu avec l'erreur ${statut}.`;
}

/** Le service refuse-t-il `response_format` ? (on retente alors sans le mode JSON) */
export function refusModeJson(statut: number, corps: string): boolean {
  return (statut === 400 || statut === 422) && /response_format|json_object|json mode/i.test(corps);
}
