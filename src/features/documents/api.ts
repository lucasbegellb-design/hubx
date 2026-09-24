import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export function useDocuments() {
  return useQuery({
    queryKey: ["documents", "liste"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data;
    },
  });
}
