import type { JSONContent } from "@tiptap/core";

/** Sections du modèle de process XTIM, dans l'ordre. */
export const SECTIONS_MODELE = [
  "Objectif",
  "Déclencheur",
  "Responsable",
  "Outils et fichiers",
  "Étapes",
  "Points d'attention",
  "Dernière révision",
] as const;

const titre = (texte: string): JSONContent => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: texte }] });
const para = (texte?: string): JSONContent => (texte ? { type: "paragraph", content: [{ type: "text", text: texte }] } : { type: "paragraph" });
const liste = (items: string[], ordonnee = false): JSONContent => ({
  type: ordonnee ? "orderedList" : "bulletList",
  content: (items.length ? items : [""]).map((i) => ({ type: "listItem", content: [para(i)] })),
});

/** Document vide pré-rempli avec le modèle XTIM. */
export function modeleVide(): JSONContent {
  return {
    type: "doc",
    content: [
      titre("Objectif"),
      para(),
      titre("Déclencheur"),
      para(),
      titre("Responsable"),
      para(),
      titre("Outils et fichiers"),
      liste([]),
      titre("Étapes"),
      liste([], true),
      titre("Points d'attention"),
      liste([]),
      titre("Dernière révision"),
      para(),
    ],
  };
}

export interface SectionsStructurees {
  titre_suggere: string;
  objectif: string;
  declencheur: string;
  responsable: string;
  outils: string[];
  etapes: string[];
  points_attention: string[];
}

/** Construit le document TipTap à partir des sections renvoyées par l'IA. */
export function docDepuisSections(s: SectionsStructurees, revision: string): JSONContent {
  return {
    type: "doc",
    content: [
      titre("Objectif"),
      para(s.objectif),
      titre("Déclencheur"),
      para(s.declencheur),
      titre("Responsable"),
      para(s.responsable),
      titre("Outils et fichiers"),
      liste(s.outils),
      titre("Étapes"),
      liste(s.etapes, true),
      titre("Points d'attention"),
      liste(s.points_attention),
      titre("Dernière révision"),
      para(revision),
    ],
  };
}

function texteNoeud(n: JSONContent): string {
  if (n.type === "text") return n.text ?? "";
  return (n.content ?? []).map(texteNoeud).join(n.type === "paragraph" ? "" : " ");
}

/** Met à jour le paragraphe qui suit le titre « Dernière révision » (ou l'ajoute). */
export function avecRevision(doc: JSONContent, texte: string): JSONContent {
  const contenu = [...(doc.content ?? [])];
  const i = contenu.findIndex((n) => n.type === "heading" && texteNoeud(n).trim().toLowerCase() === "dernière révision");
  if (i === -1) return { ...doc, content: [...contenu, titre("Dernière révision"), para(texte)] };
  const suivant = contenu[i + 1];
  if (suivant && suivant.type === "paragraph") contenu[i + 1] = para(texte);
  else contenu.splice(i + 1, 0, para(texte));
  return { ...doc, content: contenu };
}

/** Texte brut (recherche plein texte). */
export function texteBrut(doc: JSONContent): string {
  return (doc.content ?? [])
    .map(texteNoeud)
    .join("\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}
