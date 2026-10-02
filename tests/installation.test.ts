/// <reference types="node" />
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fermetureImports, importsRelatifs, lireNomMigration, resoudre } from "@/features/installation/imports";
import { FONCTIONS as FONCTIONS_EMBARQUEES } from "@/features/installation/paquet";
import { codeInvitation, lireCodeInvitation, refProjet } from "@/lib/config";

const RACINE = "supabase/functions";
const lire = async (chemin: string) =>
  existsSync(`${RACINE}/${chemin}`) ? readFileSync(`${RACINE}/${chemin}`, "utf8") : undefined;
const FONCTIONS = readdirSync(RACINE, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("_") && existsSync(`${RACINE}/${d.name}/index.ts`))
  .map((d) => d.name);

describe("empaquetage des Edge Functions", () => {
  it("résout les imports relatifs depuis le dossier des fonctions", () => {
    expect(resoudre("sync-chine/index.ts", "../_shared/http.ts")).toBe("_shared/http.ts");
    expect(resoudre("_shared/logic/rapport.ts", "./chine.ts")).toBe("_shared/logic/chine.ts");
    expect(resoudre("configuration/index.ts", "../sync-chine/graph.ts")).toBe("sync-chine/graph.ts");
    expect(() => resoudre("index.ts", "../dehors.ts")).toThrow();
  });

  it("ne retient que les imports relatifs", () => {
    const src = `import { a } from "./a.ts";\nimport type { B } from "../b.ts";\nexport { c } from "./c.ts";\nimport x from "npm:x@1";\nimport * as Y from "https://cdn/y.mjs";\nconst z = await import("./z.ts");`;
    expect(importsRelatifs(src).sort()).toEqual(["../b.ts", "./a.ts", "./c.ts", "./z.ts"]);
  });

  it("chaque fonction embarque tous ses fichiers, sans chemin sortant", async () => {
    expect([...FONCTIONS_EMBARQUEES].sort()).toEqual(FONCTIONS.sort());
    const config = readFileSync("supabase/config.toml", "utf8");
    for (const f of FONCTIONS) expect(config).toContain(`[functions.${f}]\nverify_jwt = false`);
    for (const f of FONCTIONS) {
      const fichiers = await fermetureImports(`${f}/index.ts`, lire);
      const noms = fichiers.map((x) => x.nom);
      expect(noms).toContain(`${f}/index.ts`);
      expect(noms).toContain("_shared/http.ts");
      expect(noms.every((n) => !n.includes(".."))).toBe(true);
    }
    const sync = (await fermetureImports("sync-chine/index.ts", lire)).map((x) => x.nom);
    expect(sync).toEqual(
      expect.arrayContaining([
        "sync-chine/fixture.ts",
        "sync-chine/graph.ts",
        "_shared/logic/chine.ts",
        "_shared/secrets.ts",
      ]),
    );
  });

  it("lit les noms de migrations dans l'ordre chronologique", () => {
    const m = readdirSync("supabase/migrations").map((f) => lireNomMigration(f)!);
    expect(m.every(Boolean)).toBe(true);
    expect(lireNomMigration("/supabase/migrations/20260924120000_schema.sql")).toEqual({
      version: "20260924120000",
      nom: "schema",
    });
  });
});

describe("code d'invitation", () => {
  it("encode et relit l'adresse et la clé publique", () => {
    const c = { url: "https://abcdefghijklmnopqrst.supabase.co", anonKey: "sb_publishable_éàç-123" };
    const code = codeInvitation(c);
    expect(code.startsWith("HUBX1.")).toBe(true);
    expect(lireCodeInvitation(`  ${code}\n`)).toEqual(c);
  });

  it("refuse les codes invalides", () => {
    expect(lireCodeInvitation("n'importe quoi")).toBeNull();
    expect(lireCodeInvitation("HUBX1.@@@")).toBeNull();
    expect(lireCodeInvitation(codeInvitation({ url: "ftp://x", anonKey: "k" }))).toBeNull();
  });

  it("extrait la référence du projet de son adresse", () => {
    expect(refProjet("https://abcdefghijklmnopqrst.supabase.co")).toBe("abcdefghijklmnopqrst");
    expect(refProjet("http://127.0.0.1:54321")).toBeNull();
  });
});
