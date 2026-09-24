import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

export const LOCALE = fr;

function versDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const x = typeof d === "string" ? parseISO(d) : d;
  return isValid(x) ? x : null;
}

/** « 12 oct. » ou « 12 oct. 2025 » si autre année. */
export function dateCourte(d: string | Date | null | undefined): string {
  const x = versDate(d);
  if (!x) return "";
  return format(x, x.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy", { locale: fr });
}

export function dateLongue(d: string | Date | null | undefined): string {
  const x = versDate(d);
  return x ? format(x, "EEEE d MMMM yyyy", { locale: fr }) : "";
}

export function dateHeure(d: string | Date | null | undefined): string {
  const x = versDate(d);
  return x ? format(x, "d MMM yyyy 'à' HH:mm", { locale: fr }) : "";
}

export function heure(d: string | Date | null | undefined): string {
  const x = versDate(d);
  return x ? format(x, "HH:mm", { locale: fr }) : "";
}

/** « il y a 5 min » */
export function ilYa(d: string | Date | null | undefined): string {
  const x = versDate(d);
  if (!x) return "jamais";
  if (Date.now() - x.getTime() < 45_000) return "à l'instant";
  return formatDistanceToNowStrict(x, { locale: fr, addSuffix: true });
}

export function taille(octets: number | null | undefined): string {
  if (octets == null) return "";
  if (octets < 1024) return `${octets} o`;
  if (octets < 1024 * 1024) return `${(octets / 1024).toFixed(0)} Ko`;
  return `${(octets / 1024 / 1024).toFixed(1).replace(".", ",")} Mo`;
}

export function montant(v: number, devise?: string | null): string {
  const d = (devise ?? "").toUpperCase();
  const code = /^[A-Z]{3}$/.test(d) ? d : undefined;
  try {
    return new Intl.NumberFormat("fr-FR", {
      style: code ? "currency" : "decimal",
      currency: code,
      maximumFractionDigits: 2,
    }).format(v);
  } catch {
    return `${v.toLocaleString("fr-FR")} ${d}`.trim();
  }
}

export function pluriel(n: number, singulier: string, plurielForme?: string): string {
  return `${n} ${n > 1 ? (plurielForme ?? singulier + "s") : singulier}`;
}
