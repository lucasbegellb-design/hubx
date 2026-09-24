import type { JSONContent } from "@tiptap/core";
import { toast } from "sonner";
import { dateCourte, dateLongue } from "@/lib/format";
import { enregistrerFichier } from "@/lib/tauri";
import { LIBELLE_STATUT_PROCESS, type Domaine, type Process, type StatutProcess } from "@/lib/types";
import { chargerProcessActifs } from "./api";
import { versMarkdown } from "./markdown";

export function nomFichier(titre: string): string {
  return (
    titre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 80) || "process"
  );
}

function versExport(p: Process, domaines: Map<string, Domaine>, contenu?: JSONContent) {
  return {
    id: p.id,
    titre: p.titre,
    domaine: (p.domaine_id && domaines.get(p.domaine_id)?.nom) || "Sans domaine",
    statut: LIBELLE_STATUT_PROCESS[p.statut as StatutProcess] ?? p.statut,
    responsable: p.responsable,
    majLe: dateCourte(p.updated_at),
    contenu: contenu ?? (p.contenu as JSONContent),
  };
}

export async function exporterPdf(p: Process, domaines: Map<string, Domaine>, contenu?: JSONContent) {
  const { pdfProcess } = await import("@/features/pdf/process");
  const blob = await pdfProcess(versExport(p, domaines, contenu));
  const chemin = await enregistrerFichier(`${nomFichier(p.titre)}.pdf`, blob, { nom: "PDF", extensions: ["pdf"] });
  if (chemin) toast.success("Exporté en PDF");
}

export async function exporterMarkdown(p: Process, domaines: Map<string, Domaine>, contenu?: JSONContent) {
  const e = versExport(p, domaines, contenu);
  const md = versMarkdown(e.contenu, {
    titre: p.titre,
    meta: [
      `Domaine : ${e.domaine}`,
      `Statut : ${e.statut}`,
      ...(p.responsable ? [`Responsable : ${p.responsable}`] : []),
      `Mis à jour le ${e.majLe}`,
    ],
  });
  const chemin = await enregistrerFichier(`${nomFichier(p.titre)}.md`, new TextEncoder().encode(md), {
    nom: "Markdown",
    extensions: ["md"],
  });
  if (chemin) toast.success("Exporté en Markdown");
}

export async function exporterPackPassation(domaines: Map<string, Domaine>, par: string) {
  const liste = await chargerProcessActifs();
  if (!liste.length) {
    toast.warning("Aucun process actif : passe au moins un process au statut « Actif ».");
    return;
  }
  const ordre = new Map([...domaines.values()].map((d) => [d.id, d.ordre]));
  liste.sort(
    (a, b) =>
      (ordre.get(a.domaine_id ?? "") ?? 99) - (ordre.get(b.domaine_id ?? "") ?? 99) ||
      a.titre.localeCompare(b.titre, "fr"),
  );
  const { pdfPackPassation } = await import("@/features/pdf/process");
  const blob = await pdfPackPassation(
    liste.map((p) => versExport(p, domaines)),
    dateLongue(new Date()),
    par,
  );
  const chemin = await enregistrerFichier(`pack-de-passation-xtim-${new Date().toISOString().slice(0, 10)}.pdf`, blob, {
    nom: "PDF",
    extensions: ["pdf"],
  });
  if (chemin) toast.success("Pack de passation exporté");
}
