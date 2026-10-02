/// <reference types="node" />
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// `tauri build` refuse de construire si un paquet npm @tauri-apps/* et sa crate Rust n'ont pas la même
// version majeure.mineure. Le CI ne compile pas Rust : ce test détecte l'écart avant le build Windows.
const verrouNpm = JSON.parse(readFileSync("package-lock.json", "utf8")) as {
  packages: Record<string, { version?: string }>;
};
const verrouCargo = readFileSync("src-tauri/Cargo.lock", "utf8");

function versionCrate(nom: string): string | undefined {
  return verrouCargo.match(new RegExp(`\\[\\[package\\]\\]\\nname = "${nom}"\\nversion = "([^"]+)"`))?.[1];
}
const mineure = (v: string | undefined) => v?.split(".").slice(0, 2).join(".");

const PAQUETS = Object.entries(verrouNpm.packages)
  .filter(([chemin]) => /^node_modules\/@tauri-apps\/(api|plugin-[a-z-]+)$/.test(chemin))
  .map(([chemin, p]) => {
    const nom = chemin.replace("node_modules/@tauri-apps/", "");
    return { npm: `@tauri-apps/${nom}`, crate: nom === "api" ? "tauri" : `tauri-${nom}`, version: p.version };
  });

describe("versions Tauri", () => {
  it("trouve les paquets Tauri dans les deux verrous", () => {
    expect(PAQUETS.map((p) => p.npm)).toContain("@tauri-apps/api");
    expect(versionCrate("tauri")).toBeDefined();
  });

  it.each(PAQUETS)("$npm et la crate $crate ont la même version majeure.mineure", ({ crate, version }) => {
    expect(mineure(versionCrate(crate))).toBe(mineure(version));
  });
});
