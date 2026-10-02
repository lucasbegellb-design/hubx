import { describe, expect, it } from "vitest";
import {
  evenementsChine,
  evenementsRapports,
  evenementsRappels,
  evenementsTaches,
  grilleMois,
  joursDeLaSemaine,
  parJour,
} from "@shared/calendrier";
import { echapper, genererIcal, plier } from "@shared/ical";

describe("calendrier", () => {
  it("construit la grille du mois, du lundi au dimanche", () => {
    const g = grilleMois("2026-10-15");
    expect(g[0][0]).toBe("2026-09-28");
    expect(g.at(-1)!.at(-1)).toBe("2026-11-01");
    expect(g.length).toBe(5);
    expect(grilleMois("2026-02-10").length).toBe(5); // le 1er février 2026 est un dimanche
    expect(joursDeLaSemaine("2026-10-02")).toEqual([
      "2026-09-28",
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
      "2026-10-03",
      "2026-10-04",
    ]);
  });

  it("transforme tâches, rappels, Chine et rapports en événements", () => {
    const t = evenementsTaches(
      [
        { id: "a", titre: "TVA", echeance: "2026-10-01", statut: "a_faire", priorite: "urgente" },
        { id: "b", titre: "Sans date", echeance: null, statut: "a_faire", priorite: "normale" },
      ],
      "2026-10-02",
    );
    expect(t).toEqual([
      expect.objectContaining({ id: "tache-a", jour: "2026-10-01", retard: true, urgent: true, tacheId: "a" }),
    ]);
    const r = evenementsRappels([
      { id: "p", contenu: "Appeler la banque\ndétails", rappel_at: "2026-10-02T07:30:00Z" },
    ]);
    expect(r[0]).toMatchObject({ jour: "2026-10-02", heure: "09:30", titre: "Appeler la banque" });
    const c = evenementsChine(
      [
        {
          onglet: "PO",
          index: 3,
          fournisseur: "Ningbo",
          po: "PO-12",
          montant: 48000,
          devise: "CNY",
          date_echeance: "2026-10-10",
          date_paiement: null,
          statut: null,
          livraison_prevue: "2026-09-30",
          livraison_reelle: null,
          paye: false,
          livre: false,
        },
      ],
      "2026-10-02",
    );
    expect(c.map((e) => [e.type, e.jour, e.retard])).toEqual([
      ["paiement", "2026-10-10", false],
      ["livraison", "2026-09-30", true],
    ]);
    expect(c[0].titre).toBe(`Paiement Ningbo (PO-12) · ${(48000).toLocaleString("fr-FR")} CNY`);
    expect(evenementsRapports("2026-10-26", "2026-11-01").map((e) => [e.titre, e.jour])).toEqual([
      ["Rapport hebdomadaire", "2026-10-30"],
      ["Rapport mensuel", "2026-10-30"],
    ]);
  });

  it("trie chaque journée", () => {
    const m = parJour([
      { id: "1", type: "tache", jour: "2026-10-02", titre: "B", lien: "", fait: true },
      { id: "2", type: "tache", jour: "2026-10-02", titre: "A", lien: "" },
      { id: "3", type: "rappel", jour: "2026-10-02", heure: "09:00", titre: "R", lien: "" },
      { id: "4", type: "tache", jour: "2026-10-02", titre: "C", lien: "", urgent: true },
    ]);
    expect(m.get("2026-10-02")!.map((e) => e.id)).toEqual(["3", "4", "2", "1"]);
  });
});

describe("iCal", () => {
  it("échappe et plie les lignes à 75 octets", () => {
    // Attendu, caractère par caractère : a \ ; b \ , c \ \ d \ n e
    expect(echapper("a;b,c\\d\ne")).toBe(String.raw`a\;b\,c\\d\ne`);
    expect(echapper(";")).toHaveLength(2);
    const longue = "SUMMARY:" + "é".repeat(60);
    const pliee = plier(longue);
    for (const l of pliee.split("\r\n")) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75);
    expect(pliee.replace(/\r\n /g, "")).toBe(longue);
  });

  it("produit un calendrier valide (journées entières et rappels horodatés)", () => {
    const ics = genererIcal({
      nom: "Hub XTIM — Lucas",
      maintenant: new Date("2026-10-02T10:00:00Z"),
      evenements: [
        { id: "tache-a", type: "tache", jour: "2026-10-15", titre: "TVA, mensuelle", lien: "", urgent: true },
        {
          id: "rappel-p",
          type: "rappel",
          jour: "2026-10-02",
          instant: "2026-10-02T07:30:00Z",
          heure: "09:30",
          titre: "Banque",
          lien: "",
        },
      ],
    });
    expect(ics.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics).toContain("DTSTART;VALUE=DATE:20261015\r\nDTEND;VALUE=DATE:20261016");
    expect(ics).toContain("SUMMARY:[Urgent] TVA\\, mensuelle");
    expect(ics).toContain("DTSTART:20261002T073000Z");
    expect(ics).toContain("UID:rappel-p@hub-xtim");
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(2);
    expect(ics).toContain("BEGIN:VALARM");
  });
});
