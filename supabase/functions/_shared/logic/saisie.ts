// Analyse de la saisie rapide en une ligne.
//   Préfixes : « t: » tâche (défaut), « p: » post-it, « f: » fait.
//   Jetons   : #domaine  +projet  !  @demain @vendredi @12/10 @+3
import { ajouterJours, jourSemaine } from "./dates.ts";

export type TypeSaisie = "tache" | "postit" | "fait";

export interface Referentiel {
  id: string;
  nom: string;
}

export interface SaisieAnalysee {
  type: TypeSaisie | null;
  titre: string;
  domaineId: string | null;
  projetId: string | null;
  echeance: string | null;
  urgente: boolean;
  /** Jetons non reconnus, à signaler (ex. « #compt » sans domaine correspondant). */
  inconnus: string[];
}

export function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

const JOURS: Record<string, number> = {
  lundi: 1,
  mardi: 2,
  mercredi: 3,
  jeudi: 4,
  vendredi: 5,
  samedi: 6,
  dimanche: 7,
};

/** Interprète une date relative ou absolue (« demain », « vendredi », « 12/10 », « +3 », « 2026-10-12 »). */
export function interpreterDate(jeton: string, aujourdhui: string): string | null {
  const j = normaliser(jeton);
  if (["auj", "aujourdhui", "aujourd'hui", "today"].includes(j)) return aujourdhui;
  if (j === "demain") return ajouterJours(aujourdhui, 1);
  if (j === "apres-demain" || j === "apresdemain") return ajouterJours(aujourdhui, 2);
  if (j === "semaine")
    return ajouterJours(aujourdhui, 5 - jourSemaine(aujourdhui) + (jourSemaine(aujourdhui) > 5 ? 7 : 0));
  const plus = /^\+(\d{1,3})j?$/.exec(j);
  if (plus) return ajouterJours(aujourdhui, Number(plus[1]));
  for (const [nom, num] of Object.entries(JOURS)) {
    if (j === nom || (j.length >= 3 && nom.startsWith(j))) {
      let delta = num - jourSemaine(aujourdhui);
      if (delta <= 0) delta += 7;
      return ajouterJours(aujourdhui, delta);
    }
  }
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(j);
  if (iso) return j;
  const fr = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/.exec(j);
  if (fr) {
    const jour = Number(fr[1]);
    const mois = Number(fr[2]);
    if (jour < 1 || jour > 31 || mois < 1 || mois > 12) return null;
    let annee = fr[3] ? Number(fr[3].length === 2 ? "20" + fr[3] : fr[3]) : Number(aujourdhui.slice(0, 4));
    let d = `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
    if (!fr[3] && d < aujourdhui) {
      annee += 1;
      d = `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
    }
    // Rejette les dates impossibles (31/02…)
    if (ajouterJours(d, 0) !== d) return null;
    return d;
  }
  return null;
}

function chercher(ref: Referentiel[], recherche: string): Referentiel | null {
  const r = normaliser(recherche);
  if (!r) return null;
  return ref.find((x) => normaliser(x.nom) === r) ?? ref.find((x) => normaliser(x.nom).startsWith(r)) ?? null;
}

export function analyserSaisie(
  texte: string,
  contexte: { domaines: Referentiel[]; projets: Referentiel[]; aujourdhui: string },
): SaisieAnalysee {
  let brut = texte.trim();
  let type: TypeSaisie | null = null;
  const prefixe = /^([tpf]):\s*/i.exec(brut);
  if (prefixe) {
    type = ({ t: "tache", p: "postit", f: "fait" } as const)[prefixe[1].toLowerCase() as "t" | "p" | "f"];
    brut = brut.slice(prefixe[0].length);
  }

  const res: SaisieAnalysee = {
    type,
    titre: "",
    domaineId: null,
    projetId: null,
    echeance: null,
    urgente: false,
    inconnus: [],
  };
  // Les post-its gardent leur texte intact.
  if (type === "postit") {
    res.titre = brut;
    return res;
  }

  const mots: string[] = [];
  for (const mot of brut.split(/\s+/)) {
    if (!mot) continue;
    if (mot === "!" || mot === "!!") {
      res.urgente = true;
    } else if (mot.length > 1 && mot.startsWith("#")) {
      const d = chercher(contexte.domaines, mot.slice(1));
      if (d) res.domaineId = d.id;
      else res.inconnus.push(mot);
    } else if (mot.length > 1 && mot.startsWith("+") && !/^\+\d/.test(mot)) {
      const p = chercher(contexte.projets, mot.slice(1));
      if (p) res.projetId = p.id;
      else res.inconnus.push(mot);
    } else if (mot.length > 1 && mot.startsWith("@")) {
      const d = interpreterDate(mot.slice(1), contexte.aujourdhui);
      if (d) res.echeance = d;
      else res.inconnus.push(mot);
    } else {
      mots.push(mot);
    }
  }
  res.titre = mots.join(" ");
  if (res.titre.endsWith("!")) {
    res.urgente = true;
    res.titre = res.titre.replace(/\s*!+$/, "");
  }
  return res;
}
