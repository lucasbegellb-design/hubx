// Extraction de texte des fichiers bureautiques (Word, PowerPoint, Excel, OpenDocument, texte).
// @deno-types="https://cdn.sheetjs.com/xlsx-0.20.3/package/types/index.d.ts"
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
import { strFromU8, unzipSync } from "npm:fflate@0.8.2";

export { XLSX };

function xmlVersTexte(xml: string, finParagraphe: RegExp): string {
  return xml
    .replace(finParagraphe, "\n")
    .replace(/<w:tab\/>|<a:tab\/>/g, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function texteZip(octets: Uint8Array, ext: string): string {
  const fichiers = unzipSync(octets);
  if (ext === "docx") {
    const doc = fichiers["word/document.xml"];
    return doc ? xmlVersTexte(strFromU8(doc), /<\/w:p>/g) : "";
  }
  if (ext === "pptx") {
    return Object.keys(fichiers)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]))
      .map((n, i) => `--- Diapositive ${i + 1} ---\n` + xmlVersTexte(strFromU8(fichiers[n]), /<\/a:p>/g))
      .join("\n\n");
  }
  if (ext === "odt" || ext === "odp") {
    const c = fichiers["content.xml"];
    return c ? xmlVersTexte(strFromU8(c), /<\/text:(p|h)>/g) : "";
  }
  return "";
}

function texteTableur(octets: Uint8Array): string {
  const classeur = XLSX.read(octets, { type: "array", cellDates: true });
  return classeur.SheetNames.map(
    (nom) => `--- Onglet « ${nom} » ---\n` + XLSX.utils.sheet_to_csv(classeur.Sheets[nom], { blankrows: false }),
  ).join("\n\n");
}

/** Renvoie le texte d'un fichier bureautique, ou null si le format n'est pas pris en charge. */
export function extraireTexte(octets: Uint8Array, nom: string, mime: string | null): string | null {
  const ext = nom.split(".").pop()?.toLowerCase() ?? "";
  if (["docx", "pptx", "odt", "odp"].includes(ext)) return texteZip(octets, ext);
  if (["xlsx", "xls", "ods", "csv"].includes(ext) || /spreadsheet|excel/.test(mime ?? "")) return texteTableur(octets);
  if (["txt", "md"].includes(ext) || mime?.startsWith("text/")) return new TextDecoder().decode(octets);
  return null;
}
