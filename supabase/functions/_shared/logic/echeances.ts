// Regroupement des tâches par échéance (liste Tâches, écran Aujourd'hui, rapports).
import { ajouterJours, dateParis, finSemaine } from "./dates.ts";

export type CleGroupe = "en_retard" | "aujourdhui" | "cette_semaine" | "plus_tard" | "sans_date" | "faites";

export const LIBELLES_GROUPES: Record<CleGroupe, string> = {
  en_retard: "En retard",
  aujourdhui: "Aujourd'hui",
  cette_semaine: "Cette semaine",
  plus_tard: "Plus tard",
  sans_date: "Sans date",
  faites: "Faites récemment",
};

export const ORDRE_GROUPES: CleGroupe[] = [
  "en_retard",
  "aujourdhui",
  "cette_semaine",
  "plus_tard",
  "sans_date",
  "faites",
];

export interface TacheEcheance {
  id: string;
  statut: string;
  echeance: string | null;
  priorite: string;
  done_at: string | null;
  created_at: string;
}

/** Nombre de jours pendant lesquels une tâche faite reste dans « Faites récemment ». */
export const JOURS_FAITES_RECEMMENT = 7;

export function groupeDe(t: TacheEcheance, aujourdhui: string): CleGroupe | null {
  if (t.statut === "fait") {
    if (!t.done_at) return "faites";
    const limite = ajouterJours(aujourdhui, -JOURS_FAITES_RECEMMENT);
    return dateParis(t.done_at) > limite ? "faites" : null;
  }
  if (!t.echeance) return "sans_date";
  if (t.echeance < aujourdhui) return "en_retard";
  if (t.echeance === aujourdhui) return "aujourdhui";
  if (t.echeance <= finSemaine(aujourdhui)) return "cette_semaine";
  return "plus_tard";
}

function comparer(a: TacheEcheance, b: TacheEcheance): number {
  // Urgentes d'abord, puis échéance croissante, puis création
  if (a.priorite !== b.priorite) return a.priorite === "urgente" ? -1 : 1;
  const ea = a.echeance ?? "9999-12-31";
  const eb = b.echeance ?? "9999-12-31";
  if (ea !== eb) return ea < eb ? -1 : 1;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/**
 * Répartit les tâches dans les groupes d'échéance, triées dans chaque groupe.
 * Les tâches faites depuis plus de 7 jours sont exclues.
 */
export function grouperParEcheance<T extends TacheEcheance>(
  taches: T[],
  aujourdhui: string,
): { cle: CleGroupe; libelle: string; taches: T[] }[] {
  const groupes = new Map<CleGroupe, T[]>(ORDRE_GROUPES.map((c) => [c, []]));
  for (const t of taches) {
    const g = groupeDe(t, aujourdhui);
    if (g) groupes.get(g)!.push(t);
  }
  return ORDRE_GROUPES.map((cle) => {
    const liste = groupes.get(cle)!;
    if (cle === "faites") liste.sort((a, b) => ((a.done_at ?? "") < (b.done_at ?? "") ? 1 : -1));
    else liste.sort(comparer);
    return { cle, libelle: LIBELLES_GROUPES[cle], taches: liste };
  });
}

/** Jours de retard (positif) d'une échéance passée. */
export function joursDeRetard(echeance: string, aujourdhui: string): number {
  const a = Date.UTC(+aujourdhui.slice(0, 4), +aujourdhui.slice(5, 7) - 1, +aujourdhui.slice(8, 10));
  const e = Date.UTC(+echeance.slice(0, 4), +echeance.slice(5, 7) - 1, +echeance.slice(8, 10));
  return Math.max(0, Math.round((a - e) / 86_400_000));
}
