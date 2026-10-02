// Orchestration de l'installation (ou de la mise à jour) du serveur depuis l'application.
// Chaque étape est idempotente : en cas d'échec, « Réessayer » reprend là où c'était arrêté.
import { createClient } from "@supabase/supabase-js";
import { clesProjet, deployerFonction, fermerInscriptions, requeteSql } from "./gestion";
import { FONCTIONS, MIGRATIONS_APP, fichiersFonction } from "./paquet";

export type IdEtape = "cles" | "base" | "fonctions" | "auth" | "planification" | "compte" | "services";
export type StatutEtape = "attente" | "encours" | "ok" | "erreur";

export interface Etape {
  id: IdEtape;
  libelle: string;
  statut: StatutEtape;
  detail?: string;
}

export const LIBELLES_ETAPES: Record<IdEtape, string> = {
  cles: "Connexion au projet",
  base: "Création de la base de données",
  fonctions: "Installation des fonctions serveur",
  auth: "Sécurisation des connexions",
  planification: "Activation des tâches automatiques",
  compte: "Création du compte administrateur",
  services: "Enregistrement des clés des services",
};

export interface CompteAdmin {
  nom: string;
  email: string;
  motDePasse: string;
}

export interface ClesServices {
  anthropic?: string;
  azureTenant?: string;
  azureClient?: string;
  azureSecret?: string;
}

const URL_PROJET_DEV = import.meta.env.VITE_INSTALL_PROJET_URL as string | undefined;
export const urlDuProjet = (ref: string) => URL_PROJET_DEV ?? `https://${ref}.supabase.co`;

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

/** Applique les migrations manquantes (journalisées comme le ferait la CLI Supabase). */
export async function appliquerMigrations(jeton: string, ref: string, progression: (d: string) => void) {
  await requeteSql(
    jeton,
    ref,
    "create schema if not exists supabase_migrations;\n" +
      "create table if not exists supabase_migrations.schema_migrations (version text not null primary key, statements text[], name text);",
  );
  const lignes = await requeteSql<{ version: string }[]>(
    jeton,
    ref,
    "select version from supabase_migrations.schema_migrations;",
  );
  const faites = new Set((lignes ?? []).map((l) => l.version));
  const restantes = MIGRATIONS_APP.filter((m) => !faites.has(m.version));
  let i = 0;
  for (const m of restantes) {
    i++;
    progression(`${i}/${restantes.length} · ${m.nom.replace(/_/g, " ")}`);
    const sql = await m.charger();
    // Une seule requête : migration + journalisation (exécutées ensemble)
    await requeteSql(
      jeton,
      ref,
      `${sql}\n;\ninsert into supabase_migrations.schema_migrations (version, name) values (${lit(m.version)}, ${lit(m.nom)}) on conflict (version) do nothing;`,
    );
  }
  return restantes.length;
}

export async function deployerFonctions(jeton: string, ref: string, progression: (d: string) => void) {
  let i = 0;
  for (const slug of FONCTIONS) {
    i++;
    progression(`${i}/${FONCTIONS.length} · ${slug}`);
    await deployerFonction(jeton, ref, slug, await fichiersFonction(slug));
  }
}

interface Options {
  jeton: string;
  ref: string;
  admin: CompteAdmin;
  services: ClesServices;
  onEtapes: (etapes: Etape[]) => void;
}

/** Installation complète. Renvoie la configuration à enregistrer sur le poste. */
export async function installerServeur(o: Options): Promise<{ url: string; anonKey: string }> {
  const ids: IdEtape[] = ["cles", "base", "fonctions", "auth", "planification", "compte", "services"];
  const etapes: Etape[] = ids.map((id) => ({ id, libelle: LIBELLES_ETAPES[id], statut: "attente" }));
  const maj = (id: IdEtape, statut: StatutEtape, detail?: string) => {
    const e = etapes.find((x) => x.id === id)!;
    e.statut = statut;
    e.detail = detail;
    o.onEtapes(etapes.map((x) => ({ ...x })));
  };
  const etape = async <T>(id: IdEtape, fn: (detail: (d: string) => void) => Promise<T>): Promise<T> => {
    maj(id, "encours");
    try {
      const r = await fn((d) => maj(id, "encours", d));
      maj(id, "ok");
      return r;
    } catch (e) {
      maj(id, "erreur", (e as Error).message);
      throw e;
    }
  };

  const url = urlDuProjet(o.ref);
  const cles = await etape("cles", () => clesProjet(o.jeton, o.ref));
  // Client serveur temporaire (jamais enregistré) pour la fin de l'installation
  const serveur = createClient(url, cles.secrete, { auth: { persistSession: false, autoRefreshToken: false } });

  await etape("base", async (d) => {
    const n = await appliquerMigrations(o.jeton, o.ref, d);
    if (n === 0) d("déjà à jour");
  });
  await etape("fonctions", (d) => deployerFonctions(o.jeton, o.ref, d));
  await etape("auth", () => fermerInscriptions(o.jeton, o.ref));
  await etape("planification", async () => {
    const { error } = await serveur.rpc("enregistrer_secret", { p_nom: "url", p_valeur: url });
    if (error) throw new Error(`Planification non configurée : ${error.message}`);
  });

  await etape("compte", async () => {
    const email = o.admin.email.trim().toLowerCase();
    let userId: string | undefined;
    const cree = await serveur.auth.admin.createUser({ email, password: o.admin.motDePasse, email_confirm: true });
    if (cree.error) {
      // Compte déjà existant (réinstallation) : on le retrouve et on remet le mot de passe choisi
      const { data } = await serveur.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const existant = data?.users.find((u) => u.email?.toLowerCase() === email);
      if (!existant) throw new Error(`Création du compte impossible : ${cree.error.message}`);
      await serveur.auth.admin.updateUserById(existant.id, { password: o.admin.motDePasse, ban_duration: "none" });
      userId = existant.id;
    } else userId = cree.data.user.id;
    const { error } = await serveur
      .from("membres")
      .upsert({ user_id: userId, nom: o.admin.nom.trim(), email, role: "admin" }, { onConflict: "user_id" });
    if (error) throw new Error(`Compte créé mais droits administrateur non attribués : ${error.message}`);
  });

  await etape("services", async (d) => {
    const valeurs: [string, string | undefined][] = [
      ["anthropic_api_key", o.services.anthropic],
      ["azure_tenant_id", o.services.azureTenant],
      ["azure_client_id", o.services.azureClient],
      ["azure_client_secret", o.services.azureSecret],
    ];
    const aEnregistrer = valeurs.filter(([, v]) => v?.trim());
    if (!aEnregistrer.length) return d("à compléter plus tard dans Paramètres");
    for (const [nom, valeur] of aEnregistrer) {
      const { error } = await serveur.rpc("enregistrer_secret", { p_nom: nom, p_valeur: valeur!.trim() });
      if (error) throw new Error(`Clé non enregistrée (${nom}) : ${error.message}`);
    }
  });

  return { url, anonKey: cles.publique };
}

/** Mise à jour du serveur après une nouvelle version de l'app : migrations manquantes + fonctions. */
export async function mettreAJourServeur(jeton: string, ref: string, onEtapes: (e: Etape[]) => void) {
  const etapes: Etape[] = (["base", "fonctions"] as IdEtape[]).map((id) => ({
    id,
    libelle: LIBELLES_ETAPES[id],
    statut: "attente",
  }));
  const maj = (id: IdEtape, statut: StatutEtape, detail?: string) => {
    Object.assign(
      etapes.find((x) => x.id === id)!,
      { statut, detail },
    );
    onEtapes(etapes.map((x) => ({ ...x })));
  };
  for (const [id, fn] of [
    ["base", (d: (s: string) => void) => appliquerMigrations(jeton, ref, d)],
    ["fonctions", (d: (s: string) => void) => deployerFonctions(jeton, ref, d)],
  ] as const) {
    maj(id, "encours");
    try {
      await fn((d) => maj(id, "encours", d));
      maj(id, "ok");
    } catch (e) {
      maj(id, "erreur", (e as Error).message);
      throw e;
    }
  }
}
