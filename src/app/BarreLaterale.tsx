import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  CheckSquare,
  FileText,
  Search,
  Settings,
  Ship,
  StickyNote,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { Kbd } from "@/components/common";
import { useAuth } from "@/features/auth/AuthProvider";
import { useRaccourci } from "@/hooks/useRaccourci";
import { aujourdhuiParis } from "@shared/dates.ts";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/ui";

export const NAVIGATION: { to: string; libelle: string; icone: LucideIcon }[] = [
  { to: "/aujourdhui", libelle: "Aujourd'hui", icone: Sun },
  { to: "/taches", libelle: "Tâches", icone: CheckSquare },
  { to: "/postits", libelle: "Post-its", icone: StickyNote },
  { to: "/process", libelle: "Process", icone: BookOpen },
  { to: "/chine", libelle: "Suivi Chine", icone: Ship },
  { to: "/documents", libelle: "Documents", icone: FileText },
  { to: "/rapports", libelle: "Rapports", icone: BarChart3 },
];

function useCompteurRetard() {
  return useQuery({
    queryKey: ["taches", "compteur-retard"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("taches")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .neq("statut", "fait")
        .lt("echeance", aujourdhuiParis());
      if (error) throw error;
      return count ?? 0;
    },
  });
}

function Lien({ to, libelle, icone: Icone, badge }: { to: string; libelle: string; icone: LucideIcon; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex h-8 items-center gap-2.5 rounded-md px-2.5 text-base transition-colors",
          isActive ? "bg-accent font-medium text-foreground" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
        )
      }
    >
      <Icone className="size-4 shrink-0" aria-hidden />
      <span className="flex-1 truncate">{libelle}</span>
      {badge ? (
        <span className="tabular text-xs font-medium text-retard" aria-label={`${badge} en retard`}>
          {badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function BarreLaterale() {
  const { membre } = useAuth();
  const retard = useCompteurRetard();
  const ouvrirPalette = useUi((s) => s.setPaletteOuverte);
  const naviguer = useNavigate();

  // Ctrl+1…7 : navigation rapide entre modules
  useRaccourci("mod+1", () => naviguer(NAVIGATION[0].to));
  useRaccourci("mod+2", () => naviguer(NAVIGATION[1].to));
  useRaccourci("mod+3", () => naviguer(NAVIGATION[2].to));
  useRaccourci("mod+4", () => naviguer(NAVIGATION[3].to));
  useRaccourci("mod+5", () => naviguer(NAVIGATION[4].to));
  useRaccourci("mod+6", () => naviguer(NAVIGATION[5].to));
  useRaccourci("mod+7", () => naviguer(NAVIGATION[6].to));

  return (
    <nav aria-label="Navigation principale" className="flex w-52 shrink-0 flex-col border-r bg-card px-2 py-3">
      <div className="mb-3 px-2.5">
        <p className="text-base font-semibold">Hub XTIM</p>
      </div>
      <button
        type="button"
        onClick={() => ouvrirPalette(true)}
        className="mb-3 flex h-8 items-center gap-2 rounded-md border px-2.5 text-sm text-muted-foreground hover:bg-accent/60"
      >
        <Search className="size-4" aria-hidden />
        <span className="flex-1 text-left">Rechercher</span>
        <Kbd>Ctrl K</Kbd>
      </button>
      <div className="flex flex-col gap-0.5">
        {NAVIGATION.map((n) => (
          <Lien key={n.to} {...n} badge={n.to === "/taches" ? retard.data : undefined} />
        ))}
      </div>
      <div className="flex-1" />
      <Lien to="/parametres" libelle="Paramètres" icone={Settings} />
      <p className="mt-2 truncate px-2.5 text-xs text-muted-foreground">{membre?.nom}</p>
    </nav>
  );
}
