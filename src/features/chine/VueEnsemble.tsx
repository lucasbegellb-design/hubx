import { Link } from "react-router-dom";
import type { LigneChine } from "@shared/chine.ts";
import { EtatVide, Section } from "@/components/common";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { dateCourte, montant } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { useAnalyseChine } from "./api";

type Analyse = ReturnType<typeof useAnalyseChine>;

function LigneAlerte({ l, detail, alerte }: { l: LigneChine; detail: string; alerte?: boolean }) {
  return (
    <li className="flex items-baseline gap-3 px-3 py-2">
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{l.fournisseur ?? "Fournisseur ?"}</span>
        {l.po ? <span className="text-muted-foreground"> · {l.po}</span> : null}
      </span>
      {l.montant !== null ? <span className="shrink-0 tabular">{montant(l.montant, l.devise)}</span> : null}
      <span className={cn("w-40 shrink-0 text-right text-sm tabular", alerte ? "font-medium text-retard" : "text-muted-foreground")}>{detail}</span>
    </li>
  );
}

export function VueEnsemble({ a }: { a: Analyse }) {
  const { estAdmin } = useAuth();
  if (!a.configure) {
    return (
      <div className="p-6">
        <EtatVide
          titre="Indique quelles colonnes contiennent les montants, échéances et livraisons."
          action={
            estAdmin ? (
              <Button asChild variant="outline">
                <Link to="/parametres?section=chine">Configurer le mapping</Link>
              </Button>
            ) : undefined
          }
        >
          Le mapping des colonnes débloque les montants engagés, payés, restant à payer et les alertes (paiements dus sous 7 jours,
          livraisons en retard). {estAdmin ? "" : "Demande à l'administrateur de le configurer."} Les onglets restent consultables tels quels.
        </EtatVide>
      </div>
    );
  }
  const { kpi, alertes } = a;
  return (
    <div className="grid gap-8 p-6 xl:grid-cols-2">
      <Section titre="Montants par devise" className="xl:col-span-2">
        {kpi.parDevise.length ? (
          <div className="overflow-hidden rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead className="border-b text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Devise</th>
                  <th className="px-3 py-2 text-right font-medium">Engagé</th>
                  <th className="px-3 py-2 text-right font-medium">Payé</th>
                  <th className="px-3 py-2 text-right font-medium">Reste à payer</th>
                  <th className="w-48 px-3 py-2 text-left font-medium">Avancement</th>
                </tr>
              </thead>
              <tbody>
                {kpi.parDevise.map((k) => {
                  const part = k.engage > 0 ? Math.round((k.paye / k.engage) * 100) : 0;
                  return (
                    <tr key={k.devise} className="border-b last:border-b-0">
                      <td className="px-3 py-2.5 font-medium">{k.devise}</td>
                      <td className="px-3 py-2.5 text-right text-base tabular">{montant(k.engage, k.devise)}</td>
                      <td className="px-3 py-2.5 text-right text-base tabular text-fait">{montant(k.paye, k.devise)}</td>
                      <td className="px-3 py-2.5 text-right text-base font-semibold tabular">{montant(k.reste, k.devise)}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${part} % payé`}>
                            <div className="h-full rounded-full bg-fait" style={{ width: `${part}%` }} />
                          </div>
                          <span className="w-10 text-right text-xs tabular text-muted-foreground">{part} %</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun montant lisible dans les colonnes mappées.</p>
        )}
      </Section>

      <Section titre="Paiements dus sous 7 jours" compteur={alertes.paiementsDus.length}>
        {alertes.paiementsDus.length ? (
          <ul className="divide-y rounded-lg border bg-card">
            {alertes.paiementsDus.map((l) => (
              <LigneAlerte key={`${l.onglet}-${l.index}`} l={l} alerte={l.enRetard} detail={l.enRetard ? `en retard · ${dateCourte(l.date_echeance)}` : `dû le ${dateCourte(l.date_echeance)}`} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun paiement à prévoir cette semaine.</p>
        )}
      </Section>

      <Section titre="Livraisons en retard" compteur={alertes.livraisonsEnRetard.length}>
        {alertes.livraisonsEnRetard.length ? (
          <ul className="divide-y rounded-lg border bg-card">
            {alertes.livraisonsEnRetard.map((l) => (
              <LigneAlerte key={`${l.onglet}-${l.index}`} l={l} alerte detail={`prévue ${dateCourte(l.livraison_prevue)} · ${l.joursRetard} j`} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Toutes les livraisons sont dans les temps.</p>
        )}
      </Section>

      <Section titre="Prochaines échéances" compteur={kpi.prochainesEcheances.length} className="xl:col-span-2">
        {kpi.prochainesEcheances.length ? (
          <ul className="divide-y rounded-lg border bg-card">
            {kpi.prochainesEcheances.map((l) => (
              <LigneAlerte key={`${l.onglet}-${l.index}`} l={l} detail={dateCourte(l.date_echeance)} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucune échéance à venir non réglée.</p>
        )}
      </Section>
    </div>
  );
}
