import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { estErreurReseau, signalerErreurReseau } from "./online";
import { DUREE_CACHE } from "./persistance";
import { messageErreur } from "./supabase";

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (e) => {
      if (estErreurReseau(e)) signalerErreurReseau();
    },
  }),
  mutationCache: new MutationCache({
    onError: (e, _v, _c, mutation) => {
      if (estErreurReseau(e)) signalerErreurReseau();
      if (!mutation.options.onError) toast.error(messageErreur(e));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      // Doit couvrir la durée du cache local (sinon les données restaurées seraient aussitôt jetées)
      gcTime: DUREE_CACHE,
      retry: (n, e) => !estErreurReseau(e) && n < 2,
      refetchOnWindowFocus: false,
    },
    // Les mutations s'exécutent toujours : hors ligne, la garde verifierEcriture() les refuse aussitôt (pas de file d'attente invisible).
    mutations: { retry: false, networkMode: "always" },
  },
});
