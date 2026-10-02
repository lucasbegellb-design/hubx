import { describe, expect, it } from "vitest";
import {
  ajouterMois,
  extraireRecurrence,
  libelleRecurrence,
  premiereEcheance,
  prochaineEcheance,
} from "@shared/recurrence";
import { analyserSaisie } from "@shared/saisie";

// Cas partagés avec le test SQL de public.prochaine_echeance (voir la vérification du lot 2).
const CAS: [string, Parameters<typeof prochaineEcheance>[1], string | null][] = [
  ["2026-10-02", { frequence: "jour" }, "2026-10-03"],
  ["2026-10-02", { frequence: "jour", intervalle: 3 }, "2026-10-05"],
  ["2026-10-02", { frequence: "semaine" }, "2026-10-09"],
  ["2026-10-02", { frequence: "semaine", intervalle: 2 }, "2026-10-16"],
  // vendredi 2 → lundi 5 / jeudi 8 / lundi 12
  ["2026-10-02", { frequence: "semaine", jours_semaine: [1, 4] }, "2026-10-05"],
  ["2026-10-05", { frequence: "semaine", jours_semaine: [1, 4] }, "2026-10-08"],
  ["2026-10-08", { frequence: "semaine", jours_semaine: [1, 4] }, "2026-10-12"],
  // toutes les 2 semaines le lundi et le jeudi : après jeudi 8 → lundi 19
  ["2026-10-08", { frequence: "semaine", jours_semaine: [1, 4], intervalle: 2 }, "2026-10-19"],
  ["2026-01-31", { frequence: "mois" }, "2026-02-28"],
  ["2026-02-28", { frequence: "mois", jour_mois: 31 }, "2026-03-31"],
  ["2026-11-30", { frequence: "mois", intervalle: 3, jour_mois: 30 }, "2027-02-28"],
  ["2028-02-29", { frequence: "annee" }, "2029-02-28"],
  ["2026-12-15", { frequence: "mois", jusqu_au: "2026-12-31" }, null],
];

describe("récurrence", () => {
  it.each(CAS)("après %s avec %j → %s", (base, r, attendu) => {
    expect(prochaineEcheance(base, r)).toBe(attendu);
  });

  it("ajoute des mois en ramenant au dernier jour", () => {
    expect(ajouterMois("2026-01-31", 1)).toBe("2026-02-28");
    expect(ajouterMois("2026-12-10", 1)).toBe("2027-01-10");
    expect(ajouterMois("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("formule des libellés lisibles", () => {
    expect(libelleRecurrence({ frequence: "mois", jour_mois: 15 })).toBe("Tous les mois, le 15");
    expect(libelleRecurrence({ frequence: "mois", jour_mois: 1 })).toBe("Tous les mois, le 1er");
    expect(libelleRecurrence({ frequence: "semaine", jours_semaine: [4, 1] })).toBe("Chaque lundi et jeudi");
    expect(libelleRecurrence({ frequence: "semaine", intervalle: 2 })).toBe("Toutes les 2 semaines");
    expect(libelleRecurrence({ frequence: "annee", jusqu_au: "2030-06-30" })).toBe("Tous les ans jusqu'au 30/06/2030");
  });

  it("repère la répétition écrite en toutes lettres", () => {
    expect(extraireRecurrence("Déclaration TVA chaque mois")).toEqual({
      recurrence: { frequence: "mois" },
      reste: "Déclaration TVA",
    });
    expect(extraireRecurrence("Point équipe tous les lundis et jeudis !").recurrence).toEqual({
      frequence: "semaine",
      jours_semaine: [1, 4],
    });
    expect(extraireRecurrence("Relancer Ningbo toutes les 2 semaines").recurrence).toEqual({
      frequence: "semaine",
      intervalle: 2,
    });
    expect(extraireRecurrence("Renouveler l'assurance chaque année").reste).toBe("Renouveler l'assurance");
    expect(extraireRecurrence("Tous les 40 jours").recurrence).toBeNull();
    expect(extraireRecurrence("Appeler le mois prochain").recurrence).toBeNull();
  });

  it("fixe la première échéance", () => {
    expect(premiereEcheance({ frequence: "semaine", jours_semaine: [1] }, "2026-10-02")).toBe("2026-10-05");
    expect(premiereEcheance({ frequence: "mois" }, "2026-10-02")).toBe("2026-10-02");
  });

  it("s'intègre à la saisie rapide", () => {
    const ctx = { domaines: [{ id: "c", nom: "Compta" }], projets: [], aujourdhui: "2026-10-02" };
    const s = analyserSaisie("Déclaration TVA chaque mois #compta @15/10", ctx);
    expect(s).toMatchObject({
      titre: "Déclaration TVA",
      domaineId: "c",
      echeance: "2026-10-15",
      recurrence: { frequence: "mois", jour_mois: 15 },
    });
    expect(analyserSaisie("p: chaque mois penser à la TVA", ctx).recurrence).toBeNull();
    expect(analyserSaisie("Point équipe tous les lundis", ctx).echeance).toBe("2026-10-05");
  });
});
