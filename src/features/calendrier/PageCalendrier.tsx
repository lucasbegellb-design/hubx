import {
  evenementsChine,
  evenementsRapports,
  evenementsRappels,
  evenementsTaches,
  grilleMois,
  joursDeLaSemaine,
  parJour,
  type Evenement,
  type TypeEvenement,
} from "@shared/calendrier";
import { ajouterJours, aujourdhuiParis } from "@shared/dates.ts";
import { ajouterMois } from "@shared/recurrence";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Banknote, Bell, ChevronLeft, ChevronRight, FileText, Truck } from "lucide-react";
import { useMemo, useState, type DragEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EnteteePage } from "@/components/common";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/features/auth/AuthProvider";
import { useAnalyseChine } from "@/features/chine/api";
import { useParametres } from "@/features/parametres/api";
import { usePostits } from "@/features/postits/api";
import { useMajTache, useTaches, useTachesFaites } from "@/features/taches/api";
import { useRaccourci } from "@/hooks/useRaccourci";
import { dateCourte } from "@/lib/format";
import { cn } from "@/lib/utils";

type Vue = "mois" | "semaine";
type Filtre = "taches" | "mes" | "rappels" | "chine" | "rapports";

const FILTRES: [Filtre, string][] = [
  ["taches", "Tâches"],
  ["mes", "Seulement les miennes"],
  ["rappels", "Rappels"],
  ["chine", "Suivi Chine"],
  ["rapports", "Rapports"],
];
const ENTETES = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];
const ICONES: Partial<Record<TypeEvenement, typeof Bell>> = {
  rappel: Bell,
  paiement: Banknote,
  livraison: Truck,
  rapport: FileText,
};
const TYPE_GLISSER = "application/x-hubx-tache";

const titreJour = (iso: string) => format(new Date(`${iso}T12:00:00`), "EEEE d MMMM", { locale: fr });

function Pastille({ e, onOuvrir }: { e: Evenement; onOuvrir: () => void }) {
  const Icone = ICONES[e.type];
  return (
    <button
      type="button"
      draggable={Boolean(e.tacheId && !e.fait)}
      onDragStart={(d) => {
        if (!e.tacheId) return;
        d.dataTransfer.setData(TYPE_GLISSER, e.tacheId);
        d.dataTransfer.effectAllowed = "move";
      }}
      onClick={onOuvrir}
      title={e.detail ?? e.titre}
      className={cn(
        "flex w-full min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left text-xs hover:bg-accent",
        e.type === "rapport" && "text-muted-foreground",
        e.fait && "text-muted-foreground line-through",
        e.retard && !e.fait && "text-retard",
        e.tacheId && !e.fait && "cursor-grab",
      )}
    >
      {Icone ? <Icone className="size-3 shrink-0" aria-hidden /> : null}
      {e.heure && e.type === "rappel" ? <span className="shrink-0 tabular">{e.heure}</span> : null}
      {e.urgent && !e.fait ? <span className="shrink-0 font-semibold text-urgent">!</span> : null}
      <span className="truncate">{e.titre}</span>
    </button>
  );
}

export default function PageCalendrier() {
  const aujourdhui = aujourdhuiParis();
  const { userId } = useAuth();
  const naviguer = useNavigate();
  const [params, setParams] = useSearchParams();
  const vue: Vue = params.get("vue") === "semaine" ? "semaine" : "mois";
  const reference = /^\d{4}-\d{2}-\d{2}$/.test(params.get("d") ?? "") ? params.get("d")! : aujourdhui;
  const [filtres, setFiltres] = useState<Filtre[]>(["taches", "rappels", "chine", "rapports"]);
  const [survol, setSurvol] = useState<string | null>(null);

  const taches = useTaches();
  const faites = useTachesFaites(true);
  const postits = usePostits();
  const chine = useAnalyseChine();
  const parametres = useParametres();
  const maj = useMajTache();

  const jours = useMemo(
    () => (vue === "mois" ? grilleMois(reference).flat() : joursDeLaSemaine(reference)),
    [vue, reference],
  );
  const debut = jours[0];
  const fin = jours[jours.length - 1];

  const evenements = useMemo(() => {
    const actif = (f: Filtre) => filtres.includes(f);
    const liste: Evenement[] = [];
    if (actif("taches")) {
      // Une tâche faite récemment figure dans les deux listes : dédoublonnage par identifiant.
      const parId = new Map([...(faites.data ?? []), ...(taches.data ?? [])].map((t) => [t.id, t]));
      const toutes = [...parId.values()].filter(
        (t) => !t.deleted_at && (!actif("mes") || !t.assigne_a || t.assigne_a === userId),
      );
      liste.push(...evenementsTaches(toutes, aujourdhui));
    }
    if (actif("rappels")) {
      const visibles = (postits.data ?? []).filter((p) => !p.archived_at && (p.proprietaire === userId || p.partage));
      liste.push(...evenementsRappels(visibles));
    }
    if (actif("chine") && chine.configure) liste.push(...evenementsChine(chine.lignes, aujourdhui));
    if (actif("rapports") && parametres.data?.rapports_auto !== false) liste.push(...evenementsRapports(debut, fin));
    return parJour(liste.filter((e) => e.jour >= debut && e.jour <= fin));
  }, [filtres, taches.data, faites.data, postits.data, chine, parametres.data, userId, aujourdhui, debut, fin]);

  function aller(d: string, v: Vue = vue) {
    setParams({ vue: v, d }, { replace: true });
  }
  const decaler = (sens: 1 | -1) =>
    aller(vue === "mois" ? ajouterMois(reference.slice(0, 8) + "01", sens) : ajouterJours(reference, 7 * sens));

  useRaccourci("ArrowLeft", () => decaler(-1));
  useRaccourci("ArrowRight", () => decaler(1));
  useRaccourci("t", () => aller(aujourdhui));

  function deposer(jour: string, d: DragEvent) {
    setSurvol(null);
    const id = d.dataTransfer.getData(TYPE_GLISSER);
    const t = taches.data?.find((x) => x.id === id);
    if (!t || t.echeance === jour) return;
    const avant = t.echeance;
    maj.mutate(
      { id, echeance: jour },
      {
        onSuccess: () =>
          toast.success(`Échéance déplacée au ${dateCourte(jour)}`, {
            action: { label: "Annuler", onClick: () => maj.mutate({ id, echeance: avant }) },
          }),
      },
    );
  }

  const libellePeriode =
    vue === "mois"
      ? format(new Date(`${reference}T12:00:00`), "MMMM yyyy", { locale: fr })
      : `Semaine du ${dateCourte(debut)} au ${dateCourte(fin)}`;

  const cellule = (jour: string, limite?: number) => {
    const liste = evenements.get(jour) ?? [];
    const visibles = limite ? liste.slice(0, limite) : liste;
    const horsMois = vue === "mois" && jour.slice(0, 7) !== reference.slice(0, 7);
    return (
      <div
        key={jour}
        onDragOver={(d) => {
          if (d.dataTransfer.types.includes(TYPE_GLISSER)) {
            d.preventDefault();
            setSurvol(jour);
          }
        }}
        onDragLeave={() => setSurvol((s) => (s === jour ? null : s))}
        onDrop={(d) => deposer(jour, d)}
        className={cn(
          "flex min-w-0 flex-col gap-0.5 border-b border-r p-1",
          vue === "mois" ? "min-h-28" : "min-h-[60vh]",
          horsMois && "bg-muted/70",
          survol === jour && "bg-accent",
        )}
        aria-label={titreJour(jour)}
      >
        <button
          type="button"
          onClick={() => aller(jour, "semaine")}
          className={cn(
            "mb-0.5 self-start rounded px-1 text-xs tabular hover:bg-accent",
            jour === aujourdhui ? "bg-primary font-semibold text-primary-foreground hover:bg-primary" : "",
            horsMois && "text-muted-foreground",
          )}
          aria-label={`Voir la semaine du ${titreJour(jour)}`}
        >
          {vue === "semaine" ? titreJour(jour) : Number(jour.slice(8, 10))}
        </button>
        {visibles.map((e) => (
          <Pastille key={e.id} e={e} onOuvrir={() => naviguer(e.lien)} />
        ))}
        {limite && liste.length > limite ? (
          <button
            type="button"
            className="px-1 text-left text-xs text-muted-foreground hover:text-foreground"
            onClick={() => aller(jour, "semaine")}
          >
            + {liste.length - limite} autre{liste.length - limite > 1 ? "s" : ""}
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <EnteteePage
        titre="Calendrier"
        sousTitre={<span className="first-letter:uppercase">{libellePeriode}</span>}
        actions={
          <>
            <Button variant="outline" size="icon" onClick={() => decaler(-1)} aria-label="Période précédente (←)">
              <ChevronLeft />
            </Button>
            <Button variant="outline" onClick={() => aller(aujourdhui)}>
              Aujourd'hui
            </Button>
            <Button variant="outline" size="icon" onClick={() => decaler(1)} aria-label="Période suivante (→)">
              <ChevronRight />
            </Button>
            <ToggleGroup
              type="single"
              value={vue}
              onValueChange={(v) => v && aller(reference, v as Vue)}
              className="rounded-md border p-0.5"
              aria-label="Vue"
            >
              <ToggleGroupItem value="mois" className="h-7 px-2.5 text-sm data-[state=on]:bg-accent">
                Mois
              </ToggleGroupItem>
              <ToggleGroupItem value="semaine" className="h-7 px-2.5 text-sm data-[state=on]:bg-accent">
                Semaine
              </ToggleGroupItem>
            </ToggleGroup>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b px-6 py-2" role="group" aria-label="Afficher">
        {FILTRES.map(([f, l]) => {
          const actif = filtres.includes(f);
          return (
            <button
              key={f}
              type="button"
              aria-pressed={actif}
              disabled={f === "mes" && !filtres.includes("taches")}
              onClick={() => setFiltres((x) => (actif ? x.filter((y) => y !== f) : [...x, f]))}
              className={cn(
                "rounded-full border px-3 py-1 text-sm disabled:opacity-50",
                actif ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {l}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">
          Glisse une tâche sur un autre jour pour changer son échéance.
        </span>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="grid grid-cols-7 border-l">
          {ENTETES.map((j) => (
            <div key={j} className="border-b border-r px-2 py-1 text-xs font-medium text-muted-foreground">
              {j}
            </div>
          ))}
          {jours.map((j) => cellule(j, vue === "mois" ? 4 : undefined))}
        </div>
      </div>
    </div>
  );
}
