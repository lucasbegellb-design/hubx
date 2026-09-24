// Dates métier en heure de Paris, au format ISO « YYYY-MM-DD ».
// Module pur : partagé entre le client (alias @shared) et les Edge Functions.

export const FUSEAU = "Europe/Paris";

const fmtJour = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const fmtHeure = new Intl.DateTimeFormat("en-GB", {
  timeZone: FUSEAU,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date calendaire à Paris d'un instant donné. */
export function dateParis(instant: Date | string): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  return fmtJour.format(d);
}

export function aujourdhuiParis(maintenant: Date = new Date()): string {
  return dateParis(maintenant);
}

/** Heure (0-23) à Paris. */
export function heureParis(maintenant: Date = new Date()): number {
  return Number(fmtHeure.format(maintenant).slice(0, 2));
}

function versUtc(iso: string): Date {
  const [a, m, j] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, j));
}

function depuisUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(iso: string, n: number): string {
  const d = versUtc(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return depuisUtc(d);
}

/** Nombre de jours de a à b (b - a). */
export function joursEntre(a: string, b: string): number {
  return Math.round((versUtc(b).getTime() - versUtc(a).getTime()) / 86_400_000);
}

/** 1 = lundi … 7 = dimanche */
export function jourSemaine(iso: string): number {
  const j = versUtc(iso).getUTCDay();
  return j === 0 ? 7 : j;
}

export function debutSemaine(iso: string): string {
  return ajouterJours(iso, 1 - jourSemaine(iso));
}

export function finSemaine(iso: string): string {
  return ajouterJours(iso, 7 - jourSemaine(iso));
}

export function debutMois(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function finMois(iso: string): string {
  const d = versUtc(debutMois(iso));
  d.setUTCMonth(d.getUTCMonth() + 1);
  d.setUTCDate(0);
  return depuisUtc(d);
}

/** Dernier jour ouvré (lundi-vendredi) du mois contenant `iso`. Jours fériés non pris en compte. */
export function dernierJourOuvre(iso: string): string {
  let j = finMois(iso);
  while (jourSemaine(j) > 5) j = ajouterJours(j, -1);
  return j;
}

export function estJourOuvre(iso: string): boolean {
  return jourSemaine(iso) <= 5;
}

export type CodePeriode = "cette_semaine" | "semaine_derniere" | "ce_mois" | "mois_dernier" | "trimestre";

export interface Periode {
  debut: string;
  fin: string;
}

export const LIBELLES_PERIODES: Record<CodePeriode, string> = {
  cette_semaine: "Cette semaine",
  semaine_derniere: "Semaine dernière",
  ce_mois: "Ce mois",
  mois_dernier: "Mois dernier",
  trimestre: "Trimestre",
};

/** Raccourcis de période pour les rapports. */
export function periode(code: CodePeriode, aujourdhui: string): Periode {
  switch (code) {
    case "cette_semaine":
      return { debut: debutSemaine(aujourdhui), fin: finSemaine(aujourdhui) };
    case "semaine_derniere": {
      const d = ajouterJours(debutSemaine(aujourdhui), -7);
      return { debut: d, fin: ajouterJours(d, 6) };
    }
    case "ce_mois":
      return { debut: debutMois(aujourdhui), fin: finMois(aujourdhui) };
    case "mois_dernier": {
      const d = ajouterJours(debutMois(aujourdhui), -1);
      return { debut: debutMois(d), fin: finMois(d) };
    }
    case "trimestre": {
      const mois = Number(aujourdhui.slice(5, 7));
      const premier = Math.floor((mois - 1) / 3) * 3 + 1;
      const debut = `${aujourdhui.slice(0, 4)}-${String(premier).padStart(2, "0")}-01`;
      const dernierMois = `${aujourdhui.slice(0, 4)}-${String(premier + 2).padStart(2, "0")}-01`;
      return { debut, fin: finMois(dernierMois) };
    }
  }
}

/**
 * Bornes UTC d'une période de dates Paris (début inclus à 00:00 Paris, fin incluse jusqu'à 23:59:59 Paris).
 * Sert à filtrer des horodatages (journal, done_at) sur une période calendaire.
 */
export function bornesInstant(p: Periode): { depuis: string; jusqua: string } {
  return { depuis: debutJourParisUtc(p.debut), jusqua: debutJourParisUtc(ajouterJours(p.fin, 1)) };
}

/** Instant UTC correspondant à 00:00 à Paris le jour donné. */
export function debutJourParisUtc(iso: string): string {
  // Paris = UTC+1 ou UTC+2 : on teste les deux décalages.
  for (const decalage of [1, 2]) {
    const d = new Date(versUtc(iso).getTime() - decalage * 3_600_000);
    if (dateParis(d) === iso && heureParis(d) === 0) return d.toISOString();
  }
  return versUtc(iso).toISOString();
}
