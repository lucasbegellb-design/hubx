// Appels à l'API Anthropic (SDK officiel) — la clé ne quitte jamais le serveur.
import Anthropic from "npm:@anthropic-ai/sdk@^0";
import { clientAdmin } from "./auth.ts";
import { HttpError } from "./http.ts";

export const MODELE_DEFAUT = "claude-sonnet-5";

export function iaDisponible(): boolean {
  return Boolean(Deno.env.get("ANTHROPIC_API_KEY"));
}

export async function modeleConfigure(): Promise<string> {
  const { data } = await clientAdmin().from("parametres").select("modele_ia").limit(1).maybeSingle();
  return data?.modele_ia || MODELE_DEFAUT;
}

type Contenu = Anthropic.MessageParam["content"];

/**
 * Demande une réponse JSON conforme au schéma (structured outputs, `output_config.format`).
 * Lève une HttpError lisible en cas d'indisponibilité.
 */
export async function demanderJson<T>(options: {
  system: string;
  contenu: Contenu;
  schema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const cle = Deno.env.get("ANTHROPIC_API_KEY");
  if (!cle) throw new HttpError(503, "Analyse IA indisponible : clé API Anthropic non configurée (voir SETUP.md).");
  const client = new Anthropic({ apiKey: cle, maxRetries: 2 });
  const modele = await modeleConfigure();

  let reponse: Anthropic.Message;
  try {
    reponse = await client.messages.create({
      model: modele,
      max_tokens: options.maxTokens ?? 16000,
      system: options.system,
      messages: [{ role: "user", content: options.contenu }],
      output_config: { format: { type: "json_schema", schema: options.schema } },
    } as Anthropic.MessageCreateParamsNonStreaming);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError)
      throw new HttpError(502, "Clé API Anthropic refusée. Vérifie le secret ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.NotFoundError)
      throw new HttpError(502, `Modèle IA « ${modele} » introuvable. Corrige-le dans Paramètres > IA.`);
    if (e instanceof Anthropic.RateLimitError)
      throw new HttpError(503, "Limite d'utilisation de l'IA atteinte. Réessaie dans quelques minutes.");
    if (e instanceof Anthropic.BadRequestError)
      throw new HttpError(502, "Requête IA refusée (fichier trop volumineux ou format non pris en charge).");
    if (e instanceof Anthropic.APIError)
      throw new HttpError(502, `Service IA indisponible (code ${e.status ?? "?"}). Réessaie plus tard.`);
    throw new HttpError(502, "Service IA injoignable. Réessaie plus tard.");
  }

  if (reponse.stop_reason === "refusal") throw new HttpError(422, "L'IA a refusé de traiter ce contenu.");
  if (reponse.stop_reason === "max_tokens") throw new HttpError(422, "Réponse IA incomplète (contenu trop long).");
  const texte = reponse.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(texte) as T;
  } catch {
    throw new HttpError(502, "Réponse IA illisible. Réessaie.");
  }
}
