// Suivi Chine : normalisation du classeur, mapping des colonnes, KPI, alertes et comparaison de snapshots.
// Module pur, partagé entre l'Edge Function sync-chine, le client et les rapports.
import { ajouterJours } from "./dates.ts";

export type Cellule = string | number | boolean | null;

export interface Onglet {
  nom: string;
  /** Index (0-based) de la ligne d'en-tête dans la feuille d'origine. */
  ligneEntete: number;
  entetes: string[];
  lignes: Cellule[][];
}

export interface DonneesChine {
  onglets: Onglet[];
}

// ---------------------------------------------------------------------------
// Normalisation
// ---------------------------------------------------------------------------

function versIsoDate(d: Date): string {
  // SheetJS renvoie des dates « locales » : on garde la date calendaire affichée dans Excel.
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function normaliserCellule(v: unknown): Cellule {
  if (v === undefined || v === null) return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? null : versIsoDate(v);
  if (typeof v === "string") {
    const t = v.replace(/\s+/g, " ").trim();
    return t === "" ? null : t;
  }
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 1e6) / 1e6 : null;
  if (typeof v === "boolean") return v;
  return String(v);
}

const estVide = (c: Cellule) => c === null || c === "";

/**
 * Détecte la ligne d'en-tête : parmi les 15 premières lignes, celle qui contient le plus de
 * libellés textuels (au moins 2) et qui est suivie d'au moins une ligne de données.
 */
export function detecterEntete(lignes: Cellule[][]): number {
  let meilleure = -1;
  let score = 1;
  const limite = Math.min(lignes.length - 1, 15);
  for (let i = 0; i < limite; i++) {
    const textes = lignes[i].filter((c) => typeof c === "string" && !/^\d+([.,]\d+)?$/.test(c)).length;
    const remplis = lignes[i].filter((c) => !estVide(c)).length;
    // Une ligne de titre isolée (1 cellule) n'est pas un en-tête
    if (textes >= 2 && textes > score && textes >= remplis * 0.6) {
      meilleure = i;
      score = textes;
    }
  }
  return meilleure === -1 ? 0 : meilleure;
}

function entetesUniques(brut: Cellule[], largeur: number): string[] {
  const vus = new Map<string, number>();
  return Array.from({ length: largeur }, (_, i) => {
    const base = estVide(brut[i] ?? null) ? `Colonne ${i + 1}` : String(brut[i]);
    const n = (vus.get(base) ?? 0) + 1;
    vus.set(base, n);
    return n > 1 ? `${base} (${n})` : base;
  });
}

/** Convertit les feuilles brutes (tableaux de cellules) en onglets propres avec en-têtes détectés. */
export function normaliserClasseur(feuilles: { nom: string; lignes: unknown[][] }[]): DonneesChine {
  const onglets: Onglet[] = [];
  for (const f of feuilles) {
    const lignes = f.lignes.map((l) => (Array.isArray(l) ? l.map(normaliserCellule) : []));
    if (!lignes.some((l) => l.some((c) => !estVide(c)))) continue; // onglet vide
    const iEntete = detecterEntete(lignes);
    const donnees = lignes.slice(iEntete + 1).filter((l) => l.some((c) => !estVide(c)));
    let largeur = Math.max(lignes[iEntete]?.length ?? 0, ...donnees.map((l) => l.length));
    // Retire les colonnes vides en fin de tableau
    while (largeur > 0 && estVide(lignes[iEntete]?.[largeur - 1] ?? null) && donnees.every((l) => estVide(l[largeur - 1] ?? null))) {
      largeur--;
    }
    onglets.push({
      nom: f.nom,
      ligneEntete: iEntete,
      entetes: entetesUniques(lignes[iEntete] ?? [], largeur),
      lignes: donnees.map((l) => Array.from({ length: largeur }, (_, i) => l[i] ?? null)),
    });
  }
  return { onglets };
}

// ---------------------------------------------------------------------------
// Mapping des colonnes
// ---------------------------------------------------------------------------

export const ROLES = [
  "fournisseur",
  "po",
  "montant",
  "devise",
  "date_echeance",
  "date_paiement",
  "statut",
  "livraison_prevue",
  "livraison_reelle",
] as const;
export type Role = (typeof ROLES)[number];

export const LIBELLES_ROLES: Record<Role, string> = {
  fournisseur: "Fournisseur",
  po: "N° PO",
  montant: "Montant",
  devise: "Devise",
  date_echeance: "Date d'échéance",
  date_paiement: "Date de paiement",
  statut: "Statut",
  livraison_prevue: "Livraison prévue",
  livraison_reelle: "Livraison réelle",
};

export interface MappingOnglet {
  onglet: string;
  colonnes: Partial<Record<Role, string>>;
}

export interface MappingChine {
  onglets: MappingOnglet[];
}

export function mappingVide(): MappingChine {
  return { onglets: [] };
}

/** Accepte l'ancien format « un seul onglet » comme le nouveau. */
export function lireMapping(brut: unknown): MappingChine {
  if (!brut || typeof brut !== "object") return mappingVide();
  const m = brut as Partial<MappingChine> & Partial<MappingOnglet>;
  if (Array.isArray(m.onglets)) return { onglets: m.onglets.filter((o) => o && typeof o.onglet === "string") };
  if (typeof m.onglet === "string") return { onglets: [{ onglet: m.onglet, colonnes: m.colonnes ?? {} }] };
  return mappingVide();
}

export function mappingConfigure(m: MappingChine): boolean {
  return m.onglets.some((o) => Object.values(o.colonnes).some(Boolean));
}

const INDICES_ROLES: Record<Role, RegExp> = {
  fournisseur: /fournisseur|supplier|vendor|usine|factory|fabricant/i,
  po: /(^|\b)(n°\s*)?po(\b|$)|purchase order|n° de commande|bon de commande/i,
  montant: /montant|amount|total|prix|price|valeur|value/i,
  devise: /devise|currency|monnaie/i,
  date_echeance: /[ée]ch[ée]ance|due|deadline|à payer le/i,
  date_paiement: /pay[ée] le|paid|date.*paiement|payment date|r[ée]gl[ée] le/i,
  statut: /statut|status|[ée]tat/i,
  livraison_prevue: /livraison pr[ée]vue|pr[ée]vu|eta\b|expected|planned|estimated/i,
  livraison_reelle: /livraison r[ée]elle|livr[ée] le|delivered|arriv[ée]e|actual|re[çc]u le/i,
};

/** Propose une colonne pour chaque rôle d'après les libellés d'en-tête. */
export function devinerColonnes(entetes: string[]): Partial<Record<Role, string>> {
  const res: Partial<Record<Role, string>> = {};
  const prises = new Set<string>();
  // Les rôles les plus spécifiques d'abord (« Livraison prévue » avant « Statut »…)
  const ordre: Role[] = ["livraison_prevue", "livraison_reelle", "date_paiement", "date_echeance", "devise", "po", "fournisseur", "montant", "statut"];
  for (const r of ordre) {
    const h = entetes.find((e) => !prises.has(e) && INDICES_ROLES[r].test(e));
    if (h) {
      res[r] = h;
      prises.add(h);
    }
  }
  return res;
}

/** Vérifie que les onglets et colonnes du mapping existent toujours (fichier renommé, etc.). */
export function validerMapping(d: DonneesChine, m: MappingChine): { valides: MappingOnglet[]; problemes: string[] } {
  const problemes: string[] = [];
  const valides: MappingOnglet[] = [];
  for (const mo of m.onglets) {
    const onglet = d.onglets.find((o) => o.nom === mo.onglet);
    if (!onglet) {
      problemes.push(`L'onglet « ${mo.onglet} » n'existe plus dans le fichier. Mets à jour le mapping dans Paramètres › Suivi Chine.`);
      continue;
    }
    const colonnes: Partial<Record<Role, string>> = {};
    for (const [role, col] of Object.entries(mo.colonnes) as [Role, string | undefined][]) {
      if (!col) continue;
      if (onglet.entetes.includes(col)) colonnes[role] = col;
      else problemes.push(`La colonne « ${col} » (${LIBELLES_ROLES[role]}) est introuvable dans l'onglet « ${mo.onglet} ».`);
    }
    valides.push({ onglet: mo.onglet, colonnes });
  }
  return { valides, problemes };
}

// ---------------------------------------------------------------------------
// Lecture des valeurs
// ---------------------------------------------------------------------------

/** « 12 500,00 € », « $1,234.50 », « USD 3,000 », 4250 → nombre. */
export function parserMontant(v: Cellule): number | null {
  if (typeof v === "number") return v;
  if (typeof v !== "string") return null;
  let t = v.replace(/[^\d,.\-\s']/g, "").replace(/[\s']/g, "");
  if (!/\d/.test(t)) return null;
  const virgule = t.lastIndexOf(",");
  const point = t.lastIndexOf(".");
  if (virgule > -1 && point > -1) {
    // Le dernier séparateur est le séparateur décimal
    t = virgule > point ? t.replace(/\./g, "").replace(",", ".") : t.replace(/,/g, "");
  } else if (virgule > -1) {
    // « 1,234 » (milliers anglais) vs « 12,5 » (décimale française)
    t = /,\d{3}$/.test(t) && t.split(",").length > 1 && !/^0,/.test(t) ? t.replace(/,/g, "") : t.replace(",", ".");
  } else if (point > -1 && /\.\d{3}$/.test(t) && t.split(".").length > 2) {
    t = t.replace(/\./g, "");
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Devise déduite d'un symbole dans un texte. */
export function deviseDepuisTexte(v: Cellule): string | null {
  if (typeof v !== "string") return null;
  const t = v.toUpperCase();
  if (/€|EUR/.test(t)) return "EUR";
  if (/¥|RMB|CNY|YUAN/.test(t)) return "CNY";
  if (/US\$|\$|USD/.test(t)) return "USD";
  if (/£|GBP/.test(t)) return "GBP";
  const code = /\b([A-Z]{3})\b/.exec(t);
  return code ? code[1] : null;
}

function serieExcelVersIso(n: number): string {
  const ms = Math.round((n - 25569) * 86_400_000);
  return new Date(ms).toISOString().slice(0, 10);
}

const MOIS_EN: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** « 2026-10-15 », « 15/10/2026 », « 15.10.26 », numéro de série Excel… → « YYYY-MM-DD ». */
export function parserDate(v: Cellule): string | null {
  if (typeof v === "number") return v > 20_000 && v < 80_000 ? serieExcelVersIso(v) : null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/.exec(t);
  if (m) {
    const annee = m[3].length === 2 ? `20${m[3]}` : m[3];
    const jour = Number(m[1]);
    const mois = Number(m[2]);
    if (mois > 12 || jour > 31) return null;
    return `${annee}-${String(mois).padStart(2, "0")}-${String(jour).padStart(2, "0")}`;
  }
  m = /^(\d{1,2})[\s-]([A-Za-z]{3})[a-z]*[\s-,]+(\d{4})$/.exec(t) ?? null;
  if (m && MOIS_EN[m[2].toLowerCase()]) return `${m[3]}-${String(MOIS_EN[m[2].toLowerCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/.exec(t);
  if (m && MOIS_EN[m[1].toLowerCase()]) return `${m[3]}-${String(MOIS_EN[m[1].toLowerCase()]).padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return null;
}

function texte(v: Cellule): string | null {
  return v === null || v === "" ? null : String(v);
}

const RE_NON_PAYE = /impay|non pay|unpaid|a payer|à payer|en attente|pending|due/i;
const RE_PAYE = /pay[ée]|paid|r[ée]gl[ée]|sold[ée]|vir[ée]|done|ok\b/i;
const RE_LIVRE = /livr[ée]|re[çc]u|delivered|received|arriv[ée]/i;

export interface LigneChine {
  onglet: string;
  index: number;
  fournisseur: string | null;
  po: string | null;
  montant: number | null;
  devise: string;
  date_echeance: string | null;
  date_paiement: string | null;
  statut: string | null;
  livraison_prevue: string | null;
  livraison_reelle: string | null;
  paye: boolean;
  livre: boolean;
}

/** Applique le mapping : une ligne typée par ligne de données des onglets mappés. */
export function appliquerMapping(d: DonneesChine, m: MappingChine): LigneChine[] {
  const { valides } = validerMapping(d, m);
  const res: LigneChine[] = [];
  for (const mo of valides) {
    const onglet = d.onglets.find((o) => o.nom === mo.onglet)!;
    const idx = (r: Role) => (mo.colonnes[r] ? onglet.entetes.indexOf(mo.colonnes[r]!) : -1);
    const i = Object.fromEntries(ROLES.map((r) => [r, idx(r)])) as Record<Role, number>;
    onglet.lignes.forEach((l, index) => {
      const val = (r: Role) => (i[r] >= 0 ? l[i[r]] : null);
      const statut = texte(val("statut"));
      const datePaiement = parserDate(val("date_paiement"));
      const livraisonReelle = parserDate(val("livraison_reelle"));
      const montantBrut = val("montant");
      const ligne: LigneChine = {
        onglet: onglet.nom,
        index,
        fournisseur: texte(val("fournisseur")),
        po: texte(val("po")),
        montant: parserMontant(montantBrut),
        devise: (texte(val("devise"))?.toUpperCase() ?? deviseDepuisTexte(montantBrut) ?? "").slice(0, 8),
        date_echeance: parserDate(val("date_echeance")),
        date_paiement: datePaiement,
        statut,
        livraison_prevue: parserDate(val("livraison_prevue")),
        livraison_reelle: livraisonReelle,
        paye: Boolean(datePaiement) || (statut ? !RE_NON_PAYE.test(statut) && RE_PAYE.test(statut) : false),
        livre: Boolean(livraisonReelle) || (statut ? RE_LIVRE.test(statut) : false),
      };
      // Ignore les lignes de total / vides pour le mapping
      if (ligne.fournisseur || ligne.po || ligne.montant !== null) res.push(ligne);
    });
  }
  return res;
}

// ---------------------------------------------------------------------------
// KPI et alertes
// ---------------------------------------------------------------------------

export interface KpiDevise {
  devise: string;
  engage: number;
  paye: number;
  reste: number;
  lignes: number;
}

export interface KpiChine {
  parDevise: KpiDevise[];
  prochainesEcheances: LigneChine[];
}

export function calculerKpi(lignes: LigneChine[], aujourdhui: string): KpiChine {
  const map = new Map<string, KpiDevise>();
  for (const l of lignes) {
    if (l.montant === null) continue;
    const cle = l.devise || "—";
    const k = map.get(cle) ?? { devise: cle, engage: 0, paye: 0, reste: 0, lignes: 0 };
    k.engage += l.montant;
    if (l.paye) k.paye += l.montant;
    else k.reste += l.montant;
    k.lignes++;
    map.set(cle, k);
  }
  const arrondi = (n: number) => Math.round(n * 100) / 100;
  const parDevise = [...map.values()]
    .map((k) => ({ ...k, engage: arrondi(k.engage), paye: arrondi(k.paye), reste: arrondi(k.reste) }))
    .sort((a, b) => b.engage - a.engage);
  const prochainesEcheances = lignes
    .filter((l) => !l.paye && l.date_echeance && l.date_echeance >= aujourdhui)
    .sort((a, b) => (a.date_echeance! < b.date_echeance! ? -1 : 1))
    .slice(0, 10);
  return { parDevise, prochainesEcheances };
}

export interface AlertesChine {
  /** Paiements non réglés dont l'échéance est dépassée ou tombe dans les `jours` prochains jours. */
  paiementsDus: (LigneChine & { enRetard: boolean })[];
  livraisonsEnRetard: (LigneChine & { joursRetard: number })[];
}

export function calculerAlertes(lignes: LigneChine[], aujourdhui: string, jours = 7): AlertesChine {
  const limite = ajouterJours(aujourdhui, jours);
  const jr = (d: string) => Math.round((Date.parse(aujourdhui) - Date.parse(d)) / 86_400_000);
  return {
    paiementsDus: lignes
      .filter((l) => !l.paye && l.date_echeance && l.date_echeance <= limite)
      .map((l) => ({ ...l, enRetard: l.date_echeance! < aujourdhui }))
      .sort((a, b) => (a.date_echeance! < b.date_echeance! ? -1 : 1)),
    livraisonsEnRetard: lignes
      .filter((l) => !l.livre && l.livraison_prevue && l.livraison_prevue < aujourdhui)
      .map((l) => ({ ...l, joursRetard: jr(l.livraison_prevue!) }))
      .sort((a, b) => b.joursRetard - a.joursRetard),
  };
}

// ---------------------------------------------------------------------------
// Comparaison de snapshots
// ---------------------------------------------------------------------------

export interface Modification {
  cle: string;
  avant: Cellule[];
  apres: Cellule[];
  colonnes: string[];
}

export interface DiffOnglet {
  onglet: string;
  entetes: string[];
  statut: "modifie" | "ajoute" | "supprime";
  colonneCle: string | null;
  ajoutees: Cellule[][];
  supprimees: Cellule[][];
  modifiees: Modification[];
}

export interface DiffChine {
  onglets: DiffOnglet[];
  totaux: { ajoutees: number; modifiees: number; supprimees: number };
}

const signature = (l: Cellule[]) => JSON.stringify(l);

/** Colonne identifiant une ligne : n° PO du mapping, sinon première colonne aux valeurs uniques. */
export function choisirColonneCle(avant: Onglet | undefined, apres: Onglet, m?: MappingChine): string | null {
  const unique = (o: Onglet, i: number) => {
    const vals = o.lignes.map((l) => l[i]);
    return vals.every((v) => !estVide(v)) && new Set(vals.map(String)).size === vals.length;
  };
  const mappee = m?.onglets.find((o) => o.onglet === apres.nom)?.colonnes.po;
  if (
    mappee &&
    apres.entetes.includes(mappee) &&
    unique(apres, apres.entetes.indexOf(mappee)) &&
    (!avant || (avant.entetes.includes(mappee) && unique(avant, avant.entetes.indexOf(mappee))))
  ) {
    return mappee;
  }
  for (let i = 0; i < apres.entetes.length; i++) {
    const nom = apres.entetes[i];
    if (!unique(apres, i)) continue;
    if (avant) {
      const j = avant.entetes.indexOf(nom);
      if (j === -1 || !unique(avant, j)) continue;
    }
    return nom;
  }
  return null;
}

function indexer(o: Onglet, colonne: string | null): Map<string, Cellule[]> {
  const map = new Map<string, Cellule[]>();
  const i = colonne ? o.entetes.indexOf(colonne) : -1;
  const occurrences = new Map<string, number>();
  for (const l of o.lignes) {
    const base = i >= 0 ? String(l[i]) : signature(l);
    const n = (occurrences.get(base) ?? 0) + 1;
    occurrences.set(base, n);
    map.set(n > 1 ? `${base}#${n}` : base, l);
  }
  return map;
}

/** Réaligne une ligne de l'ancien onglet sur les en-têtes du nouveau (colonnes déplacées/renommées). */
function aligner(ligne: Cellule[], entetesAvant: string[], entetesApres: string[]): Cellule[] {
  return entetesApres.map((h) => {
    const i = entetesAvant.indexOf(h);
    return i >= 0 ? (ligne[i] ?? null) : null;
  });
}

export function diffSnapshots(avant: DonneesChine, apres: DonneesChine, m?: MappingChine): DiffChine {
  const onglets: DiffOnglet[] = [];
  for (const oApres of apres.onglets) {
    const oAvant = avant.onglets.find((o) => o.nom === oApres.nom);
    if (!oAvant) {
      onglets.push({ onglet: oApres.nom, entetes: oApres.entetes, statut: "ajoute", colonneCle: null, ajoutees: oApres.lignes, supprimees: [], modifiees: [] });
      continue;
    }
    const cle = choisirColonneCle(oAvant, oApres, m);
    const iAvant = indexer({ ...oAvant, lignes: oAvant.lignes.map((l) => aligner(l, oAvant.entetes, oApres.entetes)), entetes: oApres.entetes }, cle);
    const iApres = indexer(oApres, cle);
    const d: DiffOnglet = { onglet: oApres.nom, entetes: oApres.entetes, statut: "modifie", colonneCle: cle, ajoutees: [], supprimees: [], modifiees: [] };
    for (const [k, l] of iApres) {
      const a = iAvant.get(k);
      if (!a) d.ajoutees.push(l);
      else if (signature(a) !== signature(l)) {
        d.modifiees.push({ cle: k.replace(/#\d+$/, ""), avant: a, apres: l, colonnes: oApres.entetes.filter((_, i) => signature([a[i]]) !== signature([l[i]])) });
      }
    }
    for (const [k, l] of iAvant) if (!iApres.has(k)) d.supprimees.push(l);
    if (d.ajoutees.length || d.supprimees.length || d.modifiees.length) onglets.push(d);
  }
  for (const oAvant of avant.onglets) {
    if (!apres.onglets.some((o) => o.nom === oAvant.nom)) {
      onglets.push({ onglet: oAvant.nom, entetes: oAvant.entetes, statut: "supprime", colonneCle: null, ajoutees: [], supprimees: oAvant.lignes, modifiees: [] });
    }
  }
  return {
    onglets,
    totaux: {
      ajoutees: onglets.reduce((s, o) => s + o.ajoutees.length, 0),
      modifiees: onglets.reduce((s, o) => s + o.modifiees.length, 0),
      supprimees: onglets.reduce((s, o) => s + o.supprimees.length, 0),
    },
  };
}

/** Lecture tolérante du JSON stocké dans chine_snapshots.data. */
export function lireDonnees(brut: unknown): DonneesChine {
  const d = brut as Partial<DonneesChine> | null;
  if (!d || !Array.isArray(d.onglets)) return { onglets: [] };
  return {
    onglets: d.onglets.filter((o) => o && typeof o.nom === "string" && Array.isArray(o.entetes) && Array.isArray(o.lignes)),
  };
}
