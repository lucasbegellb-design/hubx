import { Bell, FileText } from "lucide-react";
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { aujourdhuiParis, dateParis } from "@shared/dates.ts";
import { groupeDe } from "@shared/echeances.ts";
import { EnteteePage, EtatVide, Kbd, Section } from "@/components/common";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { SaisieRapide } from "@/features/capture/SaisieRapide";
import { AlertesChineResume } from "@/features/chine/AlertesChineResume";
import { usePostits } from "@/features/postits/api";
import { useReferentiels } from "@/features/referentiels/api";
import { useBasculerFait, useTaches } from "@/features/taches/api";
import { LigneTache } from "@/features/taches/LigneTache";
import { dateCourte, dateLongue, heure, ilYa } from "@/lib/format";
import type { Journal } from "@/lib/types";
import { LIBELLE_STATUT, type StatutTache } from "@/lib/types";
import { useChangementsDepuis, useDernierRapport, useSnapshotsDepuis } from "./api";

const TYPES_RAPPORT: Record<string, string> = { demande: "Rapport", hebdo: "Rapport hebdomadaire", mensuel: "Rapport mensuel" };

function phraseJournal(j: Journal, nom: string): { texte: string; lien: string } {
  const a = (j.apres ?? j.avant ?? {}) as Record<string, string>;
  const titre = a.titre ?? a.nom ?? (a.contenu ? a.contenu.slice(0, 60) : "");
  const qui = nom || "Quelqu'un";
  switch (j.entite) {
    case "taches": {
      const lien = `/taches?t=${j.entite_id}`;
      if (j.action === "cree") return { texte: `${qui} a créé « ${titre} »`, lien };
      if (j.action === "supprime") return { texte: `${qui} a supprimé « ${titre} »`, lien: "/taches" };
      if (j.action === "statut")
        return a.statut === "fait"
          ? { texte: `${qui} a terminé « ${titre} »`, lien }
          : { texte: `${qui} a passé « ${titre} » en ${LIBELLE_STATUT[a.statut as StatutTache]?.toLowerCase() ?? a.statut}`, lien };
      return { texte: `${qui} a modifié « ${titre} »`, lien };
    }
    case "process":
      return {
        texte: `${qui} a ${j.action === "cree" ? "créé" : j.action === "supprime" ? "supprimé" : "modifié"} le process « ${titre} »`,
        lien: `/process/${j.entite_id}`,
      };
    case "documents":
      return {
        texte: `${qui} a ${j.action === "cree" ? "ajouté" : j.action === "supprime" ? "supprimé" : "modifié"} le document « ${titre} »`,
        lien: `/documents?d=${j.entite_id}`,
      };
    default:
      return { texte: `${qui} a ${j.action === "cree" ? "partagé" : "modifié"} un post-it : « ${titre} »`, lien: `/postits?p=${j.entite_id}` };
  }
}

export default function PageAujourdhui() {
  const { userId, ouverturePrecedente } = useAuth();
  const r = useReferentiels();
  const taches = useTaches();
  const postits = usePostits();
  const basculer = useBasculerFait();
  const naviguer = useNavigate();
  const changements = useChangementsDepuis(ouverturePrecedente, userId);
  const snapshots = useSnapshotsDepuis(ouverturePrecedente);
  const rapport = useDernierRapport();
  const aujourdhui = aujourdhuiParis();

  const { retard, dujour, urgentes } = useMemo(() => {
    const actives = (taches.data ?? []).filter(
      (t) => !t.deleted_at && t.statut !== "fait" && !(t.projet_id && r.projets.get(t.projet_id)?.statut === "archive"),
    );
    const g = (cle: string) => actives.filter((t) => groupeDe(t, aujourdhui) === cle);
    return {
      retard: g("en_retard").sort((a, b) => (a.echeance! < b.echeance! ? -1 : 1)),
      dujour: g("aujourdhui"),
      urgentes: actives.filter((t) => t.priorite === "urgente" && !["en_retard", "aujourdhui"].includes(groupeDe(t, aujourdhui) ?? "")),
    };
  }, [taches.data, aujourdhui, r.projets]);

  const rappels = useMemo(
    () =>
      (postits.data ?? [])
        .filter((p) => p.proprietaire === userId && !p.archived_at && p.rappel_at && dateParis(p.rappel_at) === aujourdhui)
        .sort((a, b) => (a.rappel_at! < b.rappel_at! ? -1 : 1)),
    [postits.data, userId, aujourdhui],
  );

  const blocTaches = (titre: string, liste: typeof retard, vide?: string) =>
    liste.length || vide ? (
      <Section titre={titre} compteur={liste.length}>
        {liste.length ? (
          <ul className="-mx-2">
            {liste.map((t) => (
              <LigneTache
                key={t.id}
                tache={t}
                aujourdhui={aujourdhui}
                compacte
                onOuvrir={() => naviguer(`/taches?t=${t.id}`)}
                onBasculer={() => basculer(t)}
              />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{vide}</p>
        )}
      </Section>
    ) : null;

  return (
    <div className="flex h-full flex-col">
      <EnteteePage titre="Aujourd'hui" sousTitre={<span className="first-letter:uppercase">{dateLongue(new Date())}</span>} />
      <div className="border-b bg-card px-6 pb-3 pt-1">
        <SaisieRapide cleBrouillon="saisie-aujourdhui" />
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid gap-8 p-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="space-y-6">
            {taches.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8" />
                ))}
              </div>
            ) : retard.length + dujour.length + urgentes.length === 0 ? (
              <EtatVide titre="Rien d'urgent ni en retard.">
                Ajoute la prochaine tâche avec la barre ci-dessus, ou <Kbd>N</Kbd> depuis la page Tâches.
              </EtatVide>
            ) : (
              <>
                {blocTaches("En retard", retard)}
                {blocTaches("Aujourd'hui", dujour, "Aucune échéance aujourd'hui.")}
                {blocTaches("Urgentes", urgentes)}
              </>
            )}
          </div>

          <div className="space-y-6">
            {rappels.length ? (
              <Section titre="Rappels du jour" compteur={rappels.length}>
                <ul className="space-y-1">
                  {rappels.map((p) => (
                    <li key={p.id}>
                      <Link to={`/postits?p=${p.id}`} className="flex items-baseline gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                        <Bell className="size-3.5 shrink-0 translate-y-0.5 text-muted-foreground" aria-hidden />
                        <span className="w-11 shrink-0 text-sm tabular text-muted-foreground">{heure(p.rappel_at)}</span>
                        <span className="line-clamp-2">{p.contenu}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}

            <AlertesChineResume />

            <Section titre={ouverturePrecedente ? `Depuis ta dernière visite (${ilYa(ouverturePrecedente)})` : "Depuis ta dernière visite"}>
              {!ouverturePrecedente ? (
                <p className="text-sm text-muted-foreground">Première ouverture : l'activité d'Edwin et du suivi Chine apparaîtra ici.</p>
              ) : (changements.data?.length ?? 0) === 0 && !snapshots.data ? (
                <p className="text-sm text-muted-foreground">Rien de nouveau.</p>
              ) : (
                <ul className="space-y-0.5">
                  {snapshots.data ? (
                    <li>
                      <Link to="/chine" className="block rounded-md px-2 py-1.5 hover:bg-accent/50">
                        Suivi Chine : {snapshots.data > 1 ? `${snapshots.data} nouvelles versions` : "nouvelle version"} du fichier
                      </Link>
                    </li>
                  ) : null}
                  {changements.data?.slice(0, 15).map((j) => {
                    const { texte, lien } = phraseJournal(j, r.nomMembre(j.user_id));
                    return (
                      <li key={j.id}>
                        <Link to={lien} className="flex gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50">
                          <span className="min-w-0 flex-1 truncate">{texte}</span>
                          <span className="shrink-0 text-sm tabular text-muted-foreground">{dateCourte(j.at)}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            {rapport.data ? (
              <Section titre="Dernier rapport">
                <Link
                  to={`/rapports?r=${rapport.data.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
                >
                  <FileText className="size-4 text-muted-foreground" aria-hidden />
                  <span className="flex-1">
                    {TYPES_RAPPORT[rapport.data.type]} · {dateCourte(rapport.data.periode_debut)} – {dateCourte(rapport.data.periode_fin)}
                  </span>
                  <span className="text-sm text-muted-foreground">{ilYa(rapport.data.created_at)}</span>
                </Link>
              </Section>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
