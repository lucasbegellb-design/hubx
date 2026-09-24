// Serveur de développement : sert toutes les Edge Functions sur http://localhost:54399/<nom>
// avec le Deno du poste (utile quand le conteneur edge-runtime local n'a pas accès à npm).
// Lancement : npm run fonctions:dev   puis VITE_FUNCTIONS_URL=http://localhost:54399 dans .env
const registre: ((req: Request) => Promise<Response>)[] = [];
(globalThis as { __hubxFonctions?: typeof registre }).__hubxFonctions = registre;

const NOMS = ["sync-chine", "analyze-document", "structure-process", "generate-report", "manage-members"];
const routes = new Map<string, (req: Request) => Promise<Response>>();
for (const nom of NOMS) {
  const avant = registre.length;
  await import(`../supabase/functions/${nom}/index.ts`);
  if (registre.length > avant) routes.set(nom, registre[registre.length - 1]);
}

const port = Number(Deno.env.get("PORT") ?? 54399);
Deno.serve({ port }, (req) => {
  const nom = new URL(req.url).pathname.split("/").filter(Boolean).pop() ?? "";
  const h = routes.get(nom);
  return h ? h(req) : new Response(JSON.stringify({ erreur: `Fonction inconnue : ${nom}` }), { status: 404 });
});
console.log(`Fonctions servies sur http://localhost:${port}/ : ${[...routes.keys()].join(", ")}`);
