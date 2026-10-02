import { Check, Circle, Loader2, X } from "lucide-react";
import type { Etape } from "./installation";
import { cn } from "@/lib/utils";

/** Liste des étapes d'installation avec leur état. */
export function ListeEtapes({ etapes }: { etapes: Etape[] }) {
  return (
    <ol className="space-y-2" aria-live="polite">
      {etapes.map((e) => (
        <li key={e.id} className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
              e.statut === "ok" && "border-fait bg-fait text-white",
              e.statut === "erreur" && "border-urgent bg-urgent text-white",
              e.statut === "encours" && "border-primary text-primary",
              e.statut === "attente" && "text-muted-foreground",
            )}
            aria-hidden
          >
            {e.statut === "ok" ? (
              <Check className="size-3" strokeWidth={3} />
            ) : e.statut === "erreur" ? (
              <X className="size-3" strokeWidth={3} />
            ) : e.statut === "encours" ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Circle className="size-2 fill-current" />
            )}
          </span>
          <div className="min-w-0">
            <p
              className={cn(e.statut === "attente" && "text-muted-foreground", e.statut === "encours" && "font-medium")}
            >
              {e.libelle}
            </p>
            {e.detail ? (
              <p className={cn("text-sm", e.statut === "erreur" ? "text-urgent" : "text-muted-foreground")}>
                {e.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
