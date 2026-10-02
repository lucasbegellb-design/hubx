import { describe, expect, it } from "vitest";
import { sauvegardesASupprimer, TABLES_EXPORT } from "@shared/export";

describe("sauvegardes", () => {
  it("garde les huit plus récentes et ignore les autres fichiers", () => {
    const noms = Array.from({ length: 10 }, (_, i) => `2026-0${Math.floor(i / 5) + 1}-1${i % 5}.zip`);
    expect(sauvegardesASupprimer([...noms, "lisezmoi.txt"])).toEqual(["2026-01-11.zip", "2026-01-10.zip"]);
    expect(sauvegardesASupprimer(noms.slice(0, 3))).toEqual([]);
  });

  it("exporte les membres avant les tâches (ordre de réimport)", () => {
    expect(TABLES_EXPORT.indexOf("membres")).toBeLessThan(TABLES_EXPORT.indexOf("taches"));
  });
});
