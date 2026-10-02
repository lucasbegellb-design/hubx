// Calendrier : grilles mois / semaine et événements (tâches, rappels, échéances Chine, rapports automatiques).
// Partagé par la page Calendrier et le flux iCal (abonnement Outlook).
import type { LigneChine } from "./chine.ts";
import {
  ajouterJours,
  dateParis,
  debutMois,
  debutSemaine,
  dernierJourOuvre,
  finMois,
  heureMinuteParis,
  jourSemaine,
} from "./dates.ts";

export type TypeEvenement = "tache" | "rappel" | "paiement" | "livraison" | "rapport";

export interface Evenement {
  /** Identifiant stable (UID iCal). */
  id: string;
  type: TypeEvenement;
  /** Jour à Paris (AAAA-MM-JJ). */
  jour: string;
  /** Rappels : instant exact et heure affichée. */
  instant?: string;
  heure?: string;
  titre: string;
  detail?: string;
  /** Route de l'app (HashRouter). */
  lien: string;
  urgent?: boolean;
  fait?: boolean;
  retard?: boolean;
  /** Tâche concernée (glisser-déposer vers un autre jour). */
  tacheId?: string;
}

/** Semaines (lundi → dimanche) couvrant le mois de `iso`. */
export function grilleMois(iso: string): string[][] {
  const semaines: string[][] = [];
  const fin = finMois(iso);
  for (let lundi = debutSemaine(debutMois(iso)); lundi <= fin; lundi = ajouterJours(lundi, 7)) {
    semaines.push(Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i)));
  }
  return semaines;
}

export function joursDeLaSemaine(iso: string): string[] {
  const lundi = debutSemaine(iso);
  return Array.from({ length: 7 }, (_, i) => ajouterJours(lundi, i));
}

export function evenementsTaches(
  taches: { id: string; titre: string; echeance: string | null; statut: string; priorite: string }[],
  aujourdhui: string,
): Evenement[] {
  return taches
    .filter((t) => t.echeance)
    .map((t) => ({
      id: `tache-${t.id}`,
      type: "tache" as const,
      jour: t.echeance!,
      titre: t.titre,
      lien: `/taches?t=${t.id}`,
      urgent: t.priorite === "urgente",
      fait: t.statut === "fait",
      retard: t.statut !== "fait" && t.echeance! < aujourdhui,
      tacheId: t.id,
    }));
}

export function evenementsRappels(postits: { id: string; contenu: string; rappel_at: string | null }[]): Evenement[] {
  return postits
    .filter((p) => p.rappel_at)
    .map((p) => ({
      id: `rappel-${p.id}`,
      type: "rappel" as const,
      jour: dateParis(p.rappel_at!),
      instant: p.rappel_at!,
      heure: heureMinuteParis(p.rappel_at!),
      titre: p.contenu.split("\n")[0].slice(0, 120),
      detail: p.contenu,
      lien: `/postits?p=${p.id}`,
    }));
}

function montantTexte(l: LigneChine): string {
  return l.montant === null ? "" : ` · ${l.montant.toLocaleString("fr-FR")} ${l.devise}`;
}

/** Paiements non réglés et livraisons attendues du suivi Chine. */
export function evenementsChine(lignes: LigneChine[], aujourdhui: string): Evenement[] {
  const res: Evenement[] = [];
  for (const l of lignes) {
    const qui = [l.fournisseur, l.po ? `(${l.po})` : ""].filter(Boolean).join(" ");
    if (!l.paye && l.date_echeance) {
      res.push({
        id: `paiement-${l.onglet}-${l.index}`,
        type: "paiement",
        jour: l.date_echeance,
        titre: `Paiement ${qui}${montantTexte(l)}`.trim(),
        lien: "/chine",
        retard: l.date_echeance < aujourdhui,
      });
    }
    if (!l.livre && l.livraison_prevue) {
      res.push({
        id: `livraison-${l.onglet}-${l.index}`,
        type: "livraison",
        jour: l.livraison_prevue,
        titre: `Livraison ${qui}`.trim(),
        lien: "/chine",
        retard: l.livraison_prevue < aujourdhui,
      });
    }
  }
  return res;
}

/** Rapports automatiques : chaque vendredi et le dernier jour ouvré du mois, à 17 h. */
export function evenementsRapports(debut: string, fin: string): Evenement[] {
  const res: Evenement[] = [];
  for (let j = debut; j <= fin; j = ajouterJours(j, 1)) {
    if (jourSemaine(j) === 5) {
      res.push({
        id: `rapport-hebdo-${j}`,
        type: "rapport",
        jour: j,
        heure: "17:00",
        titre: "Rapport hebdomadaire",
        lien: "/rapports",
      });
    }
    if (j === dernierJourOuvre(j)) {
      res.push({
        id: `rapport-mensuel-${j}`,
        type: "rapport",
        jour: j,
        heure: "17:00",
        titre: "Rapport mensuel",
        lien: "/rapports",
      });
    }
  }
  return res;
}

const ORDRE: Record<TypeEvenement, number> = { rappel: 0, tache: 1, paiement: 2, livraison: 3, rapport: 4 };

/** Événements regroupés par jour, triés (rappels à l'heure, tâches urgentes d'abord, faites en dernier). */
export function parJour(evenements: Evenement[]): Map<string, Evenement[]> {
  const m = new Map<string, Evenement[]>();
  for (const e of evenements) m.set(e.jour, [...(m.get(e.jour) ?? []), e]);
  for (const liste of m.values()) {
    liste.sort(
      (a, b) =>
        Number(a.fait ?? false) - Number(b.fait ?? false) ||
        ORDRE[a.type] - ORDRE[b.type] ||
        (a.heure ?? "").localeCompare(b.heure ?? "") ||
        Number(b.urgent ?? false) - Number(a.urgent ?? false) ||
        a.titre.localeCompare(b.titre, "fr"),
    );
  }
  return m;
}
