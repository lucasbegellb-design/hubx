import { describe, expect, it } from "vitest";
import { etapesDuContenu, etatRevision, santeProcess, type Noeud } from "@shared/process";

const p = (id: string, champs: Partial<Parameters<typeof santeProcess>[0][number]> = {}) => ({
  id,
  titre: `Process ${id}`,
  statut: "actif",
  domaine_id: "compta",
  responsable: "Lucas",
  revision_mois: 6,
  revise_le: null,
  updated_at: "2026-06-01T10:00:00Z",
  ...champs,
});

describe("révision des process", () => {
  it("calcule l'état à partir de la dernière modification ou revue", () => {
    expect(etatRevision(p("a"), "2026-10-02")).toEqual({
      etat: "a_jour",
      derniere: "2026-06-01",
      prochaine: "2026-12-01",
    });
    expect(etatRevision(p("a"), "2026-11-15").etat).toBe("bientot");
    expect(etatRevision(p("a"), "2026-12-01").etat).toBe("a_reviser");
    // Une revue explicite plus récente repousse l'échéance
    expect(etatRevision(p("a", { revise_le: "2026-09-30" }), "2026-12-01").prochaine).toBe("2027-03-30");
    expect(etatRevision(p("a", { revision_mois: 1 }), "2026-10-02").etat).toBe("a_reviser");
  });

  it("dresse la vue d'ensemble (process actifs seulement)", () => {
    const s = santeProcess(
      [
        p("ancien", { updated_at: "2025-01-01T00:00:00Z" }),
        p("bientot", { updated_at: "2026-04-20T00:00:00Z" }),
        p("ok", { domaine_id: "rh", responsable: " " }),
        p("brouillon", { statut: "brouillon", updated_at: "2020-01-01T00:00:00Z", domaine_id: "chine" }),
      ],
      [
        { id: "compta", nom: "Compta" },
        { id: "rh", nom: "RH" },
        { id: "chine", nom: "Chine" },
      ],
      "2026-10-02",
    );
    expect(s.aReviser.map((x) => x.id)).toEqual(["ancien"]);
    expect(s.bientot.map((x) => x.id)).toEqual(["bientot"]);
    expect(s.sansResponsable.map((x) => x.id)).toEqual(["ok"]);
    expect(s.domainesSansProcess.map((d) => d.nom)).toEqual(["Chine"]);
  });
});

const titre = (t: string): Noeud => ({ type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: t }] });
const liste = (type: string, items: string[]): Noeud => ({
  type,
  content: items.map((i) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text: i }] }],
  })),
});

describe("étapes d'un process", () => {
  it("prend les listes sous le titre « Étapes »", () => {
    const doc: Noeud = {
      type: "doc",
      content: [
        titre("Outils et fichiers"),
        liste("bulletList", ["Qonto"]),
        titre("Étapes"),
        liste("orderedList", ["Vérifier la facture", "", "Faire le virement"]),
        { type: "paragraph", content: [{ type: "text", text: "Puis :" }] },
        liste("bulletList", ["Archiver le justificatif"]),
        titre("Points d'attention"),
        liste("bulletList", ["Taux de change"]),
      ],
    };
    expect(etapesDuContenu(doc)).toEqual(["Vérifier la facture", "Faire le virement", "Archiver le justificatif"]);
  });

  it("se rabat sur la première liste numérotée et tronque les étapes trop longues", () => {
    const long = "x".repeat(400);
    expect(etapesDuContenu({ type: "doc", content: [liste("orderedList", ["Un", long])] })).toEqual([
      "Un",
      "x".repeat(299) + "…",
    ]);
    expect(etapesDuContenu(null)).toEqual([]);
  });
});
