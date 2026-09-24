/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import {
  appliquerMapping,
  calculerAlertes,
  calculerKpi,
  detecterEntete,
  diffSnapshots,
  lireMapping,
  normaliserClasseur,
  parserDate,
  parserMontant,
  validerMapping,
  type DonneesChine,
  type MappingChine,
} from "@shared/chine.ts";

function lireFixture(): DonneesChine {
  const wb = XLSX.read(readFileSync("fixtures/suivi_chine_exemple.xlsx"), { type: "buffer", cellDates: true });
  return normaliserClasseur(
    wb.SheetNames.map((nom) => ({
      nom,
      lignes: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, raw: true, defval: null }),
    })),
  );
}

const MAPPING: MappingChine = {
  onglets: [
    {
      onglet: "PO & paiements",
      colonnes: {
        fournisseur: "Fournisseur",
        po: "N° PO",
        montant: "Montant",
        devise: "Devise",
        date_echeance: "Échéance",
        date_paiement: "Payé le",
        statut: "Statut",
      },
    },
    {
      onglet: "Livraisons",
      colonnes: {
        po: "N° PO",
        livraison_prevue: "Livraison prévue",
        livraison_reelle: "Livraison réelle",
        statut: "Statut",
      },
    },
  ],
};

describe("normalisation du classeur", () => {
  const d = lireFixture();

  it("détecte les en-têtes même sous une ligne de titre", () => {
    const p = d.onglets.find((o) => o.nom === "PO & paiements")!;
    expect(p.ligneEntete).toBe(2);
    expect(p.entetes.slice(0, 3)).toEqual(["Réf.", "Fournisseur", "N° PO"]);
    expect(p.lignes).toHaveLength(9);
  });

  it("convertit les dates Excel en dates ISO", () => {
    const p = d.onglets.find((o) => o.nom === "PO & paiements")!;
    expect(p.lignes[0][p.entetes.indexOf("Échéance")]).toBe("2026-08-05");
  });

  it("nomme les colonnes sans en-tête et dédoublonne", () => {
    const r = normaliserClasseur([
      {
        nom: "X",
        lignes: [
          ["A", "A", null, "B"],
          [1, 2, 3, 4],
        ],
      },
    ]);
    expect(r.onglets[0].entetes).toEqual(["A", "A (2)", "Colonne 3", "B"]);
  });

  it("ignore les onglets vides", () => {
    expect(normaliserClasseur([{ nom: "Vide", lignes: [[null], []] }]).onglets).toHaveLength(0);
  });

  it("ne prend pas une ligne de titre isolée pour un en-tête", () => {
    expect(detecterEntete([["Titre"], [null], ["Nom", "Montant"], ["a", 1]])).toBe(2);
  });
});

describe("lecture des valeurs", () => {
  it("montants dans tous les formats", () => {
    expect(parserMontant("12 500,00 €")).toBe(12500);
    expect(parserMontant("$1,234.50")).toBe(1234.5);
    expect(parserMontant("1.234,50")).toBe(1234.5);
    expect(parserMontant("USD 3,000")).toBe(3000);
    expect(parserMontant("12,5")).toBe(12.5);
    expect(parserMontant(4250)).toBe(4250);
    expect(parserMontant("—")).toBeNull();
  });

  it("dates dans tous les formats", () => {
    expect(parserDate("2026-10-15")).toBe("2026-10-15");
    expect(parserDate("15/10/2026")).toBe("2026-10-15");
    expect(parserDate("5.1.26")).toBe("2026-01-05");
    expect(parserDate(46310)).toBe("2026-10-15"); // numéro de série Excel
    expect(parserDate("Oct 15, 2026")).toBe("2026-10-15");
    expect(parserDate("15 Oct 2026")).toBe("2026-10-15");
    expect(parserDate("à définir")).toBeNull();
  });
});

describe("application du mapping", () => {
  const d = lireFixture();
  const lignes = appliquerMapping(d, MAPPING);

  it("type chaque ligne des onglets mappés", () => {
    const pai = lignes.filter((l) => l.onglet === "PO & paiements");
    expect(pai).toHaveLength(9);
    expect(pai[0]).toMatchObject({
      fournisseur: "Shenzhen Wingtech Co.",
      po: "PO-2026-031",
      montant: 9600,
      devise: "USD",
      paye: true,
    });
    expect(pai[1]).toMatchObject({ date_echeance: "2026-09-28", paye: false });
  });

  it("calcule les KPI par devise", () => {
    const kpi = calculerKpi(
      lignes.filter((l) => l.onglet === "PO & paiements"),
      "2026-09-24",
    );
    const usd = kpi.parDevise.find((k) => k.devise === "USD")!;
    expect(usd.engage).toBe(9600 + 22400 + 5850 + 13650 + 3200 + 3200 + 9600);
    expect(usd.paye).toBe(9600 + 5850 + 3200);
    expect(usd.reste).toBe(22400 + 13650 + 3200 + 9600);
    expect(kpi.parDevise.map((k) => k.devise).sort()).toEqual(["CNY", "EUR", "USD"]);
    expect(kpi.prochainesEcheances[0].date_echeance).toBe("2026-09-28");
  });

  it("lève les alertes paiements dus et livraisons en retard", () => {
    const a = calculerAlertes(lignes, "2026-09-24");
    expect(a.paiementsDus.map((l) => l.date_echeance)).toEqual([
      "2026-09-22",
      "2026-09-28",
      "2026-09-30",
      "2026-10-01",
    ]);
    expect(a.paiementsDus[0].enRetard).toBe(true);
    // PO-2026-029 est livré, PO-2026-034/038 pas encore dus
    expect(a.livraisonsEnRetard.map((l) => l.po)).toEqual(["PO-2026-036", "PO-2026-031"]);
    expect(a.livraisonsEnRetard[0].joursRetard).toBe(6);
  });

  it("tolère un onglet ou une colonne renommés avec un message clair", () => {
    const m = lireMapping({
      onglets: [
        { onglet: "Paiements 2025", colonnes: { montant: "Montant" } },
        { onglet: "PO & paiements", colonnes: { montant: "Montant USD", fournisseur: "Fournisseur" } },
      ],
    });
    const v = validerMapping(d, m);
    expect(v.problemes).toHaveLength(2);
    expect(v.problemes[0]).toContain("« Paiements 2025 » n'existe plus");
    expect(v.problemes[1]).toContain("« Montant USD »");
    expect(() => appliquerMapping(d, m)).not.toThrow();
    expect(appliquerMapping(d, m).every((l) => l.montant === null)).toBe(true);
  });

  it("lit l'ancien format de mapping à un seul onglet", () => {
    expect(lireMapping({ onglet: "Livraisons", colonnes: { po: "N° PO" } }).onglets).toHaveLength(1);
    expect(lireMapping(null).onglets).toHaveLength(0);
  });
});

describe("comparaison de snapshots", () => {
  const apres = lireFixture();
  const clone = (x: DonneesChine): DonneesChine => JSON.parse(JSON.stringify(x));

  it("détecte ajouts, modifications et suppressions par clé", () => {
    const avant = clone(apres);
    const p = avant.onglets[0];
    const iStatut = p.entetes.indexOf("Statut");
    p.lignes = p.lignes.filter((l) => l[0] !== "PAY-109"); // ajoutée depuis
    p.lignes.find((l) => l[0] === "PAY-106")![iStatut] = "À payer"; // modifiée depuis
    p.lignes.push(["PAY-099", "Ancien", "PO-1", "x", "x", 1, "USD", null, null, "Annulé"]); // supprimée depuis
    const diff = diffSnapshots(avant, apres, MAPPING);
    const o = diff.onglets.find((x) => x.onglet === "PO & paiements")!;
    expect(o.colonneCle).toBe("Réf."); // N° PO n'est pas unique → colonne unique auto
    expect(o.ajoutees.map((l) => l[0])).toEqual(["PAY-109"]);
    expect(o.supprimees.map((l) => l[0])).toEqual(["PAY-099"]);
    expect(o.modifiees).toHaveLength(1);
    expect(o.modifiees[0]).toMatchObject({ cle: "PAY-106", colonnes: ["Statut"] });
    expect(diff.totaux).toEqual({ ajoutees: 1, modifiees: 1, supprimees: 1 });
  });

  it("aucune différence entre deux snapshots identiques", () => {
    expect(diffSnapshots(apres, clone(apres)).onglets).toHaveLength(0);
  });

  it("signale les onglets ajoutés ou supprimés", () => {
    const avant = clone(apres);
    avant.onglets = avant.onglets.filter((o) => o.nom !== "Fournisseurs");
    avant.onglets.push({ nom: "Archive", ligneEntete: 0, entetes: ["A"], lignes: [["x"]] });
    const diff = diffSnapshots(avant, apres);
    expect(diff.onglets.find((o) => o.onglet === "Fournisseurs")?.statut).toBe("ajoute");
    expect(diff.onglets.find((o) => o.onglet === "Archive")?.statut).toBe("supprime");
  });

  it("supporte une colonne déplacée sans tout marquer comme modifié", () => {
    const avant = clone(apres);
    const l = avant.onglets.find((o) => o.nom === "Fournisseurs")!;
    // inverse les deux dernières colonnes
    l.entetes = [...l.entetes.slice(0, 3), l.entetes[4], l.entetes[3]];
    l.lignes = l.lignes.map((r) => [...r.slice(0, 3), r[4], r[3]]);
    expect(diffSnapshots(avant, apres).onglets.find((o) => o.onglet === "Fournisseurs")).toBeUndefined();
  });
});

describe("détection automatique des colonnes", () => {
  it("reconnaît les libellés courants (français et anglais)", async () => {
    const { devinerColonnes } = await import("@shared/chine.ts");
    expect(
      devinerColonnes([
        "Réf.",
        "Fournisseur",
        "N° PO",
        "Désignation",
        "Type",
        "Montant",
        "Devise",
        "Échéance",
        "Payé le",
        "Statut",
      ]),
    ).toEqual({
      fournisseur: "Fournisseur",
      po: "N° PO",
      montant: "Montant",
      devise: "Devise",
      date_echeance: "Échéance",
      date_paiement: "Payé le",
      statut: "Statut",
    });
    expect(
      devinerColonnes(["Supplier", "PO", "Amount", "Currency", "Due date", "ETA", "Delivered on", "Status"]),
    ).toMatchObject({
      fournisseur: "Supplier",
      po: "PO",
      montant: "Amount",
      date_echeance: "Due date",
      livraison_prevue: "ETA",
      livraison_reelle: "Delivered on",
    });
  });
});
