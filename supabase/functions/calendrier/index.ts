// Flux iCal personnel, lu par Outlook / Google / Apple : GET /functions/v1/calendrier?jeton=…
// Le jeton (secret, régénérable dans Paramètres) n'est stocké que haché ; aucune autre authentification.
// Contenu : tâches ouvertes qui me sont assignées ou non assignées, mes rappels, échéances du suivi Chine.
import { encodeHex } from "jsr:@std/encoding@1/hex";
import { clientAdmin } from "../_shared/client.ts";
import { HttpError, servir } from "../_shared/http.ts";
import { evenementsChine, evenementsRappels, evenementsTaches, type Evenement } from "../_shared/logic/calendrier.ts";
import { appliquerMapping, lireDonnees, lireMapping, mappingConfigure } from "../_shared/logic/chine.ts";
import { ajouterJours, aujourdhuiParis } from "../_shared/logic/dates.ts";
import { genererIcal } from "../_shared/logic/ical.ts";

async function hacher(jeton: string): Promise<string> {
  return encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(jeton))));
}

servir(
  async (req) => {
    const jeton = new URL(req.url).searchParams.get("jeton") ?? "";
    if (!/^[0-9a-f]{48}$/.test(jeton)) throw new HttpError(404, "Calendrier introuvable.");
    const db = clientAdmin();
    const { data: cal } = await db
      .from("calendriers")
      .select("user_id")
      .eq("jeton_hash", await hacher(jeton))
      .maybeSingle();
    if (!cal) throw new HttpError(404, "Calendrier introuvable (lien régénéré ou désactivé).");
    const { data: membre } = await db.from("membres").select("nom").eq("user_id", cal.user_id).maybeSingle();
    if (!membre) throw new HttpError(404, "Calendrier introuvable.");

    const aujourdhui = aujourdhuiParis();
    const depuis = ajouterJours(aujourdhui, -60);
    const [taches, postits, source, snapshot] = await Promise.all([
      db
        .from("taches")
        .select("id, titre, echeance, statut, priorite, assigne_a")
        .is("deleted_at", null)
        .neq("statut", "fait")
        .not("echeance", "is", null)
        .gte("echeance", depuis)
        .or(`assigne_a.is.null,assigne_a.eq.${cal.user_id}`),
      db
        .from("postits")
        .select("id, contenu, rappel_at")
        .eq("proprietaire", cal.user_id)
        .is("archived_at", null)
        .not("rappel_at", "is", null)
        .gte("rappel_at", new Date(Date.now() - 30 * 86_400_000).toISOString()),
      db.from("chine_source").select("mapping").limit(1).maybeSingle(),
      db.from("chine_snapshots").select("data").order("taken_at", { ascending: false }).limit(1).maybeSingle(),
    ]);

    const evenements: Evenement[] = [
      ...evenementsTaches(taches.data ?? [], aujourdhui),
      ...evenementsRappels(postits.data ?? []),
    ];
    const mapping = lireMapping(source.data?.mapping);
    if (snapshot.data && mappingConfigure(mapping)) {
      const lignes = appliquerMapping(lireDonnees(snapshot.data.data), mapping);
      evenements.push(...evenementsChine(lignes, aujourdhui).filter((e) => e.jour >= depuis));
    }

    return new Response(genererIcal({ nom: `Hub XTIM — ${membre.nom}`, evenements }), {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="hub-xtim.ics"',
        "Cache-Control": "private, max-age=900",
      },
    });
  },
  { methodes: ["GET"] },
);
