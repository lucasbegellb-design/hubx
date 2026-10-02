// Export complet (app) et sauvegardes automatiques (serveur) : mêmes tables, même ordre de réimport.

export const TABLES_EXPORT = [
  "membres",
  "domaines",
  "projets",
  "taches",
  "postits",
  "process",
  "process_versions",
  "documents",
  "chine_source",
  "chine_snapshots",
  "rapports",
  "parametres",
  "journal_activite",
] as const;

export type TableExport = (typeof TABLES_EXPORT)[number];

/** Nombre de sauvegardes automatiques conservées. */
export const SAUVEGARDES_GARDEES = 8;

/** Fichiers de sauvegarde à supprimer (noms `AAAA-MM-JJ.zip`) : on garde les plus récents. */
export function sauvegardesASupprimer(noms: string[], garder = SAUVEGARDES_GARDEES): string[] {
  return noms
    .filter((n) => /^\d{4}-\d{2}-\d{2}\.zip$/.test(n))
    .sort()
    .reverse()
    .slice(garder);
}
