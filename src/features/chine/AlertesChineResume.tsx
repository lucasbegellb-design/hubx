import { Link } from "react-router-dom";
import { Section } from "@/components/common";
import { dateCourte, montant } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useAnalyseChine } from "./api";

/** Alertes Chine de l'écran Aujourd'hui (seulement si le mapping est configuré). */
export function AlertesChineResume() {
  const a = useAnalyseChine();
  if (!a.configure) return null;
  const { paiementsDus, livraisonsEnRetard } = a.alertes;
  const total = paiementsDus.length + livraisonsEnRetard.length;
  return (
    <Section
      titre="Alertes Chine"
      compteur={total}
      actions={
        <Link to="/chine" className="text-sm text-primary hover:underline">
          Voir le suivi
        </Link>
      }
    >
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun paiement dû sous 7 jours, aucune livraison en retard.</p>
      ) : (
        <ul className="space-y-0.5">
          {paiementsDus.slice(0, 5).map((l) => (
            <li key={`p${l.onglet}${l.index}`} className="flex items-baseline gap-2 rounded-md px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                Paiement {l.fournisseur ?? ""} {l.po ? `(${l.po})` : ""}
              </span>
              {l.montant !== null ? (
                <span className="shrink-0 text-sm tabular">{montant(l.montant, l.devise)}</span>
              ) : null}
              <span
                className={cn(
                  "w-24 shrink-0 text-right text-sm tabular",
                  l.enRetard ? "font-medium text-retard" : "text-muted-foreground",
                )}
              >
                {l.enRetard ? "en retard" : dateCourte(l.date_echeance)}
              </span>
            </li>
          ))}
          {livraisonsEnRetard.slice(0, 5).map((l) => (
            <li key={`l${l.onglet}${l.index}`} className="flex items-baseline gap-2 rounded-md px-2 py-1.5">
              <span className="min-w-0 flex-1 truncate">
                Livraison {l.po ?? ""} {l.fournisseur ? `· ${l.fournisseur}` : ""}
              </span>
              <span className="w-24 shrink-0 text-right text-sm font-medium tabular text-retard">
                {l.joursRetard} j de retard
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
