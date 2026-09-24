import { describe, expect, it } from "vitest";
import { construireRapport, rendreMarkdown, type EntreeRapport, type TacheRapport } from "@shared/rapport.ts";
import type { DonneesChine } from "@shared/chine.ts";

const D = { com: "d-com", compta: "d-compta", prod: "d-prod" };
const LUCAS = "u-lucas";
const EDWIN = "u-edwin";

let n = 0;
function tache(c: Partial<TacheRapport>): TacheRapport {
  n++;
  return {
    id: `t${n}`,
    titre: `Tâche ${n}`,
    statut: "a_faire",
    domaine_id: D.com,
    projet_id: null,
    echeance: null,
    priorite: "normale",
    en_attente_de: null,
    assigne_a: LUCAS,
    cree_par: LUCAS,
    done_at: null,
    created_at: "2026-09-01T08:00:00Z",
    deleted_at: null,
    ...c,
  };
}

function entree(taches: TacheRapport[], extra: Partial<EntreeRapport> = {}): EntreeRapport {
  return {
    type: "hebdo",
    periode: { debut: "2026-09-21", fin: "2026-09-27" },
    aujourdhui: "2026-09-25",
    genereLe: "2026-09-25T15:00:00Z",
    filtres: {},
    domaines: [
      { id: D.com, nom: "Commercial", couleur: "#2F5D7C", ordre: 1 },
      { id: D.compta, nom: "Compta", couleur: "#2E7D4F", ordre: 3 },
      { id: D.prod, nom: "Production", couleur: "#6B5B3E", ordre: 6 },
    ],
    projets: [
      { id: "p-swift", nom: "Swift", statut: "actif" },
      { id: "p-old", nom: "Ancien", statut: "archive" },
    ],
    membres: [
      { user_id: LUCAS, nom: "Lucas" },
      { user_id: EDWIN, nom: "Edwin" },
    ],
    taches,
    journal: [],
    process: [],
    documents: [],
    chine: null,
    ...extra,
  };
}

describe("agrégation des rapports", () => {
  it("compte le réalisé sur la période en heure de Paris", () => {
    const r = construireRapport(
      entree([
        // Dimanche 20/09 23:30 Paris = 21:30 UTC → hors période
        tache({ statut: "fait", done_at: "2026-09-20T21:30:00Z" }),
        // Lundi 21/09 00:30 Paris = 20/09 22:30 UTC → dans la période
        tache({ statut: "fait", done_at: "2026-09-20T22:30:00Z", titre: "Lundi tôt" }),
        tache({ statut: "fait", done_at: "2026-09-24T10:00:00Z", domaine_id: D.compta, titre: "TVA" }),
        // Dimanche 27/09 23:59 Paris → dans la période
        tache({ statut: "fait", done_at: "2026-09-27T21:59:00Z", domaine_id: D.prod }),
        // Lundi 28/09 00:01 Paris → hors période
        tache({ statut: "fait", done_at: "2026-09-27T22:01:00Z" }),
        // supprimée → ignorée
        tache({ statut: "fait", done_at: "2026-09-24T10:00:00Z", deleted_at: "2026-09-24T11:00:00Z" }),
      ]),
    );
    expect(r.compteurs.realisees).toBe(3);
    expect(r.realise_par_domaine.map((g) => [g.domaine, g.taches.length])).toEqual([
      ["Commercial", 1],
      ["Compta", 1],
      ["Production", 1],
    ]);
    expect(r.realise_par_domaine[0].taches[0]).toMatchObject({
      titre: "Lundi tôt",
      done_le: "2026-09-21",
      qui: "Lucas",
    });
  });

  it("liste en cours, en attente (avec « en attente de »), en retard et à venir", () => {
    const r = construireRapport(
      entree([
        tache({ statut: "en_cours", echeance: "2026-09-30", titre: "Site web" }),
        tache({ statut: "en_attente", en_attente_de: "Usine de Shenzhen", assigne_a: EDWIN, titre: "Échantillons" }),
        tache({ echeance: "2026-09-20", priorite: "urgente", titre: "Relance" }),
        tache({ echeance: "2026-09-25", titre: "Aujourd'hui" }),
        tache({ echeance: "2026-10-02", titre: "J+7" }),
        tache({ echeance: "2026-10-03", titre: "J+8" }),
        tache({ echeance: "2026-10-25", titre: "J+30" }),
        tache({ echeance: "2026-10-26", titre: "J+31" }),
        tache({ echeance: "2026-09-10", projet_id: "p-old", titre: "Projet archivé" }),
      ]),
    );
    expect(r.en_cours.map((t) => t.titre)).toEqual(["Site web"]);
    expect(r.en_attente[0]).toMatchObject({ titre: "Échantillons", en_attente_de: "Usine de Shenzhen", qui: "Edwin" });
    expect(r.en_retard.map((t) => [t.titre, t.jours_retard, t.urgente])).toEqual([["Relance", 5, true]]);
    expect(r.a_venir.j7.map((t) => t.titre)).toEqual(["Aujourd'hui", "Site web", "J+7"]);
    expect(r.a_venir.j30.map((t) => t.titre)).toEqual(["J+8", "J+30"]);
  });

  it("applique les filtres domaines et projets", () => {
    const taches = [
      tache({ statut: "fait", done_at: "2026-09-22T10:00:00Z", domaine_id: D.com, projet_id: "p-swift" }),
      tache({ statut: "fait", done_at: "2026-09-22T10:00:00Z", domaine_id: D.compta }),
    ];
    expect(construireRapport(entree(taches, { filtres: { domaines: [D.compta] } })).compteurs.realisees).toBe(1);
    const r = construireRapport(entree(taches, { filtres: { projets: ["p-swift"] } }));
    expect(r.compteurs.realisees).toBe(1);
    expect(r.filtres.projets).toEqual(["Swift"]);
  });

  it("distingue process créés et modifiés d'après le journal", () => {
    const r = construireRapport(
      entree([], {
        process: [
          { id: "p1", titre: "Paiement Chine", domaine_id: D.compta, statut: "actif", deleted_at: null },
          { id: "p2", titre: "Onboarding", domaine_id: null, statut: "brouillon", deleted_at: null },
          { id: "p3", titre: "Supprimé", domaine_id: null, statut: "actif", deleted_at: "2026-09-23T00:00:00Z" },
        ],
        journal: [
          { entite: "process", entite_id: "p1", action: "modifie", at: "2026-09-22T09:00:00Z", user_id: LUCAS },
          { entite: "process", entite_id: "p2", action: "cree", at: "2026-09-23T09:00:00Z", user_id: LUCAS },
          { entite: "process", entite_id: "p2", action: "modifie", at: "2026-09-23T10:00:00Z", user_id: LUCAS },
          { entite: "process", entite_id: "p3", action: "modifie", at: "2026-09-22T09:00:00Z", user_id: LUCAS },
          { entite: "process", entite_id: "p1", action: "modifie", at: "2026-09-10T09:00:00Z", user_id: LUCAS },
        ],
      }),
    );
    expect(r.process).toEqual([
      { titre: "Onboarding", domaine: "Sans domaine", action: "créé", statut: "brouillon" },
      { titre: "Paiement Chine", domaine: "Compta", action: "modifié", statut: "actif" },
    ]);
    expect(r.compteurs).toMatchObject({ process_crees: 1, process_modifies: 1 });
  });

  it("intègre les évolutions et échéances du suivi Chine", () => {
    const onglet = (lignes: (string | number | null)[][]) => ({
      nom: "Paiements",
      ligneEntete: 0,
      entetes: ["Réf", "Fournisseur", "Montant", "Devise", "Échéance", "Statut"],
      lignes,
    });
    const avant: DonneesChine = { onglets: [onglet([["A1", "Wingtech", 1000, "USD", "2026-09-30", "À payer"]])] };
    const apres: DonneesChine = {
      onglets: [
        onglet([
          ["A1", "Wingtech", 1000, "USD", "2026-09-30", "Payé"],
          ["A2", "Ningbo", 500, "EUR", "2026-10-05", "À payer"],
        ]),
      ],
    };
    const r = construireRapport(
      entree([], {
        chine: {
          avant,
          apres,
          avantLe: "2026-09-20T10:00:00Z",
          apresLe: "2026-09-25T10:00:00Z",
          mapping: {
            onglets: [
              {
                onglet: "Paiements",
                colonnes: {
                  fournisseur: "Fournisseur",
                  montant: "Montant",
                  devise: "Devise",
                  date_echeance: "Échéance",
                  statut: "Statut",
                },
              },
            ],
          },
        },
      }),
    );
    expect(r.chine.disponible).toBe(true);
    expect(r.chine.evolutions).toMatchObject({ ajoutees: 1, modifiees: 1, supprimees: 0 });
    expect(r.chine.evolutions!.details[0].exemples).toEqual(["+ A2", "~ A1 (Statut)"]);
    expect(r.chine.echeances).toEqual([
      { fournisseur: "Ningbo", po: null, montant: 500, devise: "EUR", date: "2026-10-05", en_retard: false },
    ]);
    expect(r.chine.kpi.find((k) => k.devise === "USD")).toMatchObject({ engage: 1000, paye: 1000, reste: 0 });
  });

  it("signale l'absence de données Chine sans échouer", () => {
    const r = construireRapport(entree([]));
    expect(r.chine.disponible).toBe(false);
    expect(r.chine.message).toContain("Aucune donnée");
  });

  it("rend un Markdown complet même sans synthèse IA", () => {
    const r = construireRapport(
      entree([tache({ statut: "fait", done_at: "2026-09-22T10:00:00Z", titre: "Facture salon" })]),
    );
    const md = rendreMarkdown(r, null);
    for (const titre of [
      "## Synthèse",
      "## Réalisé par domaine",
      "## En cours et en attente",
      "## En retard",
      "## Chine",
      "## Process créés ou modifiés",
      "## Documents ajoutés",
      "## À venir",
    ]) {
      expect(md).toContain(titre);
    }
    expect(md).toContain("Facture salon");
    expect(md).toContain("Synthèse rédigée indisponible");
    expect(rendreMarkdown(r, "Semaine calme.")).toContain("Semaine calme.");
  });
});
