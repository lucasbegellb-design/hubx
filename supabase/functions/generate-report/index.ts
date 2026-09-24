// Génère un rapport : chiffres calculés de façon déterministe (construireRapport),
// synthèse rédigée par l'IA à partir de ce JSON uniquement (facultative).
import { clientAdmin, verifierAppelant } from "../_shared/auth.ts";
import { HttpError, json, lireCorps, servir } from "../_shared/http.ts";
import { demanderJson, iaDisponible } from "../_shared/ia.ts";
import { lireDonnees, lireMapping } from "../_shared/logic/chine.ts";
import {
  aujourdhuiParis,
  bornesInstant,
  joursEntre,
  periode as periodeDe,
  type Periode,
} from "../_shared/logic/dates.ts";
import { consigneSynthese, construireRapport, rendreMarkdown, type TypeRapport } from "../_shared/logic/rapport.ts";

interface Corps {
  type?: TypeRapport;
  periode_debut?: string;
  periode_fin?: string;
  filtres?: { domaines?: string[]; projets?: string[] };
}

const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

async function toutesLesLignes<T>(
  requete: (de: number, a: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const res: T[] = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await requete(de, de + 999);
    if (error) throw new HttpError(500, "Lecture des données impossible.");
    res.push(...(data ?? []));
    if (!data || data.length < 1000) return res;
  }
}

servir(async (req) => {
  const appelant = await verifierAppelant(req, { autoriserCron: true });
  const corps = await lireCorps<Corps>(req);
  const type: TypeRapport = corps.type === "hebdo" || corps.type === "mensuel" ? corps.type : "demande";
  const aujourdhui = aujourdhuiParis();

  let p: Periode;
  if (type === "hebdo") p = periodeDe("cette_semaine", aujourdhui);
  else if (type === "mensuel") p = periodeDe("ce_mois", aujourdhui);
  else {
    if (!RE_DATE.test(corps.periode_debut ?? "") || !RE_DATE.test(corps.periode_fin ?? ""))
      throw new HttpError(400, "Période invalide.");
    p = { debut: corps.periode_debut!, fin: corps.periode_fin! };
    if (p.fin < p.debut) throw new HttpError(400, "La fin de période précède le début.");
    if (joursEntre(p.debut, p.fin) > 400) throw new HttpError(400, "Période trop longue (400 jours maximum).");
  }
  const filtres =
    type === "demande" ? { domaines: corps.filtres?.domaines ?? [], projets: corps.filtres?.projets ?? [] } : {};

  const db = clientAdmin();
  const { data: rapport, error: errInsert } = await db
    .from("rapports")
    .insert({
      type,
      periode_debut: p.debut,
      periode_fin: p.fin,
      filtres,
      statut: "en_cours",
      genere_par: appelant.type === "membre" ? appelant.userId : null,
    })
    .select("id")
    .single();
  if (errInsert) {
    // Rapport automatique déjà généré pour cette période (double déclenchement pg_cron)
    if ((errInsert as { code?: string }).code === "23505") return json({ ok: true, deja: true });
    throw new HttpError(500, "Création du rapport impossible.");
  }

  try {
    const { depuis, jusqua } = bornesInstant(p);
    const [domaines, projets, membres, taches, journal, process, documents, source] = await Promise.all([
      db.from("domaines").select("id, nom, couleur, ordre"),
      db.from("projets").select("id, nom, statut"),
      db.from("membres").select("user_id, nom"),
      toutesLesLignes((de, a) =>
        db
          .from("taches")
          .select(
            "id, titre, statut, domaine_id, projet_id, echeance, priorite, en_attente_de, assigne_a, cree_par, done_at, created_at, deleted_at",
          )
          .is("deleted_at", null)
          .order("id")
          .range(de, a),
      ),
      toutesLesLignes((de, a) =>
        db
          .from("journal_activite")
          .select("entite, entite_id, action, at, user_id")
          .gte("at", depuis)
          .lt("at", jusqua)
          .order("at")
          .range(de, a),
      ),
      db.from("process").select("id, titre, domaine_id, statut, deleted_at"),
      db
        .from("documents")
        .select("id, nom, categorie, domaine_id, projet_id, created_at, deleted_at")
        .gte("created_at", depuis)
        .lt("created_at", jusqua),
      db.from("chine_source").select("mapping").limit(1).maybeSingle(),
    ]);

    // Suivi Chine : version en vigueur au début de la période et à la fin
    const [snapAvant, snapApres] = await Promise.all([
      db
        .from("chine_snapshots")
        .select("taken_at, data")
        .lte("taken_at", depuis)
        .order("taken_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      db
        .from("chine_snapshots")
        .select("taken_at, data")
        .lt("taken_at", jusqua)
        .order("taken_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    let avant = snapAvant.data;
    if (!avant) {
      // Pas de version antérieure : la première version de la période sert de référence
      const { data } = await db
        .from("chine_snapshots")
        .select("taken_at, data")
        .gte("taken_at", depuis)
        .lt("taken_at", jusqua)
        .order("taken_at")
        .limit(1)
        .maybeSingle();
      avant = data && snapApres.data && data.taken_at !== snapApres.data.taken_at ? data : null;
    }

    const donnees = construireRapport({
      type,
      periode: p,
      aujourdhui,
      genereLe: new Date().toISOString(),
      filtres,
      domaines: domaines.data ?? [],
      projets: projets.data ?? [],
      membres: membres.data ?? [],
      taches,
      journal,
      process: process.data ?? [],
      documents: documents.data ?? [],
      chine: snapApres.data
        ? {
            avant: avant ? lireDonnees(avant.data) : null,
            apres: lireDonnees(snapApres.data.data),
            avantLe: avant?.taken_at ?? null,
            apresLe: snapApres.data.taken_at,
            mapping: lireMapping(source.data?.mapping),
          }
        : null,
    });

    // Synthèse IA : facultative, jamais bloquante
    let synthese: string | null = null;
    let erreurIa: string | null = null;
    if (iaDisponible()) {
      try {
        const c = consigneSynthese(donnees);
        const r = await demanderJson<{ synthese: string }>({
          system: c.system,
          contenu: `Données du rapport (JSON) :\n<donnees>\n${c.donnees}\n</donnees>\nRédige la synthèse.`,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["synthese"],
            properties: { synthese: { type: "string", description: "3 à 5 lignes, sans titre ni liste" } },
          },
          maxTokens: 2000,
        });
        synthese = r.synthese.trim() || null;
      } catch (e) {
        erreurIa = e instanceof HttpError ? e.message : "Synthèse IA indisponible.";
      }
    }

    await db
      .from("rapports")
      .update({ donnees, synthese, contenu_md: rendreMarkdown(donnees, synthese), statut: "pret", erreur: erreurIa })
      .eq("id", rapport.id);
    return json({ ok: true, id: rapport.id });
  } catch (e) {
    const message = e instanceof HttpError ? e.message : "Génération du rapport impossible.";
    await db.from("rapports").update({ statut: "erreur", erreur: message }).eq("id", rapport.id);
    throw e instanceof HttpError ? e : new HttpError(500, message);
  }
});
