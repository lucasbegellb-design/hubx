// Structure un texte en vrac dans le modèle de process XTIM (l'utilisateur valide avant enregistrement).
import { verifierAppelant } from "../_shared/auth.ts";
import { HttpError, json, lireCorps, servir } from "../_shared/http.ts";
import { demanderJson } from "../_shared/ia.ts";

const MAX_CARACTERES = 40_000;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["titre_suggere", "objectif", "declencheur", "responsable", "outils", "etapes", "points_attention"],
  properties: {
    titre_suggere: { type: "string", description: "Titre court du process (verbe à l'infinitif), vide si impossible à déduire" },
    objectif: { type: "string", description: "À quoi sert ce process, en une ou deux phrases" },
    declencheur: { type: "string", description: "Événement ou moment qui déclenche le process" },
    responsable: { type: "string", description: "Personne ou rôle responsable" },
    outils: { type: "array", items: { type: "string" }, description: "Logiciels, fichiers, sites, documents utilisés" },
    etapes: { type: "array", items: { type: "string" }, description: "Étapes dans l'ordre, une action par élément" },
    points_attention: { type: "array", items: { type: "string" }, description: "Pièges, contrôles, exceptions" },
  },
};

const SYSTEM = `Tu aides XTIM SAS (PME marseillaise qui fabrique les drones biomimétiques Bionic Bird) à documenter ses process internes pour faciliter une passation.
On te donne des notes en vrac. Range leur contenu dans le modèle XTIM : objectif, déclencheur, responsable, outils et fichiers, étapes, points d'attention.
Règles strictes :
- N'invente rien. Utilise uniquement les informations présentes dans le texte.
- Si une section n'est pas renseignée par le texte, renvoie une chaîne vide ou une liste vide.
- Reformule en français clair et concis, à l'infinitif pour les étapes, sans perdre de détail utile (montants, noms, délais, seuils).
- Conserve l'ordre chronologique des étapes.`;

servir(async (req) => {
  await verifierAppelant(req);
  const { texte } = await lireCorps<{ texte?: string }>(req);
  const propre = (texte ?? "").trim();
  if (propre.length < 20) throw new HttpError(400, "Texte trop court : colle au moins quelques lignes.");
  if (propre.length > MAX_CARACTERES) {
    throw new HttpError(413, `Texte trop long (${propre.length} caractères, maximum ${MAX_CARACTERES}). Découpe-le en plusieurs process.`);
  }
  const resultat = await demanderJson<Record<string, unknown>>({
    system: SYSTEM,
    contenu: `Notes à structurer :\n\n<notes>\n${propre}\n</notes>`,
    schema: SCHEMA,
    maxTokens: 8000,
  });
  return json(resultat);
});
