import type { ReactNode } from "react";
import { dateFr, montantFr, TITRES_RAPPORT, type DonneesRapport, type TacheResumee } from "@shared/rapport.ts";
import { Section } from "@/components/common";
import { cn } from "@/lib/utils";
import { GraphiqueRealise } from "./GraphiqueRealise";

function Liste({
  items,
  vide,
  rendu,
  sansDomaine,
}: {
  items: TacheResumee[];
  vide: string;
  rendu?: (t: TacheResumee) => ReactNode;
  sansDomaine?: boolean;
}) {
  if (!items.length) return <p className="text-sm text-muted-foreground">{vide}</p>;
  return (
    <ul className="divide-y rounded-lg border bg-card">
      {items.map((t, i) => (
        <li key={i} className="flex items-baseline gap-3 px-3 py-2">
          <span className="min-w-0 flex-1">
            {t.urgente ? <span className="mr-1.5 text-xs font-semibold text-urgent">Urgent</span> : null}
            {t.titre}
            {t.projet ? <span className="text-muted-foreground"> · {t.projet}</span> : null}
          </span>
          {sansDomaine ? null : <span className="shrink-0 text-sm text-muted-foreground">{t.domaine}</span>}
          {t.qui ? <span className="w-16 shrink-0 truncate text-sm text-muted-foreground">{t.qui}</span> : null}
          <span className="w-44 shrink-0 text-right text-sm tabular text-muted-foreground">{rendu?.(t)}</span>
        </li>
      ))}
    </ul>
  );
}

function Compteur({ n, libelle, ton }: { n: number; libelle: string; ton?: string }) {
  return (
    <div className="min-w-28 flex-1 rounded-lg border bg-card px-3 py-2.5">
      <p className={cn("text-2xl font-semibold tabular", ton)}>{n}</p>
      <p className="text-sm text-muted-foreground">{libelle}</p>
    </div>
  );
}

export function titreRapport(d: { type: string }) {
  return TITRES_RAPPORT[d.type as DonneesRapport["type"]] ?? "Rapport";
}

/** Rendu à l'écran d'un rapport, à partir du JSON déterministe `donnees`. */
export function VueRapport({
  d,
  synthese,
  erreurIa,
}: {
  d: DonneesRapport;
  synthese: string | null;
  erreurIa: string | null;
}) {
  const c = d.compteurs;
  return (
    <div className="max-w-4xl space-y-7">
      <Section titre="Synthèse">
        {synthese ? (
          <p className="whitespace-pre-line leading-6">{synthese}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Synthèse rédigée indisponible{erreurIa ? ` : ${erreurIa}` : " (IA non configurée)"}. Les chiffres ci-dessous
            sont complets.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Compteur n={c.realisees} libelle="réalisées" ton="text-fait" />
          <Compteur n={c.creees} libelle="créées" />
          <Compteur n={c.en_cours} libelle="en cours" />
          <Compteur n={c.en_attente} libelle="en attente" />
          <Compteur n={c.en_retard} libelle="en retard" ton={c.en_retard ? "text-retard" : undefined} />
        </div>
      </Section>

      <Section titre="Réalisé par domaine" compteur={c.realisees}>
        {d.realise_par_domaine.length ? (
          <div className="space-y-4">
            <GraphiqueRealise d={d} />
            {d.realise_par_domaine.map((g) => (
              <div key={g.domaine} className="space-y-1.5">
                <p className="text-sm font-medium">
                  {g.domaine} <span className="font-normal tabular text-muted-foreground">{g.taches.length}</span>
                </p>
                <Liste items={g.taches} vide="" sansDomaine rendu={(t) => (t.done_le ? dateFr(t.done_le) : "")} />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune tâche terminée sur la période. Pense au bouton « Fait » pour le travail réalisé hors to-do.
          </p>
        )}
      </Section>

      <Section titre="En cours et en attente" compteur={c.en_cours + c.en_attente}>
        <div className="space-y-3">
          <Liste
            items={d.en_cours}
            vide="Rien en cours."
            rendu={(t) => (t.echeance ? `échéance ${dateFr(t.echeance)}` : "")}
          />
          <Liste
            items={d.en_attente}
            vide="Rien en attente."
            rendu={(t) => (t.en_attente_de ? `attend : ${t.en_attente_de}` : "en attente")}
          />
        </div>
      </Section>

      <Section titre="En retard" compteur={c.en_retard}>
        <Liste
          items={d.en_retard}
          vide="Aucune tâche en retard."
          rendu={(t) => <span className="text-retard">{`${dateFr(t.echeance)} · ${t.jours_retard} j`}</span>}
        />
      </Section>

      <Section titre="Chine">
        {!d.chine.disponible ? (
          <p className="text-sm text-muted-foreground">{d.chine.message}</p>
        ) : (
          <div className="space-y-3">
            {d.chine.evolutions ? (
              <div className="rounded-lg border bg-card px-3 py-2.5 text-sm">
                <p>
                  Évolutions du fichier : <span className="text-fait">{d.chine.evolutions.ajoutees} ajoutée(s)</span> ·{" "}
                  <span className="text-retard">{d.chine.evolutions.modifiees} modifiée(s)</span> ·{" "}
                  <span className="text-urgent">{d.chine.evolutions.supprimees} supprimée(s)</span>
                </p>
                <ul className="mt-1 space-y-0.5 text-muted-foreground">
                  {d.chine.evolutions.details.map((o) => (
                    <li key={o.onglet}>
                      <span className="font-medium text-foreground">{o.onglet}</span> : {o.exemples.join(" ; ")}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Pas de version antérieure pour mesurer les évolutions.</p>
            )}
            {d.chine.message ? <p className="text-sm text-muted-foreground">{d.chine.message}</p> : null}
            {d.chine.kpi.length ? (
              <p className="text-sm">
                {d.chine.kpi.map((k) => (
                  <span key={k.devise} className="mr-4 inline-block tabular">
                    {k.devise} : reste à payer <strong>{montantFr(k.reste, k.devise)}</strong> sur{" "}
                    {montantFr(k.engage, k.devise)}
                  </span>
                ))}
              </p>
            ) : null}
            {d.chine.echeances.length ? (
              <ul className="divide-y rounded-lg border bg-card text-sm">
                {d.chine.echeances.map((e, i) => (
                  <li key={i} className="flex gap-3 px-3 py-2">
                    <span className={cn("w-28 shrink-0 tabular", e.en_retard && "font-medium text-retard")}>
                      {dateFr(e.date)}
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      {e.fournisseur ?? "?"} {e.po ? <span className="text-muted-foreground">· {e.po}</span> : null}
                    </span>
                    <span className="shrink-0 tabular">{montantFr(e.montant, e.devise)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {d.chine.livraisons_en_retard.length ? (
              <p className="text-sm text-retard">
                Livraisons en retard :{" "}
                {d.chine.livraisons_en_retard.map((l) => `${l.po ?? "?"} (${l.jours} j)`).join(", ")}
              </p>
            ) : null}
          </div>
        )}
      </Section>

      <Section titre="Process créés ou modifiés" compteur={d.process.length}>
        {d.process.length ? (
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {d.process.map((p, i) => (
              <li key={i} className="flex gap-3 px-3 py-2">
                <span className="flex-1">{p.titre}</span>
                <span className="text-muted-foreground">{p.domaine}</span>
                <span className="w-16 text-right text-muted-foreground">{p.action}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun process créé ou modifié.</p>
        )}
      </Section>

      <Section titre="Documents ajoutés" compteur={d.documents.length}>
        {d.documents.length ? (
          <ul className="divide-y rounded-lg border bg-card text-sm">
            {d.documents.map((x, i) => (
              <li key={i} className="flex gap-3 px-3 py-2">
                <span className="min-w-0 flex-1 truncate">{x.nom}</span>
                <span className="text-muted-foreground">{x.categorie ?? ""}</span>
                <span className="w-24 text-right tabular text-muted-foreground">{dateFr(x.ajoute_le)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Aucun document ajouté.</p>
        )}
      </Section>

      <Section titre="À venir">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-sm font-medium">7 prochains jours</p>
            <Liste items={d.a_venir.j7} vide="Rien de prévu." rendu={(t) => dateFr(t.echeance)} />
          </div>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">Jusqu'à 30 jours</p>
            <Liste items={d.a_venir.j30} vide="Rien de prévu." rendu={(t) => dateFr(t.echeance)} />
          </div>
        </div>
      </Section>
    </div>
  );
}
