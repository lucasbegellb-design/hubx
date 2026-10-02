// Résolution des imports relatifs des Edge Functions (pour envoyer à Supabase tous les fichiers nécessaires).
// Module pur, testé dans tests/installation.test.ts.

const RE_IMPORT =
  /(?:import|export)\s[^"']*?from\s*["'](\.{1,2}\/[^"']+)["']|import\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g;

export function importsRelatifs(source: string): string[] {
  const res = new Set<string>();
  for (const m of source.matchAll(RE_IMPORT)) res.add(m[1] ?? m[2]);
  return [...res];
}

/** Résout `../_shared/http.ts` depuis `sync-chine/index.ts` → `_shared/http.ts`. */
export function resoudre(depuis: string, specifier: string): string {
  const segments = depuis.split("/").slice(0, -1);
  for (const s of specifier.split("/")) {
    if (s === "..") {
      if (!segments.length) throw new Error(`Import hors du dossier des fonctions : ${specifier} (depuis ${depuis})`);
      segments.pop();
    } else if (s !== ".") segments.push(s);
  }
  return segments.join("/");
}

/** Tous les fichiers atteints depuis le point d'entrée (inclus), triés. */
export async function fermetureImports(
  entree: string,
  lire: (chemin: string) => Promise<string | undefined>,
): Promise<{ nom: string; contenu: string }[]> {
  const vus = new Map<string, string>();
  const aTraiter = [entree];
  while (aTraiter.length) {
    const chemin = aTraiter.pop()!;
    if (vus.has(chemin)) continue;
    const contenu = await lire(chemin);
    if (contenu === undefined) throw new Error(`Fichier source introuvable : ${chemin}`);
    vus.set(chemin, contenu);
    for (const spec of importsRelatifs(contenu)) aTraiter.push(resoudre(chemin, spec));
  }
  return [...vus.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([nom, contenu]) => ({ nom, contenu }));
}

/** « 20260924120000_schema.sql » → { version, nom } */
export function lireNomMigration(fichier: string): { version: string; nom: string } | null {
  const m = /(\d{14})_([\w-]+)\.sql$/.exec(fichier);
  return m ? { version: m[1], nom: m[2] } : null;
}
