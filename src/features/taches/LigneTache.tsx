import { Check } from "lucide-react";
import { forwardRef } from "react";
import { ajouterJours } from "@shared/dates.ts";
import { joursDeRetard } from "@shared/echeances.ts";
import { PastilleDomaine } from "@/components/common";
import { dateCourte } from "@/lib/format";
import type { Tache } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReferentiels } from "@/features/referentiels/api";

export function libelleEcheance(echeance: string, aujourdhui: string): { texte: string; retard: boolean } {
  if (echeance < aujourdhui) {
    const j = joursDeRetard(echeance, aujourdhui);
    return { texte: j === 1 ? "hier" : `${dateCourte(echeance)} · +${j} j`, retard: true };
  }
  if (echeance === aujourdhui) return { texte: "aujourd'hui", retard: false };
  if (echeance === ajouterJours(aujourdhui, 1)) return { texte: "demain", retard: false };
  return { texte: dateCourte(echeance), retard: false };
}

interface Props {
  tache: Tache;
  aujourdhui: string;
  selectionnee?: boolean;
  onSelection?: () => void;
  onOuvrir?: () => void;
  onBasculer: () => void;
  compacte?: boolean;
}

/** Ligne dense d'une tâche (liste Tâches, écran Aujourd'hui). */
export const LigneTache = forwardRef<HTMLButtonElement, Props>(function LigneTache(
  { tache: t, aujourdhui, selectionnee, onSelection, onOuvrir, onBasculer, compacte },
  ref,
) {
  const r = useReferentiels();
  const { userId } = useAuth();
  const domaine = t.domaine_id ? r.domaines.get(t.domaine_id) : undefined;
  const projet = t.projet_id ? r.projets.get(t.projet_id) : undefined;
  const fait = t.statut === "fait";
  const ech = t.echeance && !fait ? libelleEcheance(t.echeance, aujourdhui) : null;
  // Seuls les noms des autres membres sont affichés (son propre nom répété = bruit)
  const assigne = t.assigne_a && t.assigne_a !== userId ? r.nomMembre(t.assigne_a) : "";

  return (
    <li
      className={cn(
        "group flex min-h-9 items-center gap-3 rounded-md px-2 transition-colors",
        selectionnee ? "bg-accent" : "hover:bg-accent/50",
      )}
      onMouseDown={onSelection}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={fait}
        aria-label={fait ? `Rouvrir « ${t.titre} »` : `Marquer « ${t.titre} » comme faite`}
        onClick={(e) => {
          e.stopPropagation();
          onBasculer();
        }}
        className={cn(
          "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
          fait ? "animate-check-pop border-fait bg-fait text-white" : "border-muted-foreground/50 hover:border-fait",
        )}
      >
        {fait ? <Check className="size-3" strokeWidth={3} aria-hidden /> : null}
      </button>
      <button
        ref={ref}
        type="button"
        onClick={onOuvrir}
        className="flex min-w-0 flex-1 items-baseline gap-2 rounded py-1.5 text-left"
      >
        {t.priorite === "urgente" && !fait ? (
          <span className="shrink-0 text-xs font-semibold text-urgent">Urgent</span>
        ) : null}
        <span className={cn("min-w-0 truncate", fait && "text-muted-foreground line-through decoration-muted-foreground/50")}>
          {t.titre}
        </span>
        {t.statut === "en_attente" ? (
          <span className="min-w-0 shrink-[3] truncate text-sm text-muted-foreground">
            · en attente{t.en_attente_de ? ` de ${t.en_attente_de}` : ""}
          </span>
        ) : t.statut === "en_cours" ? (
          <span className="shrink-0 text-sm text-muted-foreground">· en cours</span>
        ) : null}
      </button>
      {!compacte && projet ? <span className="hidden shrink-0 text-sm text-muted-foreground lg:inline">{projet.nom}</span> : null}
      {domaine ? <PastilleDomaine nom={domaine.nom} couleur={domaine.couleur} className="hidden w-28 shrink-0 md:inline-flex" /> : null}
      {!compacte ? (
        <span className="hidden w-16 shrink-0 truncate text-sm text-muted-foreground xl:inline" title={assigne}>
          {assigne}
        </span>
      ) : null}
      <span
        className={cn(
          "w-32 shrink-0 text-right text-sm tabular",
          ech?.retard ? "font-medium text-retard" : "text-muted-foreground",
        )}
      >
        {ech?.texte ?? (fait && t.done_at ? `fait ${dateCourte(t.done_at)}` : "")}
      </span>
    </li>
  );
});
