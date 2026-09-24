import type { Database } from "./database.types";

type T = Database["public"]["Tables"];
export type Ligne<N extends keyof T> = T[N]["Row"];
export type Insertion<N extends keyof T> = T[N]["Insert"];
export type MiseAJour<N extends keyof T> = T[N]["Update"];

export type Membre = Ligne<"membres">;
export type Domaine = Ligne<"domaines">;
export type Projet = Ligne<"projets">;
export type Tache = Ligne<"taches">;
export type Postit = Ligne<"postits">;
export type Process = Ligne<"process">;
export type ProcessVersion = Ligne<"process_versions">;
export type DocumentXtim = Ligne<"documents">;
export type ChineSource = Ligne<"chine_source">;
export type ChineSnapshot = Ligne<"chine_snapshots">;
export type Rapport = Ligne<"rapports">;
export type Parametres = Ligne<"parametres">;
export type Journal = Ligne<"journal_activite">;

export type StatutTache = "a_faire" | "en_cours" | "en_attente" | "fait";
export type Priorite = "normale" | "urgente";
export type CouleurPostit = "sable" | "sauge" | "ciel" | "lavande";
export type StatutProcess = "brouillon" | "actif" | "obsolete";

export const LIBELLE_STATUT: Record<StatutTache, string> = {
  a_faire: "À faire",
  en_cours: "En cours",
  en_attente: "En attente",
  fait: "Fait",
};

export const LIBELLE_STATUT_PROCESS: Record<StatutProcess, string> = {
  brouillon: "Brouillon",
  actif: "Actif",
  obsolete: "Obsolète",
};
