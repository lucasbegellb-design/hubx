// État et test des clés des services (écran « Clés et connexions »).
// Les valeurs ne sont jamais renvoyées : seulement leur présence et le résultat des tests.
import { clientAdmin, verifierAppelant } from "../_shared/auth.ts";
import { HttpError, json, lireCorps, servir } from "../_shared/http.ts";
import { configIa, testerIa } from "../_shared/ia.ts";
import { oublierSecrets, secret } from "../_shared/secrets.ts";
import { identifiantsAzure, jeton } from "../sync-chine/graph.ts";

servir(async (req) => {
  const appelant = await verifierAppelant(req);
  const { action } = await lireCorps<{ action?: string }>(req);
  oublierSecrets(); // une clé vient peut-être d'être modifiée

  if (action === "etat") {
    const [ia, azure, cron, url] = await Promise.all([
      configIa(),
      identifiantsAzure(),
      secret("cron_secret", "CRON_SECRET"),
      secret("url"),
    ]);
    const { count } = await clientAdmin().from("chine_snapshots").select("id", { count: "exact", head: true });
    return json({
      ia: Boolean(ia.cle),
      fournisseur: ia.fournisseur.id,
      modele: ia.modele,
      azure: Boolean(azure),
      cron: Boolean(cron),
      url: Boolean(url),
      snapshots: count ?? 0,
    });
  }

  if (appelant.type !== "membre" || appelant.role !== "admin")
    throw new HttpError(403, "Action réservée à l'administrateur.");

  if (action === "tester_ia") return json(await testerIa());

  if (action === "tester_azure") {
    const id = await identifiantsAzure();
    if (!id) return json({ ok: false, erreur: "Identifiants Azure incomplets (annuaire, application et secret)." });
    try {
      await jeton(id);
      return json({ ok: true });
    } catch (e) {
      return json({
        ok: false,
        erreur: e instanceof HttpError ? e.message : "Microsoft injoignable depuis le serveur.",
      });
    }
  }

  throw new HttpError(400, "Action inconnue.");
});
