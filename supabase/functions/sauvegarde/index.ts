// Sauvegarde automatique (cron du dimanche ou bouton administrateur) : toutes les tables en JSON dans un zip
// déposé dans le bucket privé « sauvegardes » (lecture administrateur seulement). Les fichiers déposés restent
// dans le bucket « documents » : le manifeste en donne la liste. Les post-its privés restent privés.
import { strToU8, zipSync, type Zippable } from "npm:fflate@0.8.2";
import { clientAdmin, verifierAppelant } from "../_shared/auth.ts";
import { HttpError, json, servir } from "../_shared/http.ts";
import { aujourdhuiParis } from "../_shared/logic/dates.ts";
import { sauvegardesASupprimer, TABLES_EXPORT } from "../_shared/logic/export.ts";

const BUCKET = "sauvegardes";

servir(async (req) => {
  const appelant = await verifierAppelant(req, { autoriserCron: true, adminSeulement: true });
  const db = clientAdmin();
  const zip: Zippable = {};
  const lignesParTable: Record<string, number> = {};

  for (const table of TABLES_EXPORT) {
    const lignes: Record<string, unknown>[] = [];
    for (let de = 0; ; de += 1000) {
      let requete = db
        .from(table)
        .select("*")
        .order("created_at")
        .range(de, de + 999);
      if (table === "postits") requete = requete.eq("partage", true);
      const { data, error } = await requete;
      if (error) throw new HttpError(500, `Lecture de « ${table} » impossible.`);
      lignes.push(...(data as Record<string, unknown>[]));
      if (data.length < 1000) break;
    }
    zip[`donnees/${table}.json`] = strToU8(JSON.stringify(lignes, null, 1));
    lignesParTable[table] = lignes.length;
  }

  const { data: fichiers } = await db.from("documents").select("storage_path, nom, taille").is("deleted_at", null);
  zip["manifeste.json"] = strToU8(
    JSON.stringify(
      {
        application: "Hub XTIM",
        genere_le: new Date().toISOString(),
        declenchee_par: appelant.type === "systeme" ? "planification" : appelant.nom,
        tables: lignesParTable,
        fichiers_bucket_documents: fichiers ?? [],
      },
      null,
      1,
    ),
  );

  const contenu = zipSync(zip, { level: 6 });
  const nom = `${aujourdhuiParis()}.zip`;
  const { error } = await db.storage
    .from(BUCKET)
    .upload(nom, contenu, { contentType: "application/zip", upsert: true });
  if (error) throw new HttpError(500, "Dépôt de la sauvegarde impossible (bucket « sauvegardes » absent ?).");

  const { data: liste } = await db.storage.from(BUCKET).list("", { limit: 1000 });
  const anciennes = sauvegardesASupprimer((liste ?? []).map((f) => f.name));
  if (anciennes.length) await db.storage.from(BUCKET).remove(anciennes);

  return json({ ok: true, nom, taille: contenu.length, tables: lignesParTable });
});
