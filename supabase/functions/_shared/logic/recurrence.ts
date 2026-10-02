// Tâches récurrentes : règle, prochaine échéance (même calcul que public.prochaine_echeance en SQL),
// libellés et détection dans la saisie rapide (« chaque mois », « tous les lundis »…).
import { ajouterJours, jourSemaine } from "./dates.ts";

export type Frequence = "jour" | "semaine" | "mois" | "annee";

export type Recurrence = {
  frequence: Frequence;
  /** Toutes les N périodes (1 à 12). */
  intervalle?: number;
  /** Fréquence « semaine » : jours ISO (1 = lundi … 7 = dimanche). */
  jours_semaine?: number[];
  /** Fréquence « mois » : jour du mois visé (ramené au dernier jour des mois plus courts). */
  jour_mois?: number;
  /** Dernière échéance possible (AAAA-MM-JJ). */
  jusqu_au?: string | null;
};

const pad = (n: number) => String(n).padStart(2, "0");

function dernierJourDuMois(annee: number, mois: number): number {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

/** Ajoute n mois ; le jour visé (par défaut celui de `iso`) est ramené au dernier jour du mois si besoin. */
export function ajouterMois(iso: string, n: number, jourVise?: number): string {
  const [a, m, j] = iso.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const annee = Math.floor(total / 12);
  const mois = (total % 12) + 1;
  return `${annee}-${pad(mois)}-${pad(Math.min(jourVise ?? j, dernierJourDuMois(annee, mois)))}`;
}

export function intervalle(r: Recurrence): number {
  return Math.min(Math.max(Math.round(r.intervalle ?? 1), 1), 12);
}

/** Échéance de l'occurrence suivante, ou null après la date de fin. */
export function prochaineEcheance(base: string, r: Recurrence): string | null {
  const n = intervalle(r);
  let suivante: string;
  switch (r.frequence) {
    case "jour":
      suivante = ajouterJours(base, n);
      break;
    case "semaine": {
      const jours = (r.jours_semaine ?? []).filter((x) => x >= 1 && x <= 7);
      if (!jours.length) {
        suivante = ajouterJours(base, 7 * n);
        break;
      }
      // Jour suivant de la liste ; en passant le dimanche, on saute (n - 1) semaines.
      let d = ajouterJours(base, 1);
      for (let i = 0; i < 400 && !jours.includes(jourSemaine(d)); i++) {
        d = jourSemaine(d) === 7 ? ajouterJours(d, 1 + 7 * (n - 1)) : ajouterJours(d, 1);
      }
      suivante = d;
      break;
    }
    case "mois":
      suivante = ajouterMois(base, n, r.jour_mois);
      break;
    case "annee":
      suivante = ajouterMois(base, 12 * n);
      break;
  }
  if (r.jusqu_au && suivante > r.jusqu_au) return null;
  return suivante;
}

const NOMS_JOURS = ["", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

function liste(mots: string[]): string {
  return mots.length <= 1 ? (mots[0] ?? "") : `${mots.slice(0, -1).join(", ")} et ${mots.at(-1)}`;
}

export function libelleRecurrence(r: Recurrence): string {
  const n = intervalle(r);
  let l: string;
  switch (r.frequence) {
    case "jour":
      l = n === 1 ? "Tous les jours" : `Tous les ${n} jours`;
      break;
    case "semaine": {
      const jours = [...new Set(r.jours_semaine ?? [])]
        .sort()
        .map((j) => NOMS_JOURS[j])
        .filter(Boolean);
      if (jours.length) l = n === 1 ? `Chaque ${liste(jours)}` : `Toutes les ${n} semaines, le ${liste(jours)}`;
      else l = n === 1 ? "Toutes les semaines" : `Toutes les ${n} semaines`;
      break;
    }
    case "mois":
      l =
        (n === 1 ? "Tous les mois" : `Tous les ${n} mois`) +
        (r.jour_mois ? `, le ${r.jour_mois === 1 ? "1er" : r.jour_mois}` : "");
      break;
    case "annee":
      l = n === 1 ? "Tous les ans" : `Tous les ${n} ans`;
      break;
  }
  if (r.jusqu_au) {
    const [a, m, j] = r.jusqu_au.split("-");
    l += ` jusqu'au ${j}/${m}/${a}`;
  }
  return l;
}

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const JOURS_PLURIEL: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
};

/**
 * Repère une récurrence écrite en toutes lettres et la retire du texte.
 * « TVA chaque mois », « point équipe tous les lundis et jeudis », « relance toutes les 2 semaines ».
 */
export function extraireRecurrence(texte: string): { recurrence: Recurrence | null; reste: string } {
  const t = normaliser(texte);
  const motifs: [RegExp, (m: RegExpExecArray) => Recurrence | null][] = [
    [/\b(?:tous les jours|chaque jour|quotidien(?:ne)?)\b/, () => ({ frequence: "jour" })],
    [/\btous les (\d{1,2}) jours\b/, (m) => ({ frequence: "jour", intervalle: Number(m[1]) })],
    [
      /\b(?:tous les|chaque) ((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?(?:(?:,| et|,? et) (?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)s?)*)\b/,
      (m) => ({
        frequence: "semaine",
        jours_semaine: [...m[1].matchAll(/(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)/g)].map(
          (x) => JOURS_PLURIEL[x[1]],
        ),
      }),
    ],
    [/\b(?:toutes les semaines|chaque semaine|hebdomadaire)\b/, () => ({ frequence: "semaine" })],
    [/\btoutes les (\d{1,2}) semaines\b/, (m) => ({ frequence: "semaine", intervalle: Number(m[1]) })],
    [/\b(?:tous les mois|chaque mois|mensuel(?:le)?)\b/, () => ({ frequence: "mois" })],
    [/\btous les (\d{1,2}) mois\b/, (m) => ({ frequence: "mois", intervalle: Number(m[1]) })],
    [/\b(?:tous les ans|chaque annee|annuel(?:le)?)\b/, () => ({ frequence: "annee" })],
  ];
  for (const [motif, regle] of motifs) {
    const m = motif.exec(t);
    if (!m) continue;
    const r = regle(m);
    if (!r || intervalle(r) !== (r.intervalle ?? 1)) continue; // intervalle hors bornes
    // Les positions sont identiques dans le texte normalisé (NFD retire seulement des accents combinants).
    const debut = indexOriginal(texte, m.index);
    const fin = indexOriginal(texte, m.index + m[0].length);
    const reste = (texte.slice(0, debut) + texte.slice(fin)).replace(/\s{2,}/g, " ").trim();
    return { recurrence: r, reste };
  }
  return { recurrence: null, reste: texte };
}

/** Position dans le texte d'origine correspondant à une position du texte normalisé (sans accents). */
function indexOriginal(texte: string, indexNormalise: number): number {
  let n = 0;
  for (let i = 0; i < texte.length; i++) {
    if (n >= indexNormalise) return i;
    n += normaliser(texte[i]).length;
  }
  return texte.length;
}

/** Première échéance d'une récurrence saisie sans date : aujourd'hui, ou le prochain jour de la liste. */
export function premiereEcheance(r: Recurrence, aujourdhui: string): string {
  const jours = r.jours_semaine ?? [];
  if (r.frequence === "semaine" && jours.length) {
    let d = aujourdhui;
    for (let i = 0; i < 7 && !jours.includes(jourSemaine(d)); i++) d = ajouterJours(d, 1);
    return d;
  }
  return aujourdhui;
}
