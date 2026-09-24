// Utilitaires HTTP communs aux Edge Functions (CORS, réponses JSON, erreurs lisibles).

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

/** Enveloppe un handler : CORS, erreurs converties en JSON `{ erreur }`, aucun détail sensible loggé. */
export function servir(handler: (req: Request) => Promise<Response>) {
  Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
    if (req.method !== "POST") return json({ erreur: "Méthode non autorisée." }, 405);
    try {
      return await handler(req);
    } catch (e) {
      if (e instanceof HttpError) return json({ erreur: e.message }, e.status);
      // Log minimal : type d'erreur uniquement, jamais le contenu des données.
      console.error("Erreur interne", e instanceof Error ? e.name + ": " + e.message.slice(0, 200) : "inconnue");
      return json({ erreur: "Erreur interne du serveur. Réessaie dans un instant." }, 500);
    }
  });
}

export async function lireCorps<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
