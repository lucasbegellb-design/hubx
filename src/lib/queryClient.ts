import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { estErreurReseau, signalerErreurReseau } from "./online";
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
      gcTime: 10 * 60_000,
      retry: (n, e) => !estErreurReseau(e) && n < 2,
      refetchOnWindowFocus: false,
    },
    mutations: { retry: false },
  },
});
