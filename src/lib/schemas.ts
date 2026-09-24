// Validation côté client (zod), alignée sur les contraintes SQL des migrations.
// Les erreurs sont traduites en messages lisibles avant tout envoi au serveur.
import { z, type ZodTypeAny } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide (AAAA-MM-JJ).");
const uuid = z.string().uuid("Référence invalide.");
const instant = z.string().datetime({ offset: true, message: "Date et heure invalides." });

export const schemaTache = z.object({
  titre: z.string().trim().min(1, "Le titre est obligatoire.").max(300, "Titre trop long (300 caractères maximum)."),
  notes: z.string().max(20000, "Notes trop longues (20 000 caractères maximum)."),
  domaine_id: uuid.nullable(),
  projet_id: uuid.nullable(),
  statut: z.enum(["a_faire", "en_cours", "en_attente", "fait"]),
  en_attente_de: z.string().max(200, "« En attente de » : 200 caractères maximum.").nullable(),
  priorite: z.enum(["normale", "urgente"]),
  echeance: date.nullable(),
  assigne_a: uuid.nullable(),
  deleted_at: instant.nullable(),
  done_at: instant.nullable(),
});

export const schemaPostit = z.object({
  contenu: z.string().trim().min(1, "Le post-it est vide.").max(5000, "Post-it trop long (5 000 caractères maximum)."),
  couleur: z.enum(["sable", "sauge", "ciel", "lavande"]),
  epingle: z.boolean(),
  rappel_at: instant.nullable(),
  rappel_envoye: z.boolean(),
  partage: z.boolean(),
  proprietaire: uuid,
  archived_at: instant.nullable(),
});

export const schemaProcess = z.object({
  titre: z.string().trim().min(1, "Le titre est obligatoire.").max(200, "Titre trop long (200 caractères maximum)."),
  domaine_id: uuid.nullable(),
  statut: z.enum(["brouillon", "actif", "obsolete"]),
  responsable: z.string().max(120, "Responsable : 120 caractères maximum.").nullable(),
  contenu: z.object({ type: z.literal("doc") }).passthrough(),
  contenu_texte: z.string(),
  deleted_at: instant.nullable(),
});

export const schemaDocument = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire.").max(255, "Nom trop long (255 caractères maximum)."),
  domaine_id: uuid.nullable(),
  projet_id: uuid.nullable(),
  categorie: z.string().max(60, "Catégorie : 60 caractères maximum.").nullable(),
  epingle: z.boolean(),
  deleted_at: instant.nullable(),
  analyse_statut: z.enum(["en_attente", "ok", "erreur"]),
  analyse_message: z.string().nullable(),
  taches_suggerees: z.array(
    z.object({ titre: z.string(), echeance: z.string().nullable(), ajoutee: z.boolean().optional() }),
  ),
});

export const schemaReferentiel = z.object({
  nom: z.string().trim().min(1, "Le nom est obligatoire.").max(80, "Nom trop long."),
  couleur: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Couleur invalide."),
  ordre: z.number().int(),
  statut: z.enum(["actif", "archive"]),
});

export const schemaMapping = z.object({
  onglets: z.array(z.object({ onglet: z.string().min(1, "Choisis un onglet."), colonnes: z.record(z.string()) })),
});

export const schemaLienPartage = z
  .string()
  .trim()
  .url("Lien invalide.")
  .refine((v) => v.startsWith("https://"), "Le lien doit commencer par https:// (« Copier le lien » dans OneDrive).");

export const schemaModele = z.string().trim().min(3, "Nom de modèle trop court.").max(100, "Nom de modèle trop long.");

/**
 * Valide une création (objet complet) ou une mise à jour (champs partiels) et renvoie les données nettoyées.
 * Lève une Error au message lisible au premier problème.
 */
export function valider<S extends z.ZodObject<Record<string, ZodTypeAny>>, T extends object>(
  schema: S,
  donnees: T,
  partiel = true,
): T {
  const s = partiel ? schema.partial() : schema;
  // On ne valide que les champs connus du schéma ; les autres (id, horodatages…) passent tels quels.
  const connus = Object.fromEntries(Object.entries(donnees).filter(([k]) => k in schema.shape));
  const r = s.safeParse(connus);
  if (!r.success) throw new Error(r.error.issues[0]?.message ?? "Données invalides.");
  return { ...donnees, ...r.data } as T;
}
