// Flux iCalendar (RFC 5545) pour l'abonnement Outlook / Google / Apple.
import type { Evenement } from "./calendrier.ts";
import { ajouterJours } from "./dates.ts";

/** Échappe un texte iCal (antislash, point-virgule, virgule, retours à la ligne). */
export function echapper(texte: string): string {
  return texte
    .replace(/\\/g, String.raw`\\`)
    .replace(/;/g, String.raw`\;`)
    .replace(/,/g, String.raw`\,`)
    .replace(/\r?\n/g, String.raw`\n`);
}

/** Plie une ligne à 75 octets (UTF-8), continuation précédée d'une espace. */
export function plier(ligne: string): string {
  const enc = new TextEncoder();
  if (enc.encode(ligne).length <= 75) return ligne;
  const morceaux: string[] = [];
  let courant = "";
  let taille = 0;
  for (const car of ligne) {
    const n = enc.encode(car).length;
    const max = morceaux.length ? 74 : 75; // la continuation commence par une espace
    if (taille + n > max) {
      morceaux.push(courant);
      courant = "";
      taille = 0;
    }
    courant += car;
    taille += n;
  }
  morceaux.push(courant);
  return morceaux.join("\r\n ");
}

const dateIcal = (iso: string) => iso.replace(/-/g, "");
const instantIcal = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");

const CATEGORIES: Record<Evenement["type"], string> = {
  tache: "Tâche",
  rappel: "Rappel",
  paiement: "Suivi Chine",
  livraison: "Suivi Chine",
  rapport: "Rapport",
};

const PREFIXES: Record<Evenement["type"], string> = {
  tache: "",
  rappel: "Rappel : ",
  paiement: "",
  livraison: "",
  rapport: "",
};

export function genererIcal(options: {
  nom: string;
  evenements: Evenement[];
  maintenant?: Date;
  domaine?: string;
}): string {
  const stamp = instantIcal(options.maintenant ?? new Date());
  const domaine = options.domaine ?? "hub-xtim";
  const lignes = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//XTIM SAS//Hub XTIM//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${echapper(options.nom)}`,
    "X-WR-TIMEZONE:Europe/Paris",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
  ];
  for (const e of options.evenements) {
    const titre = `${e.urgent && !e.fait ? "[Urgent] " : ""}${e.fait ? "✓ " : ""}${PREFIXES[e.type]}${e.titre}`;
    lignes.push("BEGIN:VEVENT", `UID:${e.id}@${domaine}`, `DTSTAMP:${stamp}`);
    if (e.instant) {
      const debut = new Date(e.instant);
      lignes.push(`DTSTART:${instantIcal(debut)}`, `DTEND:${instantIcal(new Date(debut.getTime() + 15 * 60_000))}`);
    } else {
      lignes.push(`DTSTART;VALUE=DATE:${dateIcal(e.jour)}`, `DTEND;VALUE=DATE:${dateIcal(ajouterJours(e.jour, 1))}`);
    }
    lignes.push(`SUMMARY:${echapper(titre)}`, "TRANSP:TRANSPARENT");
    if (e.detail) lignes.push(`DESCRIPTION:${echapper(e.detail)}`);
    lignes.push(`CATEGORIES:${CATEGORIES[e.type]}`);
    if (e.instant)
      lignes.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${echapper(titre)}`, "TRIGGER:PT0M", "END:VALARM");
    lignes.push("END:VEVENT");
  }
  lignes.push("END:VCALENDAR");
  return lignes.map(plier).join("\r\n") + "\r\n";
}
