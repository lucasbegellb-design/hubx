import { useSearchParams } from "react-router-dom";
import { EnteteePage } from "@/components/common";
import { useAuth } from "@/features/auth/AuthProvider";
import { ParametresChine } from "@/features/chine/ParametresChine";
import { cn } from "@/lib/utils";
import { SectionBureau } from "./sections/Bureau";
import { SectionCompte } from "./sections/Compte";
import { SectionComptes } from "./sections/Comptes";
import { SectionIA } from "./sections/IA";
import { SectionReferentiels } from "./sections/Referentiels";
import { SectionSysteme } from "./sections/Systeme";

const SECTIONS = [
  { id: "compte", libelle: "Mon compte", composant: SectionCompte },
  { id: "bureau", libelle: "Apparence et bureau", composant: SectionBureau },
  { id: "comptes", libelle: "Comptes et rôles", composant: SectionComptes },
  { id: "referentiels", libelle: "Domaines et projets", composant: SectionReferentiels },
  { id: "chine", libelle: "Suivi Chine", composant: ParametresChine, admin: true },
  { id: "ia", libelle: "IA et rapports", composant: SectionIA },
  { id: "systeme", libelle: "Mises à jour et export", composant: SectionSysteme },
] as const;

export default function PageParametres() {
  const { estAdmin } = useAuth();
  const [params, setParams] = useSearchParams();
  const actuelle = SECTIONS.find((s) => s.id === params.get("section")) ?? SECTIONS[0];
  const Composant = actuelle.composant;
  return (
    <div className="flex h-full flex-col">
      <EnteteePage titre="Paramètres" />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Sections des paramètres" className="w-52 shrink-0 space-y-0.5 border-r bg-card p-2">
          {SECTIONS.filter((s) => !("admin" in s) || estAdmin).map((s) => (
            <button
              key={s.id}
              type="button"
              aria-current={s.id === actuelle.id ? "page" : undefined}
              onClick={() => setParams({ section: s.id }, { replace: true })}
              className={cn(
                "flex h-8 w-full items-center rounded-md px-2.5 text-left",
                s.id === actuelle.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60",
              )}
            >
              {s.libelle}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="max-w-3xl">
            <h2 className="mb-5 text-lg font-semibold">{actuelle.libelle}</h2>
            <Composant />
          </div>
        </div>
      </div>
    </div>
  );
}
