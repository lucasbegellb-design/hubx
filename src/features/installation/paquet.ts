// Migrations SQL et sources des Edge Functions embarquées dans l'application (chargées à la demande).
import { fermetureImports, lireNomMigration } from "./imports";

const MIGRATIONS = import.meta.glob<string>("/supabase/migrations/*.sql", { query: "?raw", import: "default" });
const SOURCES = import.meta.glob<string>("/supabase/functions/**/*.ts", { query: "?raw", import: "default" });

export const FONCTIONS = [
  "sync-chine",
  "analyze-document",
  "structure-process",
  "generate-report",
  "manage-members",
  "configuration",
  "sauvegarde",
  "calendrier",
] as const;

export interface Migration {
  version: string;
  nom: string;
  charger: () => Promise<string>;
}

export const MIGRATIONS_APP: Migration[] = Object.entries(MIGRATIONS)
  .map(([chemin, charger]) => ({ ...lireNomMigration(chemin)!, charger }))
  .filter((m) => m.version)
  .sort((a, b) => a.version.localeCompare(b.version));

/** Version de schéma attendue par cette version de l'application. */
export const VERSION_SCHEMA_APP = MIGRATIONS_APP.at(-1)?.version ?? "";

export function fichiersFonction(slug: string) {
  return fermetureImports(`${slug}/index.ts`, async (chemin) => {
    const charger = SOURCES[`/supabase/functions/${chemin}`];
    return charger ? await charger() : undefined;
  });
}
