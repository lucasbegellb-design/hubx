import { aujourdhuiParis } from "@shared/dates.ts";
import { etatRevision, santeProcess, type ProcessSante } from "@shared/process";
import { HeartPulse } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useReferentiels } from "@/features/referentiels/api";
import { dateCourte } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useProcessListe } from "./api";

/** Pastille de révision d'un process actif (rien s'il est à jour). */
export function BadgeRevision({ process }: { process: ProcessSante }) {
  if (process.statut !== "actif") return null;
  const r = etatRevision(process, aujourdhuiParis());
  if (r.etat === "a_jour") return null;
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 font-normal",
        r.etat === "a_reviser" ? "border-retard/40 text-retard" : "text-muted-foreground",
      )}
      title={`Révision prévue le ${dateCourte(r.prochaine)}`}
    >
      {r.etat === "a_reviser" ? "À réviser" : "À revoir bientôt"}
    </Badge>
  );
}

function Liste({ titre, process }: { titre: string; process: ProcessSante[] }) {
  if (!process.length) return null;
  const aujourdhui = aujourdhuiParis();
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-sm font-medium">
        {titre} <span className="tabular font-normal text-muted-foreground">{process.length}</span>
      </p>
      <ul className="space-y-0.5 text-sm">
        {process.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-baseline gap-2">
            <Link to={`/process/${p.id}`} className="min-w-0 truncate hover:underline">
              {p.titre}
            </Link>
            <span className="shrink-0 text-xs text-muted-foreground">
              {dateCourte(etatRevision(p, aujourdhui).prochaine)}
            </span>
          </li>
        ))}
        {process.length > 5 ? <li className="text-xs text-muted-foreground">et {process.length - 5} autres</li> : null}
      </ul>
    </div>
  );
}

/** Vue d'ensemble pour la passation : révisions dues, process sans responsable, domaines non couverts. */
export function PanneauSante({ process }: { process: ProcessSante[] }) {
  const r = useReferentiels();
  const s = useMemo(() => santeProcess(process, r.listeDomaines, aujourdhuiParis()), [process, r.listeDomaines]);
  const total = s.aReviser.length + s.bientot.length + s.sansResponsable.length + s.domainesSansProcess.length;
  if (!process.length) return null;
  return (
    <section className="max-w-5xl space-y-3 rounded-lg border bg-card p-4" aria-label="Santé des process">
      <div className="flex items-center gap-2">
        <HeartPulse className={cn("size-4", total ? "text-retard" : "text-fait")} aria-hidden />
        <p className="font-medium">Santé des process</p>
        <p className="text-sm text-muted-foreground">
          {total
            ? "ce qu'il faut mettre à jour pour qu'une passation se passe bien"
            : "tous les process actifs sont à jour et chaque domaine en a au moins un"}
        </p>
      </div>
      {total ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Liste titre="À réviser" process={s.aReviser} />
          <Liste titre="À revoir bientôt" process={s.bientot} />
          {s.sansResponsable.length ? (
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                Sans responsable{" "}
                <span className="tabular font-normal text-muted-foreground">{s.sansResponsable.length}</span>
              </p>
              <ul className="space-y-0.5 text-sm">
                {s.sansResponsable.slice(0, 5).map((p) => (
                  <li key={p.id} className="truncate">
                    <Link to={`/process/${p.id}`} className="hover:underline">
                      {p.titre}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {s.domainesSansProcess.length ? (
            <div className="min-w-0 space-y-1">
              <p className="text-sm font-medium">
                Domaines sans process actif{" "}
                <span className="tabular font-normal text-muted-foreground">{s.domainesSansProcess.length}</span>
              </p>
              <p className="text-sm text-muted-foreground">{s.domainesSansProcess.map((d) => d.nom).join(", ")}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Rappel discret sur Aujourd'hui : process actifs dont la révision est due. */
export function ProcessAReviserResume() {
  const liste = useProcessListe();
  const aReviser = useMemo(() => santeProcess(liste.data ?? [], [], aujourdhuiParis()).aReviser, [liste.data]);
  if (!aReviser.length) return null;
  return (
    <section className="space-y-1">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          Process à réviser <span className="ml-1 tabular font-normal">{aReviser.length}</span>
        </h2>
        <div className="flex-1" />
        <Link to="/process" className="text-sm text-primary hover:underline">
          Voir la santé des process
        </Link>
      </div>
      <ul className="space-y-0.5 text-sm">
        {aReviser.slice(0, 3).map((p) => (
          <li key={p.id}>
            <Link to={`/process/${p.id}`} className="block truncate rounded-md px-2 py-1 hover:bg-accent/50">
              {p.titre}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
