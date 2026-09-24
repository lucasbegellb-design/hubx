// Synchronisation du Suivi Chine (lecture seule) : télécharge le classeur OneDrive d'Edwin,
// le normalise, et enregistre un snapshot si le contenu a changé (au minimum un par jour).
// Sans identifiants Azure : mode démo sur le fichier d'exemple embarqué.
import { decodeBase64, encodeHex } from "jsr:@std/encoding@1";
import { clientAdmin, verifierAppelant } from "../_shared/auth.ts";
import { XLSX } from "../_shared/fichiers.ts";
import { HttpError, json, lireCorps, servir } from "../_shared/http.ts";
import { normaliserClasseur, type DonneesChine } from "../_shared/logic/chine.ts";
import { aujourdhuiParis, dateParis } from "../_shared/logic/dates.ts";
import { FIXTURE_XLSX_BASE64 } from "./fixture.ts";
import { identifiantsAzure, lireFichierPartage } from "./graph.ts";

function lireClasseur(octets: Uint8Array): DonneesChine {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(octets, { type: "array", cellDates: true });
  } catch {
    throw new HttpError(422, "Le fichier téléchargé n'est pas un classeur Excel lisible (protégé par mot de passe ?).");
  }
  const d = normaliserClasseur(
    wb.SheetNames.map((nom) => ({
      nom,
      lignes: XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[nom], { header: 1, raw: true, defval: null, blankrows: false }),
    })),
  );
  if (!d.onglets.length) throw new HttpError(422, "Le classeur ne contient aucun onglet avec des données.");
  return d;
}

async function empreinte(d: DonneesChine): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(d)));
  return encodeHex(new Uint8Array(h));
}

servir(async (req) => {
  const appelant = await verifierAppelant(req, { autoriserCron: true });
  const { test } = await lireCorps<{ test?: boolean }>(req);
  const db = clientAdmin();
  const { data: source } = await db.from("chine_source").select("*").limit(1).maybeSingle();
  if (!source) throw new HttpError(500, "Configuration du Suivi Chine absente (migration non appliquée ?).");

  const azure = identifiantsAzure();
  const mode = azure ? "onedrive" : "mock";

  try {
    let octets: Uint8Array;
    let driveItemId: string | null = source.drive_item_id;
    if (azure) {
      if (!source.share_url) throw new HttpError(422, "Aucun lien de partage : colle le lien du fichier dans Paramètres › Suivi Chine.");
      const f = await lireFichierPartage(azure, source.share_url, !test);
      if (test) return json({ ok: true, mode, nom: f.nom, modifie_le: f.modifieLe });
      octets = f.octets!;
      driveItemId = f.id;
    } else {
      if (test) return json({ ok: true, mode, nom: "suivi_chine_exemple.xlsx (mode démo)", modifie_le: null });
      octets = decodeBase64(FIXTURE_XLSX_BASE64);
    }

    const donnees = lireClasseur(octets);
    const hash = await empreinte(donnees);

    const { data: dernier } = await db.from("chine_snapshots").select("hash, taken_at").order("taken_at", { ascending: false }).limit(1).maybeSingle();
    const nouveauJour = !dernier || dateParis(dernier.taken_at) !== aujourdhuiParis();
    const change = !dernier || dernier.hash !== hash;
    let snapshot = false;
    if (change || nouveauJour) {
      const { error } = await db.from("chine_snapshots").insert({ hash, data: donnees, source: mode });
      if (error) throw new HttpError(500, "Enregistrement du snapshot impossible.");
      snapshot = true;
    }
    await db
      .from("chine_source")
      .update({ last_sync_at: new Date().toISOString(), last_hash: hash, last_error: null, derniere_source: mode, drive_item_id: driveItemId })
      .eq("id", source.id);

    return json({ ok: true, mode, change, snapshot, onglets: donnees.onglets.map((o) => ({ nom: o.nom, lignes: o.lignes.length })) });
  } catch (e) {
    const message = e instanceof HttpError ? e.message : "Synchronisation impossible (erreur inattendue). Nouvel essai au prochain passage.";
    if (!test) await db.from("chine_source").update({ last_error: message, derniere_source: mode }).eq("id", source.id);
    // Appel manuel : l'erreur est renvoyée telle quelle ; pg_cron : réponse 200 pour ne pas boucler.
    if (appelant.type === "systeme") return json({ ok: false, erreur: message });
    throw e instanceof HttpError ? e : new HttpError(500, message);
  }
});
