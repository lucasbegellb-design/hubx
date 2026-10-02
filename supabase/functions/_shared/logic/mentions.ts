// @mentions dans les commentaires : « @Edwin » désigne le membre dont le prénom (ou le nom) commence ainsi.

export interface Personne {
  user_id: string;
  nom: string;
}

function normaliser(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

const MOTIF = /@([\p{L}][\p{L}'-]*)/gu;

function trouver(jeton: string, personnes: Personne[]): Personne | undefined {
  const j = normaliser(jeton);
  return (
    personnes.find((p) => normaliser(p.nom.split(/\s+/)[0]) === j) ??
    personnes.find((p) => normaliser(p.nom.replace(/\s+/g, "")).startsWith(j))
  );
}

/** Identifiants des membres mentionnés (sans doublon, dans l'ordre d'apparition). */
export function extraireMentions(texte: string, personnes: Personne[]): string[] {
  const ids: string[] = [];
  for (const m of texte.matchAll(MOTIF)) {
    const p = trouver(m[1], personnes);
    if (p && !ids.includes(p.user_id)) ids.push(p.user_id);
  }
  return ids;
}

/** Découpe un commentaire pour l'affichage, en isolant les mentions reconnues. */
export function segmenterMentions(texte: string, personnes: Personne[]): { texte: string; userId?: string }[] {
  const segments: { texte: string; userId?: string }[] = [];
  let dernier = 0;
  for (const m of texte.matchAll(MOTIF)) {
    const p = trouver(m[1], personnes);
    if (!p) continue;
    if (m.index > dernier) segments.push({ texte: texte.slice(dernier, m.index) });
    segments.push({ texte: m[0], userId: p.user_id });
    dernier = m.index + m[0].length;
  }
  if (dernier < texte.length) segments.push({ texte: texte.slice(dernier) });
  return segments;
}

/** Mention en cours de frappe juste avant le curseur (« @ed| » → « ed »), pour l'autocomplétion. */
export function mentionEnCours(texte: string, curseur: number): { debut: number; recherche: string } | null {
  const avant = texte.slice(0, curseur);
  const m = /(^|\s)@([\p{L}'-]*)$/u.exec(avant);
  return m ? { debut: curseur - m[2].length - 1, recherche: m[2] } : null;
}
