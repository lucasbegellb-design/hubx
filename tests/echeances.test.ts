import { describe, expect, it } from "vitest";
import { grouperParEcheance, groupeDe, joursDeRetard } from "@shared/echeances.ts";
import { ajouterJours, bornesInstant, dernierJourOuvre, finSemaine, periode } from "@shared/dates.ts";

const AUJ = "2026-09-24"; // jeudi

function t(
  id: string,
  champs: Partial<{ statut: string; echeance: string | null; priorite: string; done_at: string | null }>,
) {
  return {
    id,
    statut: "a_faire",
    echeance: null,
    priorite: "normale",
    done_at: null,
    created_at: "2026-09-01T10:00:00Z",
    ...champs,
  };
}

describe("regroupement par échéance", () => {
  it("classe chaque tâche dans le bon groupe", () => {
    expect(groupeDe(t("a", { echeance: "2026-09-23" }), AUJ)).toBe("en_retard");
    expect(groupeDe(t("b", { echeance: AUJ }), AUJ)).toBe("aujourdhui");
    expect(groupeDe(t("c", { echeance: "2026-09-27" }), AUJ)).toBe("cette_semaine"); // dimanche
    expect(groupeDe(t("d", { echeance: "2026-09-28" }), AUJ)).toBe("plus_tard"); // lundi suivant
    expect(groupeDe(t("e", {}), AUJ)).toBe("sans_date");
    expect(groupeDe(t("f", { statut: "fait", done_at: "2026-09-20T10:00:00Z", echeance: "2026-09-01" }), AUJ)).toBe(
      "faites",
    );
  });

  it("exclut les tâches faites depuis plus de 7 jours", () => {
    expect(groupeDe(t("g", { statut: "fait", done_at: "2026-09-10T10:00:00Z" }), AUJ)).toBeNull();
  });

  it("une tâche faite en retard n'apparaît pas en retard", () => {
    const g = grouperParEcheance(
      [t("h", { statut: "fait", echeance: "2026-09-01", done_at: "2026-09-24T08:00:00Z" })],
      AUJ,
    );
    expect(g.find((x) => x.cle === "en_retard")!.taches).toHaveLength(0);
    expect(g.find((x) => x.cle === "faites")!.taches).toHaveLength(1);
  });

  it("trie les urgentes en premier puis par échéance", () => {
    const g = grouperParEcheance(
      [
        t("1", { echeance: "2026-09-26" }),
        t("2", { echeance: "2026-09-25", priorite: "urgente" }),
        t("3", { echeance: "2026-09-25" }),
      ],
      AUJ,
    );
    expect(g.find((x) => x.cle === "cette_semaine")!.taches.map((x) => x.id)).toEqual(["2", "3", "1"]);
  });

  it("renvoie les six groupes dans l'ordre", () => {
    expect(grouperParEcheance([], AUJ).map((g) => g.cle)).toEqual([
      "en_retard",
      "aujourdhui",
      "cette_semaine",
      "plus_tard",
      "sans_date",
      "faites",
    ]);
  });

  it("calcule les jours de retard", () => {
    expect(joursDeRetard("2026-09-20", AUJ)).toBe(4);
    expect(joursDeRetard("2026-09-30", AUJ)).toBe(0);
  });

  it("le dimanche, « cette semaine » se limite au jour même", () => {
    expect(finSemaine("2026-09-27")).toBe("2026-09-27");
    expect(groupeDe(t("x", { echeance: "2026-09-28" }), "2026-09-27")).toBe("plus_tard");
  });
});

describe("dates Paris", () => {
  it("périodes de rapport", () => {
    expect(periode("cette_semaine", AUJ)).toEqual({ debut: "2026-09-21", fin: "2026-09-27" });
    expect(periode("semaine_derniere", AUJ)).toEqual({ debut: "2026-09-14", fin: "2026-09-20" });
    expect(periode("ce_mois", AUJ)).toEqual({ debut: "2026-09-01", fin: "2026-09-30" });
    expect(periode("mois_dernier", "2026-03-15")).toEqual({ debut: "2026-02-01", fin: "2026-02-28" });
    expect(periode("trimestre", AUJ)).toEqual({ debut: "2026-07-01", fin: "2026-09-30" });
  });

  it("dernier jour ouvré du mois", () => {
    expect(dernierJourOuvre("2026-05-10")).toBe("2026-05-29"); // 31 mai = dimanche
    expect(dernierJourOuvre("2026-09-01")).toBe("2026-09-30"); // mercredi
    expect(dernierJourOuvre("2026-10-01")).toBe("2026-10-30"); // 31 = samedi
  });

  it("bornes UTC d'une période (heure d'été / d'hiver)", () => {
    expect(bornesInstant({ debut: "2026-07-01", fin: "2026-07-31" })).toEqual({
      depuis: "2026-06-30T22:00:00.000Z",
      jusqua: "2026-07-31T22:00:00.000Z",
    });
    expect(bornesInstant({ debut: "2026-01-05", fin: "2026-01-11" }).depuis).toBe("2026-01-04T23:00:00.000Z");
  });

  it("arithmétique de dates en fin de mois", () => {
    expect(ajouterJours("2026-02-28", 1)).toBe("2026-03-01");
    expect(ajouterJours("2026-01-01", -1)).toBe("2025-12-31");
  });
});
