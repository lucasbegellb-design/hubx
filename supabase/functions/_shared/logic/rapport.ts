// Rapports : agrégation déterministe des chiffres (aucune IA ici) et rendu Markdown.
// L'IA ne rédige que la synthèse, à partir du JSON produit par construireRapport().
import {
  appliquerMapping,
  calculerAlertes,
  calculerKpi,
  diffSnapshots,
  type DonneesChine,
  type KpiDevise,
  type MappingChine,
} from "./chine.ts";
import { ajouterJours, bornesInstant, dateParis, type Periode } from "./dates.ts";
import { joursDeRetard } from "./echeances.ts";

export type TypeRapport = "demande" | "hebdo" | "mensuel";

export interface TacheRapport {
  id: string;
  titre: string;
  statut: string;
  domaine_id: string | null;
  projet_id: string | null;
  echeance: string | null;
  priorite: string;
  en_attente_de: string | null;
  assigne_a: string | null;
  cree_par: string | null;
  done_at: string | null;
  created_at: string;
  deleted_at: string | null;
}

export interface JournalRapport {
  entite: string;
  entite_id: string;
  action: string;
  at: string;
  user_id: string | null;
}

export interface EntreeRapport {
  type: TypeRapport;
  periode: Periode;
  aujourdhui: string;
  genereLe: string;
  filtres: { domaines?: string[]; projets?: string[] };
  domaines: { id: string; nom: string; couleur: string; ordre: number }[];
  projets: { id: string; nom: string; statut: string }[];
  membres: { user_id: string; nom: string }[];
  taches: TacheRapport[];
  journal: JournalRapport[];
  process: { id: string; titre: string; domaine_id: string | null; statut: string; deleted_at: string | null }[];
  documents: { id: string; nom: string; categorie: string | null; domaine_id: string | null; projet_id: string | null; created_at: string; deleted_at: string | null }[];
  chine: { avant: DonneesChine | null; apres: DonneesChine | null; avantLe: string | null; apresLe: string | null; mapping: MappingChine } | null;
}

export interface TacheResumee {
  titre: string;
  domaine: string;
  projet: string | null;
  qui: string | null;
  statut?: string;
  en_attente_de?: string | null;
  echeance?: string | null;
  done_le?: string | null;
  jours_retard?: number;
  urgente?: boolean;
}

export interface DonneesRapport {
  version: 1;
  type: TypeRapport;
  periode: Periode;
  genere_le: string;
  filtres: { domaines: string[]; projets: string[] };
  compteurs: {
    realisees: number;
    creees: number;
    en_cours: number;
    en_attente: number;
    en_retard: number;
    process_crees: number;
    process_modifies: number;
    documents_ajoutes: number;
    a_venir_7j: number;
    a_venir_30j: number;
  };
  realise_par_domaine: { domaine: string; couleur: string; taches: TacheResumee[] }[];
  en_cours: TacheResumee[];
  en_attente: TacheResumee[];
  en_retard: TacheResumee[];
  chine: {
    disponible: boolean;
    message: string | null;
    versions: { du: string | null; au: string | null };
    evolutions: { ajoutees: number; modifiees: number; supprimees: number; details: { onglet: string; ajoutees: number; modifiees: number; supprimees: number; exemples: string[] }[] } | null;
    kpi: KpiDevise[];
    echeances: { fournisseur: string | null; po: string | null; montant: number | null; devise: string; date: string; en_retard: boolean }[];
    livraisons_en_retard: { fournisseur: string | null; po: string | null; prevue: string; jours: number }[];
  };
  process: { titre: string; domaine: string; action: "créé" | "modifié"; statut: string }[];
  documents: { nom: string; categorie: string | null; domaine: string; ajoute_le: string }[];
  a_venir: { j7: TacheResumee[]; j30: TacheResumee[] };
}

const SANS_DOMAINE = "Sans domaine";

export function construireRapport(e: EntreeRapport): DonneesRapport {
  const domaines = new Map(e.domaines.map((d) => [d.id, d]));
  const projets = new Map(e.projets.map((p) => [p.id, p]));
  const membres = new Map(e.membres.map((m) => [m.user_id, m.nom]));
  const { depuis, jusqua } = bornesInstant(e.periode);
  const dans = (instant: string | null) => Boolean(instant) && instant! >= depuis && instant! < jusqua;
  const filtreDomaines = e.filtres.domaines?.length ? new Set(e.filtres.domaines) : null;
  const filtreProjets = e.filtres.projets?.length ? new Set(e.filtres.projets) : null;

  const garde = (domaineId: string | null, projetId: string | null) =>
    (!filtreDomaines || (domaineId !== null && filtreDomaines.has(domaineId))) && (!filtreProjets || (projetId !== null && filtreProjets.has(projetId)));

  const nomDomaine = (id: string | null) => (id && domaines.get(id)?.nom) || SANS_DOMAINE;
  const resumer = (t: TacheRapport): TacheResumee => ({
    titre: t.titre,
    domaine: nomDomaine(t.domaine_id),
    projet: (t.projet_id && projets.get(t.projet_id)?.nom) || null,
    qui: membres.get(t.assigne_a ?? "") ?? membres.get(t.cree_par ?? "") ?? null,
  });

  const taches = e.taches.filter((t) => !t.deleted_at && garde(t.domaine_id, t.projet_id));
  // Les projets archivés sortent des vues « en cours » et des alertes, mais le travail réalisé reste compté.
  const actives = taches.filter((t) => t.statut !== "fait" && !(t.projet_id && projets.get(t.projet_id)?.statut === "archive"));

  // Réalisé par domaine (ordre des domaines, « Sans domaine » à la fin)
  const faites = taches.filter((t) => t.statut === "fait" && dans(t.done_at)).sort((a, b) => (a.done_at! < b.done_at! ? -1 : 1));
  const groupes = new Map<string, TacheResumee[]>();
  for (const t of faites) {
    const k = t.domaine_id ?? "";
    groupes.set(k, [...(groupes.get(k) ?? []), { ...resumer(t), done_le: dateParis(t.done_at!) }]);
  }
  const realise_par_domaine = [...groupes.entries()]
    .sort(([a], [b]) => (domaines.get(a)?.ordre ?? 999) - (domaines.get(b)?.ordre ?? 999))
    .map(([id, ts]) => ({ domaine: nomDomaine(id || null), couleur: domaines.get(id)?.couleur ?? "#5E6B78", taches: ts }));

  const parEcheance = (a: TacheRapport, b: TacheRapport) => (a.echeance ?? "9999") < (b.echeance ?? "9999") ? -1 : 1;
  const en_cours = actives.filter((t) => t.statut === "en_cours").sort(parEcheance).map((t) => ({ ...resumer(t), echeance: t.echeance }));
  const en_attente = actives
    .filter((t) => t.statut === "en_attente")
    .sort(parEcheance)
    .map((t) => ({ ...resumer(t), en_attente_de: t.en_attente_de, echeance: t.echeance }));
  const en_retard = actives
    .filter((t) => t.echeance && t.echeance < e.aujourdhui)
    .sort(parEcheance)
    .map((t) => ({ ...resumer(t), statut: t.statut, echeance: t.echeance, jours_retard: joursDeRetard(t.echeance!, e.aujourdhui), urgente: t.priorite === "urgente" }));

  const j7 = ajouterJours(e.aujourdhui, 7);
  const j30 = ajouterJours(e.aujourdhui, 30);
  const aVenir = (de: string, a: string, inclureDebut: boolean) =>
    actives
      .filter((t) => t.echeance && (inclureDebut ? t.echeance >= de : t.echeance > de) && t.echeance <= a)
      .sort(parEcheance)
      .map((t) => ({ ...resumer(t), echeance: t.echeance, urgente: t.priorite === "urgente" }));

  // Process : créés ou modifiés pendant la période (d'après le journal)
  const processInfos = new Map(e.process.map((p) => [p.id, p]));
  const processActions = new Map<string, "créé" | "modifié">();
  for (const j of e.journal.filter((j) => j.entite === "process" && dans(j.at))) {
    if (j.action === "cree") processActions.set(j.entite_id, "créé");
    else if (j.action !== "supprime" && !processActions.has(j.entite_id)) processActions.set(j.entite_id, "modifié");
  }
  const process = [...processActions.entries()]
    .map(([id, action]) => ({ p: processInfos.get(id), action }))
    .filter((x) => x.p && !x.p.deleted_at && (!filtreDomaines || (x.p.domaine_id !== null && filtreDomaines.has(x.p.domaine_id))))
    .map((x) => ({ titre: x.p!.titre, domaine: nomDomaine(x.p!.domaine_id), action: x.action, statut: x.p!.statut }))
    .sort((a, b) => a.titre.localeCompare(b.titre, "fr"));

  const documents = e.documents
    .filter((d) => !d.deleted_at && dans(d.created_at) && garde(d.domaine_id, d.projet_id))
    .sort((a, b) => (a.created_at < b.created_at ? -1 : 1))
    .map((d) => ({ nom: d.nom, categorie: d.categorie, domaine: nomDomaine(d.domaine_id), ajoute_le: dateParis(d.created_at) }));

  const chine = rapportChine(e);
  const a7 = aVenir(e.aujourdhui, j7, true);
  const a30 = aVenir(j7, j30, false);

  return {
    version: 1,
    type: e.type,
    periode: e.periode,
    genere_le: e.genereLe,
    filtres: {
      domaines: (e.filtres.domaines ?? []).map((id) => domaines.get(id)?.nom ?? "?"),
      projets: (e.filtres.projets ?? []).map((id) => projets.get(id)?.nom ?? "?"),
    },
    compteurs: {
      realisees: faites.length,
      creees: taches.filter((t) => dans(t.created_at)).length,
      en_cours: en_cours.length,
      en_attente: en_attente.length,
      en_retard: en_retard.length,
      process_crees: process.filter((p) => p.action === "créé").length,
      process_modifies: process.filter((p) => p.action === "modifié").length,
      documents_ajoutes: documents.length,
      a_venir_7j: a7.length,
      a_venir_30j: a30.length,
    },
    realise_par_domaine,
    en_cours,
    en_attente,
    en_retard,
    chine,
    process,
    documents,
    a_venir: { j7: a7, j30: a30 },
  };
}

function rapportChine(e: EntreeRapport): DonneesRapport["chine"] {
  const vide = { versions: { du: null, au: null }, evolutions: null, kpi: [], echeances: [], livraisons_en_retard: [] };
  if (!e.chine || !e.chine.apres) return { disponible: false, message: "Aucune donnée du suivi Chine sur la période.", ...vide };
  const { avant, apres, mapping } = e.chine;
  let evolutions: DonneesRapport["chine"]["evolutions"] = null;
  if (avant) {
    const d = diffSnapshots(avant, apres, mapping);
    evolutions = {
      ...d.totaux,
      details: d.onglets.map((o) => {
        const i = o.colonneCle ? o.entetes.indexOf(o.colonneCle) : 0;
        const nom = (l: (string | number | boolean | null)[]) => String(l[i] ?? l.find((c) => c !== null) ?? "?");
        return {
          onglet: o.onglet,
          ajoutees: o.ajoutees.length,
          modifiees: o.modifiees.length,
          supprimees: o.supprimees.length,
          exemples: [
            ...o.ajoutees.slice(0, 3).map((l) => `+ ${nom(l)}`),
            ...o.modifiees.slice(0, 3).map((m) => `~ ${m.cle} (${m.colonnes.join(", ")})`),
            ...o.supprimees.slice(0, 2).map((l) => `− ${nom(l)}`),
          ],
        };
      }),
    };
  }
  const lignes = mapping.onglets.length ? appliquerMapping(apres, mapping) : [];
  const alertes = calculerAlertes(lignes, e.aujourdhui, 30);
  return {
    disponible: true,
    message: mapping.onglets.length ? null : "Mapping des colonnes non configuré : échéances et montants indisponibles.",
    versions: { du: e.chine.avantLe, au: e.chine.apresLe },
    evolutions,
    kpi: calculerKpi(lignes, e.aujourdhui).parDevise,
    echeances: alertes.paiementsDus.map((l) => ({ fournisseur: l.fournisseur, po: l.po, montant: l.montant, devise: l.devise, date: l.date_echeance!, en_retard: l.enRetard })),
    livraisons_en_retard: alertes.livraisonsEnRetard.map((l) => ({ fournisseur: l.fournisseur, po: l.po, prevue: l.livraison_prevue!, jours: l.joursRetard })),
  };
}

// ---------------------------------------------------------------------------
// Rendu Markdown (déterministe)
// ---------------------------------------------------------------------------

const MOIS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
export function dateFr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return `${j} ${MOIS[m - 1]} ${a}`;
}

export function montantFr(v: number | null, devise: string): string {
  if (v === null) return "";
  const n = v.toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/\u202f|\u00a0/g, " ");
  return `${n} ${devise}`.trim();
}

export const TITRES_RAPPORT: Record<TypeRapport, string> = {
  demande: "Rapport d'activité",
  hebdo: "Rapport hebdomadaire",
  mensuel: "Rapport mensuel",
};

const ligneTache = (t: TacheResumee, extra = "") =>
  `- ${t.urgente ? "**Urgent** — " : ""}${t.titre}${t.projet ? ` (${t.projet})` : ""}${t.qui ? ` — ${t.qui}` : ""}${extra}`;

export function rendreMarkdown(d: DonneesRapport, synthese: string | null): string {
  const s: string[] = [];
  s.push(`# ${TITRES_RAPPORT[d.type]} — XTIM`);
  s.push(`Période du ${dateFr(d.periode.debut)} au ${dateFr(d.periode.fin)} · généré le ${dateFr(d.genere_le)}`);
  if (d.filtres.domaines.length || d.filtres.projets.length) {
    s.push(`Filtres : ${[...d.filtres.domaines, ...d.filtres.projets].join(", ")}`);
  }

  s.push("## Synthèse");
  s.push(synthese?.trim() || "_Synthèse rédigée indisponible (IA non configurée). Les chiffres ci-dessous sont complets._");
  const c = d.compteurs;
  s.push(
    `**${c.realisees}** tâche(s) réalisée(s) · **${c.creees}** créée(s) · **${c.en_cours}** en cours · **${c.en_attente}** en attente · **${c.en_retard}** en retard`,
  );

  s.push("## Réalisé par domaine");
  if (!d.realise_par_domaine.length) s.push("_Aucune tâche terminée sur la période._");
  for (const g of d.realise_par_domaine) {
    s.push(`### ${g.domaine} (${g.taches.length})`);
    s.push(g.taches.map((t) => ligneTache(t, t.done_le ? ` · ${dateFr(t.done_le)}` : "")).join("\n"));
  }

  s.push("## En cours et en attente");
  if (!d.en_cours.length && !d.en_attente.length) s.push("_Rien en cours ni en attente._");
  if (d.en_cours.length) s.push("**En cours**\n" + d.en_cours.map((t) => ligneTache(t, t.echeance ? ` · échéance ${dateFr(t.echeance)}` : "")).join("\n"));
  if (d.en_attente.length)
    s.push("**En attente**\n" + d.en_attente.map((t) => ligneTache(t, t.en_attente_de ? ` · en attente de ${t.en_attente_de}` : "")).join("\n"));

  s.push("## En retard");
  s.push(d.en_retard.length ? d.en_retard.map((t) => ligneTache(t, ` · échéance ${dateFr(t.echeance)} (${t.jours_retard} j)`)).join("\n") : "_Aucune tâche en retard._");

  s.push("## Chine");
  if (!d.chine.disponible) s.push(`_${d.chine.message}_`);
  else {
    if (d.chine.evolutions) {
      const ev = d.chine.evolutions;
      s.push(`Évolutions du fichier : ${ev.ajoutees} ligne(s) ajoutée(s), ${ev.modifiees} modifiée(s), ${ev.supprimees} supprimée(s).`);
      for (const o of ev.details) s.push(`- **${o.onglet}** : ${o.exemples.join(" ; ")}`);
    } else s.push("_Pas de version antérieure pour mesurer les évolutions._");
    if (d.chine.message) s.push(`_${d.chine.message}_`);
    if (d.chine.kpi.length) s.push(d.chine.kpi.map((k) => `- ${k.devise} : engagé ${montantFr(k.engage, k.devise)}, payé ${montantFr(k.paye, k.devise)}, reste ${montantFr(k.reste, k.devise)}`).join("\n"));
    if (d.chine.echeances.length) {
      s.push("**Échéances de paiement (30 jours)**");
      s.push(d.chine.echeances.map((x) => `- ${dateFr(x.date)}${x.en_retard ? " (en retard)" : ""} — ${x.fournisseur ?? "?"}${x.po ? ` ${x.po}` : ""} : ${montantFr(x.montant, x.devise)}`).join("\n"));
    }
    if (d.chine.livraisons_en_retard.length) {
      s.push("**Livraisons en retard**");
      s.push(d.chine.livraisons_en_retard.map((x) => `- ${x.po ?? "?"} ${x.fournisseur ?? ""} : prévue le ${dateFr(x.prevue)} (${x.jours} j)`).join("\n"));
    }
  }

  s.push("## Process créés ou modifiés");
  s.push(d.process.length ? d.process.map((p) => `- ${p.titre} (${p.domaine}) — ${p.action}`).join("\n") : "_Aucun._");

  s.push("## Documents ajoutés");
  s.push(d.documents.length ? d.documents.map((x) => `- ${x.nom}${x.categorie ? ` — ${x.categorie}` : ""} (${x.domaine}, ${dateFr(x.ajoute_le)})`).join("\n") : "_Aucun._");

  s.push("## À venir");
  s.push("**7 prochains jours**\n" + (d.a_venir.j7.length ? d.a_venir.j7.map((t) => ligneTache(t, ` · ${dateFr(t.echeance)}`)).join("\n") : "_Rien de prévu._"));
  s.push("**Jusqu'à 30 jours**\n" + (d.a_venir.j30.length ? d.a_venir.j30.map((t) => ligneTache(t, ` · ${dateFr(t.echeance)}`)).join("\n") : "_Rien de prévu._"));
  return s.join("\n\n") + "\n";
}

/** Consigne et données pour la synthèse rédigée par l'IA (3 à 5 lignes, sans invention). */
export function consigneSynthese(d: DonneesRapport): { system: string; donnees: string } {
  return {
    system:
      "Tu rédiges la synthèse d'un rapport d'activité interne de XTIM SAS (drones biomimétiques Bionic Bird) pour le gérant. " +
      "Écris 3 à 5 lignes en français, factuelles, au ton sobre et professionnel, sans titre ni liste. " +
      "Règle absolue : utilise uniquement les faits et chiffres présents dans le JSON fourni ; n'invente, n'extrapole et n'arrondis rien. " +
      "Mets en avant le travail réalisé, les points bloquants (retards, attentes), et les échéances importantes à venir (dont les paiements Chine s'il y en a). " +
      "Si le JSON est presque vide, dis-le simplement.",
    donnees: JSON.stringify(d),
  };
}
