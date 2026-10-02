// Santé des process (passation) : révision périodique, couverture des domaines, étapes à exécuter.
import { dateParis } from "./dates.ts";
import { ajouterMois } from "./recurrence.ts";

/** Nœud TipTap minimal (JSON du document). */
export type Noeud = { type?: string; text?: string; content?: Noeud[]; attrs?: Record<string, unknown> };

export interface ProcessSante {
  id: string;
  titre: string;
  statut: string;
  domaine_id: string | null;
  responsable: string | null;
  revision_mois: number;
  revise_le: string | null;
  updated_at: string;
  deleted_at?: string | null;
}

export type EtatRevision = "a_jour" | "bientot" | "a_reviser";

/** Délai (jours) avant échéance pendant lequel un process est signalé « à réviser bientôt ». */
export const PREAVIS_REVISION = 30;

export function derniereRevision(p: Pick<ProcessSante, "revise_le" | "updated_at">): string {
  const modif = dateParis(p.updated_at);
  return p.revise_le && p.revise_le > modif ? p.revise_le : modif;
}

export function etatRevision(
  p: Pick<ProcessSante, "revise_le" | "updated_at" | "revision_mois">,
  aujourdhui: string,
): { etat: EtatRevision; derniere: string; prochaine: string } {
  const derniere = derniereRevision(p);
  const prochaine = ajouterMois(derniere, p.revision_mois || 6);
  const dans = (Date.parse(prochaine) - Date.parse(aujourdhui)) / 86_400_000;
  const etat: EtatRevision = prochaine <= aujourdhui ? "a_reviser" : dans <= PREAVIS_REVISION ? "bientot" : "a_jour";
  return { etat, derniere, prochaine };
}

export interface Sante<P extends ProcessSante, D extends { id: string; nom: string }> {
  aReviser: P[];
  bientot: P[];
  sansResponsable: P[];
  domainesSansProcess: D[];
}

/** Vue d'ensemble : seuls les process actifs comptent (les brouillons ne sont pas encore la référence). */
export function santeProcess<P extends ProcessSante, D extends { id: string; nom: string }>(
  process: P[],
  domaines: D[],
  aujourdhui: string,
): Sante<P, D> {
  const actifs = process.filter((p) => p.statut === "actif" && !p.deleted_at);
  const parProchaine = (a: P, b: P) =>
    etatRevision(a, aujourdhui).prochaine.localeCompare(etatRevision(b, aujourdhui).prochaine);
  return {
    aReviser: actifs.filter((p) => etatRevision(p, aujourdhui).etat === "a_reviser").sort(parProchaine),
    bientot: actifs.filter((p) => etatRevision(p, aujourdhui).etat === "bientot").sort(parProchaine),
    sansResponsable: actifs.filter((p) => !p.responsable?.trim()),
    domainesSansProcess: domaines.filter((d) => !actifs.some((p) => p.domaine_id === d.id)),
  };
}

function texte(n: Noeud): string {
  if (n.type === "text") return n.text ?? "";
  return (n.content ?? []).map(texte).join(n.type === "paragraph" ? "" : " ");
}

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

function elementsDeListe(liste: Noeud): string[] {
  return (liste.content ?? [])
    .filter((li) => li.type === "listItem")
    .map((li) => {
      const premier = (li.content ?? []).find((c) => c.type === "paragraph");
      return (premier ? texte(premier) : texte(li)).replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);
}

/**
 * Étapes d'un process (modèle XTIM) : listes placées sous le titre « Étapes », sinon la première liste
 * numérotée du document. Chaque étape devient une sous-tâche (300 caractères maximum, 50 étapes au plus).
 */
export function etapesDuContenu(doc: Noeud | null | undefined): string[] {
  const noeuds = doc?.content ?? [];
  const debut = noeuds.findIndex((n) => n.type === "heading" && normaliser(texte(n)) === "etapes");
  let etapes: string[] = [];
  if (debut >= 0) {
    for (const n of noeuds.slice(debut + 1)) {
      if (n.type === "heading") break;
      if (n.type === "orderedList" || n.type === "bulletList") etapes.push(...elementsDeListe(n));
    }
  } else {
    const liste = noeuds.find((n) => n.type === "orderedList");
    if (liste) etapes = elementsDeListe(liste);
  }
  return etapes.slice(0, 50).map((e) => (e.length > 300 ? e.slice(0, 299) + "…" : e));
}
