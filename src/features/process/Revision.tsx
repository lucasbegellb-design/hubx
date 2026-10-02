import { aujourdhuiParis } from "@shared/dates.ts";
import { etatRevision } from "@shared/process";
import { CheckCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { dateCourte } from "@/lib/format";
import { LIBELLE_STATUT, type Process, type StatutTache } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useExecutions } from "./api";

const PERIODES = [1, 3, 6, 12, 24];

/** Rythme de révision, prochaine échéance et « Marquer comme revu ». */
export function BarreRevision({
  process: p,
  onChamp,
}: {
  process: Process;
  onChamp: (maj: Partial<Pick<Process, "revision_mois" | "revise_le">>, message?: string) => void;
}) {
  const { peutEcrire } = useEcriture();
  const aujourdhui = aujourdhuiParis();
  const r = etatRevision(p, aujourdhui);
  const periodes = PERIODES.includes(p.revision_mois) ? PERIODES : [...PERIODES, p.revision_mois].sort((a, b) => a - b);
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted-foreground">Revoir tous les</span>
      <Select
        value={String(p.revision_mois)}
        onValueChange={(v) => onChamp({ revision_mois: Number(v) }, "Rythme de révision enregistré")}
        disabled={!peutEcrire}
      >
        <SelectTrigger className="h-8 w-24" aria-label="Rythme de révision">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {periodes.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {m} mois
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {p.statut === "actif" ? (
        <span className={cn(r.etat === "a_reviser" ? "font-medium text-retard" : "text-muted-foreground")}>
          {r.etat === "a_reviser" ? "révision due depuis le " : "prochaine révision le "}
          {dateCourte(r.prochaine)}
        </span>
      ) : null}
      <Button
        variant="outline"
        size="sm"
        className="h-8"
        onClick={() => onChamp({ revise_le: aujourdhui }, "Marqué comme revu")}
        disabled={!peutEcrire || p.revise_le === aujourdhui}
        title="Le contenu est toujours juste : repousse la prochaine révision"
      >
        <CheckCheck aria-hidden />
        Marquer comme revu
      </Button>
    </div>
  );
}

/** Historique des exécutions (tâches créées par « Exécuter »). */
export function Executions({ processId }: { processId: string }) {
  const r = useReferentiels();
  const q = useExecutions(processId);
  if (!q.data?.length) return null;
  return (
    <section className="mt-10 space-y-2 border-t pt-4" aria-label="Exécutions">
      <h2 className="text-sm font-semibold text-muted-foreground">
        Exécutions <span className="tabular font-normal">{q.data.length}</span>
      </h2>
      <ul className="space-y-1 text-sm">
        {q.data.map((t) => (
          <li key={t.id} className="flex items-baseline gap-2">
            <Link to={`/taches?t=${t.id}`} className="min-w-0 flex-1 truncate hover:underline">
              {dateCourte(t.created_at)} · {r.nomMembre(t.assigne_a) || "—"}
            </Link>
            <span className={cn("shrink-0", t.statut === "fait" ? "text-fait" : "text-muted-foreground")}>
              {t.statut === "fait" && t.done_at
                ? `faite le ${dateCourte(t.done_at)}`
                : LIBELLE_STATUT[t.statut as StatutTache]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
