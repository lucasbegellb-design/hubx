// Accès lecture seule au fichier Excel d'Edwin via Microsoft Graph (client credentials).
import { encodeBase64 } from "jsr:@std/encoding@1/base64";
import { HttpError } from "../_shared/http.ts";

export interface IdentifiantsAzure {
  tenant: string;
  client: string;
  secret: string;
}

export function identifiantsAzure(): IdentifiantsAzure | null {
  const tenant = Deno.env.get("AZURE_TENANT_ID");
  const client = Deno.env.get("AZURE_CLIENT_ID");
  const secret = Deno.env.get("AZURE_CLIENT_SECRET");
  return tenant && client && secret ? { tenant, client, secret } : null;
}

async function jeton(id: IdentifiantsAzure): Promise<string> {
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(id.tenant)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: id.client,
      client_secret: id.secret,
      scope: "https://graph.microsoft.com/.default",
      grant_type: "client_credentials",
    }),
  });
  if (!r.ok) {
    throw new HttpError(
      502,
      "Connexion Microsoft refusée : vérifie AZURE_TENANT_ID, AZURE_CLIENT_ID et AZURE_CLIENT_SECRET (secret expiré ?).",
    );
  }
  return (await r.json()).access_token as string;
}

/** Encodage d'un lien de partage pour /shares/{id} (u! + base64url sans remplissage). */
export function encoderLienPartage(url: string): string {
  const b64 = encodeBase64(new TextEncoder().encode(url.trim()));
  return "u!" + b64.replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

function erreurGraph(status: number): HttpError {
  if (status === 401 || status === 403) {
    return new HttpError(
      502,
      "Accès refusé par Microsoft : la permission Files.Read.All (application) et le consentement administrateur sont nécessaires (SETUP.md, étape 4).",
    );
  }
  if (status === 404)
    return new HttpError(
      502,
      "Fichier introuvable : le lien de partage a peut-être été supprimé ou remplacé. Colle le nouveau lien dans Paramètres › Suivi Chine.",
    );
  if (status === 429)
    return new HttpError(503, "Microsoft limite temporairement les accès. Nouvel essai au prochain passage.");
  return new HttpError(502, `Microsoft Graph indisponible (code ${status}). Nouvel essai au prochain passage.`);
}

export interface FichierOneDrive {
  id: string;
  nom: string;
  modifieLe: string | null;
  octets?: Uint8Array;
}

export async function lireFichierPartage(
  id: IdentifiantsAzure,
  lien: string,
  telecharger: boolean,
): Promise<FichierOneDrive> {
  const t = await jeton(id);
  const enTetes = { Authorization: `Bearer ${t}` };
  const base = `https://graph.microsoft.com/v1.0/shares/${encoderLienPartage(lien)}/driveItem`;
  const r = await fetch(`${base}?$select=id,name,lastModifiedDateTime,file`, { headers: enTetes });
  if (!r.ok) throw erreurGraph(r.status);
  const item = await r.json();
  if (!item.file) throw new HttpError(422, "Le lien de partage pointe vers un dossier, pas vers un fichier Excel.");
  const fichier: FichierOneDrive = { id: item.id, nom: item.name, modifieLe: item.lastModifiedDateTime ?? null };
  if (!/\.(xlsx|xlsm|xls)$/i.test(item.name)) throw new HttpError(422, `« ${item.name} » n'est pas un fichier Excel.`);
  if (telecharger) {
    const c = await fetch(`${base}/content`, { headers: enTetes, redirect: "follow" });
    if (!c.ok) throw erreurGraph(c.status);
    fichier.octets = new Uint8Array(await c.arrayBuffer());
  }
  return fichier;
}
