import { useSearchParams } from "react-router-dom";
import { EnteteePage } from "@/components/common";
import { ParametresChine } from "@/features/chine/ParametresChine";
import { cn } from "@/lib/utils";

const SECTIONS = [{ id: "chine", libelle: "Suivi Chine" }] as const;

export default function PageParametres() {
  const [params, setParams] = useSearchParams();
  const section = params.get("section") ?? SECTIONS[0].id;
  return (
    <div className="flex h-full flex-col">
      <EnteteePage titre="Paramètres" />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Sections des paramètres" className="w-52 shrink-0 space-y-0.5 border-r bg-card p-2">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setParams({ section: s.id }, { replace: true })}
              className={cn(
                "flex h-8 w-full items-center rounded-md px-2.5 text-left",
                section === s.id ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60",
              )}
            >
              {s.libelle}
            </button>
          ))}
        </nav>
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          <div className="max-w-3xl">{section === "chine" ? <ParametresChine /> : null}</div>
        </div>
      </div>
    </div>
  );
}
