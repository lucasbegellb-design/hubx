import { strToU8, zipSync, type Zippable } from "fflate";
import { supabase } from "@/lib/supabase";
import { enregistrerFichier } from "@/lib/tauri";

/** Tables exportées (toutes les données partagées ; les post-its privés des autres membres restent privés). */
const TABLES = [
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

async function lireTable(table: (typeof TABLES)[number]): Promise<Record<string, unknown>[]> {
  const lignes: Record<string, unknown>[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order("created_at")
      .range(de, de + 999);
    if (error) throw new Error(`Lecture de « ${table} » impossible : ${error.message}`);
    lignes.push(...(data as Record<string, unknown>[]));
    if (data.length < 1000) return lignes;
  }
}

function cellule(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV compatible Excel (séparateur « ; », BOM UTF-8). */
export function versCsv(lignes: Record<string, unknown>[]): string {
  if (!lignes.length) return "﻿";
  const colonnes = [...new Set(lignes.flatMap((l) => Object.keys(l)))];
  return "﻿" + [colonnes.join(";"), ...lignes.map((l) => colonnes.map((c) => cellule(l[c])).join(";"))].join("\r\n");
}

/**
 * Export complet : toutes les tables en JSON + CSV, et les fichiers du stockage, dans un zip.
 * `progression` reçoit un libellé à afficher.
 */
export async function exporterTout(progression: (m: string) => void): Promise<string | null> {
  const zip: Zippable = {};
  const lisezmoi = [
    "Export complet Hub XTIM",
    `Généré le ${new Date().toLocaleString("fr-FR")}`,
    "",
    "donnees/<table>.json : données brutes (réimportables)",
    "donnees/<table>.csv  : mêmes données pour Excel (séparateur ;)",
    "fichiers/            : documents déposés (chemin = storage_path de la table documents)",
    "",
    "Voir PASSATION.md dans le dépôt pour la restauration.",
  ].join("\r\n");
  zip["LISEZMOI.txt"] = strToU8(lisezmoi);

  const documents: Record<string, unknown>[] = [];
  for (const t of TABLES) {
    progression(`Lecture de ${t}…`);
    const lignes = await lireTable(t);
    if (t === "documents") documents.push(...lignes);
    zip[`donnees/${t}.json`] = strToU8(JSON.stringify(lignes, null, 2));
    zip[`donnees/${t}.csv`] = strToU8(versCsv(lignes));
  }

  let i = 0;
  for (const d of documents) {
    i++;
    progression(`Fichiers ${i}/${documents.length}…`);
    const chemin = String(d.storage_path);
    const { data, error } = await supabase.storage.from("documents").download(chemin);
    if (error || !data) continue; // fichier manquant : signalé dans le JSON (storage_path)
    zip[`fichiers/${chemin}`] = [new Uint8Array(await data.arrayBuffer()), { level: 0 }];
  }

  progression("Compression…");
  const octets = zipSync(zip, { level: 6 });
  return enregistrerFichier(`export-hub-xtim-${new Date().toISOString().slice(0, 10)}.zip`, octets, {
    nom: "Archive zip",
    extensions: ["zip"],
  });
}
