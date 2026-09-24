// Analyse IA d'un document déposé : catégorie, résumé, infos clés, tâches suggérées.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import type Anthropic from "npm:@anthropic-ai/sdk@^0";
import { clientAdmin, verifierAppelant } from "../_shared/auth.ts";
import { extraireTexte } from "../_shared/fichiers.ts";
import { HttpError, json, lireCorps, servir } from "../_shared/http.ts";
import { demanderJson, iaDisponible } from "../_shared/ia.ts";
import { aujourdhuiParis } from "../_shared/logic/dates.ts";

const CATEGORIES = [
  "Facture",
  "Devis",
  "Bon de commande",
  "Contrat",
  "Fiche technique",
  "Document administratif",
  "Ressources humaines",
  "Douane et transport",
  "Banque et finance",
  "Marketing",
  "Présentation",
  "Correspondance",
  "Autre",
];

const MAX_PDF = 20 * 1024 * 1024;
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_TEXTE = 150_000;
const IMAGES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

interface Analyse {
  categorie: string;
  resume: string;
  infos_cles: { libelle: string; valeur: string }[];
  taches_suggerees: { titre: string; echeance: string | null }[];
  domaine_suggere: string | null;
}

function schema(domaines: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["categorie", "resume", "infos_cles", "taches_suggerees", "domaine_suggere"],
    properties: {
      categorie: { type: "string", enum: CATEGORIES },
      resume: { type: "string", description: "Résumé factuel en 2 à 3 phrases" },
      infos_cles: {
        type: "array",
        description: "3 à 8 informations factuelles clés (montants, dates, références, parties, échéances)",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["libelle", "valeur"],
          properties: { libelle: { type: "string" }, valeur: { type: "string" } },
        },
      },
      taches_suggerees: {
        type: "array",
        description: "0 à 5 actions concrètes pour XTIM découlant du document",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["titre", "echeance"],
          properties: {
            titre: { type: "string", description: "Action à l'infinitif, courte" },
            echeance: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
          },
        },
      },
      domaine_suggere: { anyOf: [{ type: "string", enum: domaines }, { type: "null" }] },
    },
  };
}

servir(async (req) => {
  await verifierAppelant(req);
  const { document_id } = await lireCorps<{ document_id?: string }>(req);
  if (!document_id) throw new HttpError(400, "Document manquant.");
  const db = clientAdmin();

  const { data: doc } = await db.from("documents").select("*").eq("id", document_id).maybeSingle();
  if (!doc) throw new HttpError(404, "Document introuvable.");

  const echec = async (message: string) => {
    await db.from("documents").update({ analyse_statut: "erreur", analyse_message: message }).eq("id", document_id);
    return json({ ok: false, erreur: message });
  };

  if (!iaDisponible()) return echec("Analyse IA indisponible : clé API Anthropic non configurée (voir SETUP.md).");

  const { data: fichier, error } = await db.storage.from("documents").download(doc.storage_path);
  if (error || !fichier) return echec("Fichier introuvable dans le stockage. Dépose-le à nouveau.");
  const octets = new Uint8Array(await fichier.arrayBuffer());
  const mime = (doc.mime || fichier.type || "").toLowerCase();

  const contenu: Anthropic.ContentBlockParam[] = [];
  let extrait = false;
  if (mime === "application/pdf" || doc.nom.toLowerCase().endsWith(".pdf")) {
    if (octets.length > MAX_PDF) return echec("PDF trop volumineux pour l'analyse (20 Mo maximum).");
    contenu.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: encodeBase64(octets) } });
  } else if (IMAGES.includes(mime)) {
    if (octets.length > MAX_IMAGE) return echec("Image trop lourde pour l'analyse (5 Mo maximum).");
    contenu.push({
      type: "image",
      source: { type: "base64", media_type: mime as "image/png", data: encodeBase64(octets) },
    });
  } else {
    let texte: string | null;
    try {
      texte = extraireTexte(octets, doc.nom, mime);
    } catch {
      return echec("Fichier illisible (corrompu ou protégé par mot de passe).");
    }
    if (texte === null) return echec("Format non pris en charge pour l'analyse (PDF, images, Word, Excel, PowerPoint, texte).");
    if (!texte.trim()) return echec("Aucun texte exploitable dans ce fichier.");
    if (texte.length > MAX_TEXTE) {
      texte = texte.slice(0, MAX_TEXTE);
      extrait = true;
    }
    contenu.push({ type: "text", text: `<document nom="${doc.nom}">\n${texte}\n</document>` });
  }

  const { data: domaines } = await db.from("domaines").select("id, nom");
  const noms = (domaines ?? []).map((d) => d.nom);
  contenu.push({
    type: "text",
    text:
      `Nom du fichier : ${doc.nom}\nDate du jour : ${aujourdhuiParis()}\n` +
      (extrait ? "Attention : seul le début de ce document très long t'est fourni.\n" : "") +
      "Analyse ce document pour XTIM.",
  });

  let analyse: Analyse;
  try {
    analyse = await demanderJson<Analyse>({
      system:
        "Tu analyses les documents de XTIM SAS (PME de Marseille qui conçoit et fait fabriquer en Chine les drones biomimétiques Bionic Bird). " +
        "Réponds en français. Sois factuel : n'invente aucune information absente du document. " +
        "Les tâches suggérées sont des actions concrètes que XTIM doit mener (payer, relancer, signer, archiver…), avec une échéance ISO seulement si elle se déduit du document. " +
        `Domaines possibles : ${noms.join(", ")}.`,
      contenu,
      schema: schema(noms),
      maxTokens: 4000,
    });
  } catch (e) {
    return echec(e instanceof HttpError ? e.message : "Analyse IA impossible pour le moment. Relance-la plus tard.");
  }

  const domaineId = !doc.domaine_id && analyse.domaine_suggere ? (domaines ?? []).find((d) => d.nom === analyse.domaine_suggere)?.id : null;

  await db
    .from("documents")
    .update({
      categorie: doc.categorie || analyse.categorie,
      resume: analyse.resume,
      infos_cles: analyse.infos_cles.slice(0, 12),
      taches_suggerees: analyse.taches_suggerees.slice(0, 8).map((t) => ({ ...t, ajoutee: false })),
      domaine_id: doc.domaine_id ?? domaineId ?? null,
      analyse_statut: "ok",
      analyse_message: extrait ? "Analyse basée sur le début du document (fichier très long)." : null,
    })
    .eq("id", document_id);

  return json({ ok: true });
});
