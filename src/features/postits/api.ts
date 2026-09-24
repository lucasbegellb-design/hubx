import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import type { Insertion, MiseAJour, Postit } from "@/lib/types";
import { verifierEcriture } from "@/hooks/useEcriture";

const CLE = ["postits", "liste"] as const;

/** Post-its visibles (les miens + partagés), archivés compris sur 90 jours. */
export function usePostits() {
  return useQuery({
    queryKey: CLE,
    queryFn: async () => {
      const depuis = new Date(Date.now() - 90 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from("postits")
        .select("*")
        .or(`archived_at.is.null,archived_at.gte.${depuis}`)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data;
    },
  });
}

export function useCreerPostit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Insertion<"postits">) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { data, error } = await supabase.from("postits").insert(p).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (p) => {
      qc.setQueryData<Postit[]>(CLE, (l) => (l && !l.some((x) => x.id === p.id) ? [p, ...l] : l));
      qc.invalidateQueries({ queryKey: ["postits"] });
    },
  });
}

export function useMajPostit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...maj }: MiseAJour<"postits"> & { id: string }) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { data, error } = await supabase.from("postits").update(maj).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onMutate: async ({ id, ...maj }) => {
      await qc.cancelQueries({ queryKey: CLE });
      const avant = qc.getQueryData<Postit[]>(CLE);
      qc.setQueryData<Postit[]>(CLE, (l) => l?.map((p) => (p.id === id ? { ...p, ...maj } : p)));
      return { avant };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.avant) qc.setQueryData(CLE, ctx.avant);
      if ((e as Error).message !== "hors-ligne") toast.error("Modification non enregistrée. Réessaie.");
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["postits"] }),
  });
}

export function useSupprimerPostit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (!verifierEcriture()) throw new Error("hors-ligne");
      const { error } = await supabase.from("postits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Supprimé");
      qc.invalidateQueries({ queryKey: ["postits"] });
    },
  });
}
