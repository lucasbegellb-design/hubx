// Cache local des données (affichage instantané au lancement, consultation hors ligne).
// Restauré au démarrage puis rafraîchi depuis le serveur ; vidé à la déconnexion.
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { removeOldestQuery, type PersistQueryClientOptions } from "@tanstack/react-query-persist-client";
import type { Query } from "@tanstack/react-query";

export const DUREE_CACHE = 3 * 86_400_000;

/** Requêtes volumineuses ou éphémères non conservées sur le disque. */
function persistable(q: Query): boolean {
  if (q.state.status !== "success") return false;
  const [a, b] = q.queryKey as string[];
  if (a === "premier_admin_possible") return false;
  if (a === "chine_snapshots" && b !== "dernier") return false;
  if (a === "process" && (b === "versions" || b === "recherche")) return false;
  return true;
}

function stockage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

export const optionsPersistance: Omit<PersistQueryClientOptions, "queryClient"> = {
  persister: createSyncStoragePersister({
    storage: stockage(),
    key: "hubx-cache",
    throttleTime: 1500,
    retry: removeOldestQuery,
  }),
  maxAge: DUREE_CACHE,
  buster: import.meta.env.VITE_APP_VERSION ?? "dev",
  dehydrateOptions: { shouldDehydrateQuery: persistable },
};
