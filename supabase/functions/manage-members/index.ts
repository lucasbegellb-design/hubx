// Gestion des comptes par l'administrateur : création, rôle, mot de passe, retrait d'accès.
// Le retrait bloque le compte et supprime son appartenance, sans effacer ses données (passation).
import { clientAdmin, verifierAppelant } from "../_shared/auth.ts";
import { HttpError, json, lireCorps, servir } from "../_shared/http.ts";

interface Corps {
  action?: "creer" | "role" | "mot_de_passe" | "retirer";
  email?: string;
  nom?: string;
  role?: "admin" | "membre";
  mot_de_passe?: string;
  user_id?: string;
}

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function verifierMotDePasse(m: string | undefined): string {
  if (!m || m.length < 10) throw new HttpError(400, "Mot de passe trop court : 10 caractères minimum.");
  return m;
}

servir(async (req) => {
  const appelant = await verifierAppelant(req, { adminSeulement: true });
  if (appelant.type !== "membre") throw new HttpError(403, "Action réservée à l'administrateur.");
  const c = await lireCorps<Corps>(req);
  const db = clientAdmin();

  switch (c.action) {
    case "creer": {
      const email = (c.email ?? "").trim().toLowerCase();
      const nom = (c.nom ?? "").trim();
      if (!RE_EMAIL.test(email)) throw new HttpError(400, "Adresse e-mail invalide.");
      if (!nom) throw new HttpError(400, "Indique le nom de la personne.");
      const role = c.role === "admin" ? "admin" : "membre";
      const { data, error } = await db.auth.admin.createUser({
        email,
        password: verifierMotDePasse(c.mot_de_passe),
        email_confirm: true,
      });
      let userId = data?.user?.id;
      if (error) {
        // Compte existant (ex. ancien membre retiré) : on le réactive
        const { data: liste } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const existant = liste?.users.find((u) => u.email?.toLowerCase() === email);
        if (!existant) throw new HttpError(400, "Création du compte impossible : " + error.message);
        await db.auth.admin.updateUserById(existant.id, { password: c.mot_de_passe, ban_duration: "none" });
        userId = existant.id;
      }
      const { error: e2 } = await db.from("membres").upsert({ user_id: userId!, nom, email, role }, { onConflict: "user_id" });
      if (e2) throw new HttpError(500, "Compte créé mais ajout aux membres impossible.");
      return json({ ok: true, user_id: userId });
    }
    case "role": {
      if (!c.user_id || (c.role !== "admin" && c.role !== "membre")) throw new HttpError(400, "Paramètres invalides.");
      if (c.role === "membre") {
        const { count } = await db.from("membres").select("id", { count: "exact", head: true }).eq("role", "admin").neq("user_id", c.user_id);
        if (!count) throw new HttpError(400, "Il doit rester au moins un administrateur.");
      }
      const { error } = await db.from("membres").update({ role: c.role }).eq("user_id", c.user_id);
      if (error) throw new HttpError(500, "Changement de rôle impossible.");
      return json({ ok: true });
    }
    case "mot_de_passe": {
      if (!c.user_id) throw new HttpError(400, "Compte manquant.");
      const { error } = await db.auth.admin.updateUserById(c.user_id, { password: verifierMotDePasse(c.mot_de_passe) });
      if (error) throw new HttpError(400, "Réinitialisation impossible : " + error.message);
      return json({ ok: true });
    }
    case "retirer": {
      if (!c.user_id) throw new HttpError(400, "Compte manquant.");
      if (c.user_id === appelant.userId) throw new HttpError(400, "Tu ne peux pas retirer ton propre accès. Nomme d'abord un autre administrateur.");
      // Bloque la connexion (les données restent attribuées pour l'historique)
      await db.auth.admin.updateUserById(c.user_id, { ban_duration: "876000h" });
      const { error } = await db.from("membres").delete().eq("user_id", c.user_id);
      if (error) throw new HttpError(500, "Retrait impossible.");
      return json({ ok: true });
    }
    default:
      throw new HttpError(400, "Action inconnue.");
  }
});
