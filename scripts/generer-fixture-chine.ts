// Génère le fichier de test du Suivi Chine (données fictives) :
//   - fixtures/suivi_chine_exemple.xlsx          : classeur d'exemple (mode démo)
//   - supabase/functions/sync-chine/fixture.ts   : le même classeur en base64 (embarqué dans la fonction)
//   - supabase/seeds/chine.sql                   : snapshot « de la semaine dernière » + mapping de démo (local)
// Lancement : npm run fixture:chine
import { writeFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { normaliserClasseur, type MappingChine } from "../supabase/functions/_shared/logic/chine.ts";

const d = (iso: string) => new Date(`${iso}T12:00:00`);

type Ligne = (string | number | Date | null)[];

const ENTETES_PAIEMENTS = [
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
];
const paiements: Ligne[] = [
  [
    "PAY-101",
    "Shenzhen Wingtech Co.",
    "PO-2026-031",
    "Ailes Swift (lot 1)",
    "Acompte 30 %",
    9600,
    "USD",
    d("2026-08-05"),
    d("2026-08-04"),
    "Payé",
  ],
  [
    "PAY-102",
    "Shenzhen Wingtech Co.",
    "PO-2026-031",
    "Ailes Swift (lot 1)",
    "Solde 70 %",
    22400,
    "USD",
    d("2026-09-28"),
    null,
    "À payer",
  ],
  [
    "PAY-103",
    "Dongguan Precision Motors",
    "PO-2026-034",
    "Micro-moteurs BB-M3",
    "Acompte 30 %",
    5850,
    "USD",
    d("2026-08-20"),
    d("2026-08-21"),
    "Payé",
  ],
  [
    "PAY-104",
    "Dongguan Precision Motors",
    "PO-2026-034",
    "Micro-moteurs BB-M3",
    "Solde 70 %",
    13650,
    "USD",
    d("2026-10-15"),
    null,
    "À payer",
  ],
  [
    "PAY-105",
    "Ningbo Packaging Ltd",
    "PO-2026-036",
    "Coffrets cadeau Noël",
    "Totalité",
    48000,
    "CNY",
    d("2026-09-22"),
    null,
    "En attente",
  ],
  [
    "PAY-106",
    "Guangzhou Battery Tech",
    "PO-2026-038",
    "Batteries LiPo 3,7 V",
    "Acompte 50 %",
    3200,
    "USD",
    d("2026-09-10"),
    d("2026-09-12"),
    "Payé",
  ],
  [
    "PAY-107",
    "Guangzhou Battery Tech",
    "PO-2026-038",
    "Batteries LiPo 3,7 V",
    "Solde 50 %",
    3200,
    "USD",
    d("2026-10-01"),
    null,
    "À payer",
  ],
  [
    "PAY-108",
    "Xiamen Mold Factory",
    "PO-2026-040",
    "Moule coque Swift v2",
    "Totalité",
    12500,
    "EUR",
    d("2026-11-05"),
    null,
    "À payer",
  ],
  [
    "PAY-109",
    "Shenzhen Wingtech Co.",
    "PO-2026-042",
    "Ailes Swift (lot 2)",
    "Acompte 30 %",
    9600,
    "USD",
    d("2026-09-30"),
    null,
    "À payer",
  ],
];

const ENTETES_LIVRAISONS = [
  "N° PO",
  "Fournisseur",
  "Transporteur",
  "Départ usine prévu",
  "Livraison prévue",
  "Livraison réelle",
  "Statut",
];
const livraisons: Ligne[] = [
  ["PO-2026-031", "Shenzhen Wingtech Co.", "DHL Express", d("2026-09-15"), d("2026-09-22"), null, "En transit"],
  ["PO-2026-034", "Dongguan Precision Motors", "Maritime (CMA CGM)", d("2026-09-01"), d("2026-10-20"), null, "En mer"],
  ["PO-2026-036", "Ningbo Packaging Ltd", "Maritime (COSCO)", d("2026-08-10"), d("2026-09-18"), null, "Retard douane"],
  ["PO-2026-038", "Guangzhou Battery Tech", "Aérien (fret)", d("2026-09-20"), d("2026-09-29"), null, "Production"],
  ["PO-2026-029", "Xiamen Mold Factory", "DHL Express", d("2026-07-20"), d("2026-07-28"), d("2026-07-29"), "Livré"],
];

const fournisseurs: Ligne[] = [
  ["Fournisseur", "Ville", "Contact", "Produits", "Conditions de paiement"],
  ["Shenzhen Wingtech Co.", "Shenzhen", "Mme Li", "Ailes, empennages", "30 % commande / 70 % avant départ"],
  ["Dongguan Precision Motors", "Dongguan", "M. Chen", "Micro-moteurs", "30 % / 70 %"],
  ["Ningbo Packaging Ltd", "Ningbo", "M. Wang", "Emballages", "100 % à la commande"],
  ["Guangzhou Battery Tech", "Canton", "Mme Zhao", "Batteries", "50 % / 50 %"],
  ["Xiamen Mold Factory", "Xiamen", "M. Huang", "Moules d'injection", "100 % à la livraison"],
];

function classeur(pai: Ligne[], liv: Ligne[]) {
  const wb = XLSX.utils.book_new();
  // Titre + ligne vide avant les en-têtes : teste la détection automatique
  const f1 = XLSX.utils.aoa_to_sheet([["Suivi fournisseurs Chine — paiements 2026"], [], ENTETES_PAIEMENTS, ...pai], {
    cellDates: true,
  });
  f1["!cols"] = [8, 26, 13, 24, 13, 10, 7, 12, 12, 12].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, f1, "PO & paiements");
  const f2 = XLSX.utils.aoa_to_sheet([ENTETES_LIVRAISONS, ...liv], { cellDates: true });
  f2["!cols"] = [13, 26, 20, 16, 16, 16, 14].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, f2, "Livraisons");
  const f3 = XLSX.utils.aoa_to_sheet(fournisseurs);
  f3["!cols"] = [26, 12, 10, 20, 34].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, f3, "Fournisseurs");
  return wb;
}

function versDonnees(wb: XLSX.WorkBook) {
  const relu = XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer", cellDates: true });
  return normaliserClasseur(
    relu.SheetNames.map((nom) => ({
      nom,
      lignes: XLSX.utils.sheet_to_json<unknown[]>(relu.Sheets[nom], { header: 1, raw: true, defval: null }),
    })),
  );
}

// Version actuelle
const actuel = classeur(paiements, livraisons);
const octets = XLSX.write(actuel, { type: "buffer", bookType: "xlsx", compression: true }) as Buffer;
writeFileSync("fixtures/suivi_chine_exemple.xlsx", octets);
writeFileSync(
  "supabase/functions/sync-chine/fixture.ts",
  `// Généré par scripts/generer-fixture-chine.ts — ne pas modifier à la main.\n// Classeur d'exemple du mode démo (données fictives).\nexport const FIXTURE_XLSX_BASE64 =\n  "${octets.toString("base64")}";\n`,
);

// Version de la semaine dernière : PAY-109 n'existait pas, PAY-106 pas encore payé, livraison PO-2026-036 plus optimiste
const paiementsAvant = paiements
  .filter((l) => l[0] !== "PAY-109")
  .map((l) => (l[0] === "PAY-106" ? [...l.slice(0, 8), null, "À payer"] : l));
const livraisonsAvant = livraisons.map((l) =>
  l[0] === "PO-2026-036" ? [...l.slice(0, 4), d("2026-09-12"), null, "En mer"] : l,
);
const avant = versDonnees(classeur(paiementsAvant, livraisonsAvant));

const mapping: MappingChine = {
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
        fournisseur: "Fournisseur",
        livraison_prevue: "Livraison prévue",
        livraison_reelle: "Livraison réelle",
        statut: "Statut",
      },
    },
  ],
};

const sql = (v: unknown) => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
writeFileSync(
  "supabase/seeds/chine.sql",
  `-- Généré par scripts/generer-fixture-chine.ts — données de DÉMONSTRATION (local uniquement).
-- Snapshot « semaine dernière » du fichier d'exemple + mapping de démo, pour voir KPI, alertes et historique.
insert into public.chine_snapshots (taken_at, hash, source, data)
values (now() - interval '6 days', 'demo-semaine-derniere', 'mock', ${sql(avant)});

update public.chine_source
set mapping = ${sql(mapping)}, last_sync_at = now() - interval '6 days', last_hash = 'demo-semaine-derniere', derniere_source = 'mock';
`,
);
console.log(
  `Fixture générée (${octets.length} octets) : ${versDonnees(actuel)
    .onglets.map((o) => `${o.nom} (${o.lignes.length} lignes)`)
    .join(", ")}`,
);
