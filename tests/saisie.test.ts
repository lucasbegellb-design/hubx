import { describe, expect, it } from "vitest";
import { analyserSaisie, interpreterDate } from "@shared/saisie.ts";

const ctx = {
  aujourdhui: "2026-09-24", // jeudi
  domaines: [
    { id: "d-com", nom: "Commercial" },
    { id: "d-compta", nom: "Compta" },
    { id: "d-prod", nom: "Production" },
  ],
  projets: [{ id: "p-swift", nom: "Swift" }],
};

describe("saisie rapide", () => {
  it("extrait domaine, projet, échéance et urgence", () => {
    const r = analyserSaisie("Relancer l'usine #prod +swift @demain !", ctx);
    expect(r).toMatchObject({
      type: null,
      titre: "Relancer l'usine",
      domaineId: "d-prod",
      projetId: "p-swift",
      echeance: "2026-09-25",
      urgente: true,
    });
  });

  it("préfère la correspondance exacte du domaine", () => {
    expect(analyserSaisie("TVA #compta", ctx).domaineId).toBe("d-compta");
    expect(analyserSaisie("Devis #comm", ctx).domaineId).toBe("d-com");
  });

  it("gère les préfixes de type", () => {
    expect(analyserSaisie("p: idée #truc", ctx)).toMatchObject({ type: "postit", titre: "idée #truc" });
    expect(analyserSaisie("f: Envoyé les factures #compta", ctx)).toMatchObject({
      type: "fait",
      domaineId: "d-compta",
    });
    expect(analyserSaisie("T: appeler", ctx).type).toBe("tache");
  });

  it("signale les jetons inconnus sans les perdre", () => {
    const r = analyserSaisie("Tâche #inexistant @nimportequoi", ctx);
    expect(r.inconnus).toEqual(["#inexistant", "@nimportequoi"]);
    expect(r.titre).toBe("Tâche");
  });

  it("point d'exclamation final = urgent", () => {
    expect(analyserSaisie("Payer la douane!", ctx)).toMatchObject({ titre: "Payer la douane", urgente: true });
  });

  it("interprète les dates", () => {
    expect(interpreterDate("auj", ctx.aujourdhui)).toBe("2026-09-24");
    expect(interpreterDate("vendredi", ctx.aujourdhui)).toBe("2026-09-25");
    expect(interpreterDate("jeudi", ctx.aujourdhui)).toBe("2026-10-01"); // jamais aujourd'hui
    expect(interpreterDate("lun", ctx.aujourdhui)).toBe("2026-09-28");
    expect(interpreterDate("+3", ctx.aujourdhui)).toBe("2026-09-27");
    expect(interpreterDate("12/10", ctx.aujourdhui)).toBe("2026-10-12");
    expect(interpreterDate("01/02", ctx.aujourdhui)).toBe("2027-02-01"); // passé → année suivante
    expect(interpreterDate("31/02", ctx.aujourdhui)).toBeNull();
    expect(interpreterDate("2026-12-01", ctx.aujourdhui)).toBe("2026-12-01");
  });
});
