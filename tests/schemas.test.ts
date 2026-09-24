import { describe, expect, it } from "vitest";
import { schemaLienPartage, schemaTache, valider } from "@/lib/schemas";

describe("validation zod côté client", () => {
  it("accepte une mise à jour partielle valide et conserve les champs non validés", () => {
    const r = valider(schemaTache, { id: "x", titre: "  Relancer l'usine  ", echeance: "2026-10-01" });
    expect(r).toMatchObject({ id: "x", titre: "Relancer l'usine", echeance: "2026-10-01" });
  });

  it("refuse les valeurs hors contraintes SQL avec un message lisible", () => {
    expect(() => valider(schemaTache, { titre: "" })).toThrow("Le titre est obligatoire.");
    expect(() => valider(schemaTache, { titre: "x".repeat(301) })).toThrow("300 caractères");
    expect(() => valider(schemaTache, { statut: "termine" })).toThrow();
    expect(() => valider(schemaTache, { echeance: "01/10/2026" })).toThrow("Date invalide");
  });

  it("accepte les horodatages Postgres et JavaScript", () => {
    expect(() => valider(schemaTache, { done_at: "2026-09-24T12:50:11.88897+00:00" })).not.toThrow();
    expect(() => valider(schemaTache, { deleted_at: new Date().toISOString() })).not.toThrow();
  });

  it("exige un lien de partage https", () => {
    expect(schemaLienPartage.safeParse("http://exemple.com/x").success).toBe(false);
    expect(schemaLienPartage.safeParse("https://xtim-my.sharepoint.com/:x:/g/abc").success).toBe(true);
  });
});
