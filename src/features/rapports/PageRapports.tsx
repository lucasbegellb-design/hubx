import { FileDown, FileText, Filter, Loader2, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { aujourdhuiParis, LIBELLES_PERIODES, periode as periodeDe, type CodePeriode } from "@shared/dates.ts";
import { dateFr, type DonneesRapport } from "@shared/rapport.ts";
import { EnteteePage, EtatVide, MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { nomFichier } from "@/features/process/exports";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { ilYa } from "@/lib/format";
import { enregistrerFichier } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useGenererRapport, useRapport, useRapports, useSupprimerRapport } from "./api";
import { titreRapport, VueRapport } from "./VueRapport";

const TYPES: Record<string, string> = { demande: "À la demande", hebdo: "Hebdomadaire", mensuel: "Mensuel" };
const RACCOURCIS: CodePeriode[] = ["cette_semaine", "semaine_derniere", "ce_mois", "mois_dernier", "trimestre"];

function Generateur({ onGenere }: { onGenere: (id: string) => void }) {
  const r = useReferentiels();
  const generer = useGenererRapport();
  const { peutEcrire } = useEcriture();
  const aujourdhui = aujourdhuiParis();
  const [code, setCode] = useState<CodePeriode | null>("cette_semaine");
  const [p, setP] = useState(periodeDe("cette_semaine", aujourdhui));
  const [domaines, setDomaines] = useState<string[]>([]);
  const [projets, setProjets] = useState<string[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const refDebut = useRef<HTMLInputElement>(null);
  const [params] = useSearchParams();

  useEffect(() => {
    if (params.get("nouveau")) refDebut.current?.focus();
  }, [params]);

  const bascule = (liste: string[], set: (l: string[]) => void, id: string) =>
    set(liste.includes(id) ? liste.filter((x) => x !== id) : [...liste, id]);
  const nbFiltres = domaines.length + projets.length;

  async function lancer() {
    setErreur(null);
    try {
      const res = await generer.mutateAsync({
        periode_debut: p.debut,
        periode_fin: p.fin,
        filtres: { domaines, projets },
      });
      toast.success("Rapport généré");
      onGenere(res.id);
    } catch (e) {
      if ((e as Error).message !== "hors-ligne") setErreur((e as Error).message);
    }
  }

  return (
    <div className="space-y-3 border-b p-4">
      <p className="text-sm font-semibold text-muted-foreground">Nouveau rapport</p>
      <div className="flex flex-wrap gap-1">
        {RACCOURCIS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => {
              setCode(c);
              setP(periodeDe(c, aujourdhui));
            }}
            className={cn(
              "rounded-md border px-2 py-1 text-sm",
              code === c ? "border-primary bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60",
            )}
          >
            {LIBELLES_PERIODES[c]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="debut" className="text-sm font-normal text-muted-foreground">
            Du
          </Label>
          <Input
            ref={refDebut}
            id="debut"
            type="date"
            value={p.debut}
            max={p.fin}
            onChange={(e) => (setCode(null), setP({ ...p, debut: e.target.value }))}
            className="h-8 tabular"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fin" className="text-sm font-normal text-muted-foreground">
            Au
          </Label>
          <Input
            id="fin"
            type="date"
            value={p.fin}
            min={p.debut}
            onChange={(e) => (setCode(null), setP({ ...p, fin: e.target.value }))}
            className="h-8 tabular"
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 flex-1">
              <Filter aria-hidden />
              {nbFiltres ? `${nbFiltres} filtre${nbFiltres > 1 ? "s" : ""}` : "Tous domaines et projets"}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Domaines</p>
              {r.listeDomaines.map((d) => (
                <label key={d.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={domaines.includes(d.id)}
                    onCheckedChange={() => bascule(domaines, setDomaines, d.id)}
                  />
                  {d.nom}
                </label>
              ))}
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Projets</p>
              {r.listeProjets.map((pr) => (
                <label key={pr.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={projets.includes(pr.id)}
                    onCheckedChange={() => bascule(projets, setProjets, pr.id)}
                  />
                  {pr.nom}
                </label>
              ))}
            </div>
            {nbFiltres ? (
              <Button variant="ghost" size="sm" onClick={() => (setDomaines([]), setProjets([]))}>
                Retirer les filtres
              </Button>
            ) : null}
          </PopoverContent>
        </Popover>
        <Button
          size="sm"
          className="h-8"
          onClick={lancer}
          disabled={generer.isPending || !peutEcrire || !p.debut || !p.fin || p.fin < p.debut}
        >
          {generer.isPending ? <Loader2 className="animate-spin" aria-hidden /> : null}
          {generer.isPending ? "Génération…" : "Générer"}
        </Button>
      </div>
      {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
    </div>
  );
}

export default function PageRapports() {
  const { estAdmin, userId } = useAuth();
  const ref = useReferentiels();
  const liste = useRapports();
  const [params, setParams] = useSearchParams();
  const selection = params.get("r") ?? liste.data?.[0]?.id ?? null;
  const rapport = useRapport(selection);
  const supprimer = useSupprimerRapport();
  const [export_, setExport] = useState(false);

  const choisir = (id: string) => setParams({ r: id }, { replace: true });
  const r = rapport.data;
  const d = r?.d as DonneesRapport | null | undefined;
  const auteur = r?.genere_par ? ref.nomMembre(r.genere_par) : "";

  const groupes = useMemo(() => {
    const l = liste.data ?? [];
    return [
      { titre: "Automatiques", items: l.filter((x) => x.type !== "demande") },
      { titre: "À la demande", items: l.filter((x) => x.type === "demande") },
    ].filter((g) => g.items.length);
  }, [liste.data]);

  async function exporterPdf() {
    if (!d) return;
    setExport(true);
    try {
      const { pdfRapport } = await import("@/features/pdf/rapport");
      const blob = await pdfRapport(d, r?.synthese ?? null, auteur);
      const chemin = await enregistrerFichier(
        `${nomFichier(`rapport-xtim-${d.periode.debut}-${d.periode.fin}`)}.pdf`,
        blob,
        { nom: "PDF", extensions: ["pdf"] },
      );
      if (chemin) toast.success("Exporté en PDF");
    } catch (e) {
      toast.error(`Export impossible : ${(e as Error).message}`);
    } finally {
      setExport(false);
    }
  }

  async function exporterMd() {
    if (!r?.contenu_md || !d) return;
    const chemin = await enregistrerFichier(
      `${nomFichier(`rapport-xtim-${d.periode.debut}-${d.periode.fin}`)}.md`,
      new TextEncoder().encode(r.contenu_md),
      {
        nom: "Markdown",
        extensions: ["md"],
      },
    );
    if (chemin) toast.success("Exporté en Markdown");
  }

  return (
    <div className="flex h-full flex-col">
      <EnteteePage
        titre="Rapports"
        sousTitre="Hebdomadaire le vendredi à 17 h, mensuel le dernier jour ouvré à 17 h, ou à la demande"
      />
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-80 shrink-0 flex-col border-r bg-card">
          <Generateur onGenere={choisir} />
          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {liste.isPending ? (
              <div className="space-y-2 p-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : (
              groupes.map((g) => (
                <div key={g.titre} className="mb-3">
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">{g.titre}</p>
                  <ul className="space-y-0.5">
                    {g.items.map((x) => (
                      <li key={x.id}>
                        <button
                          type="button"
                          onClick={() => choisir(x.id)}
                          className={cn(
                            "w-full rounded-md px-2 py-1.5 text-left",
                            x.id === selection ? "bg-accent" : "hover:bg-accent/60",
                          )}
                        >
                          <p className="text-sm">
                            {dateFr(x.periode_debut)} – {dateFr(x.periode_fin)}
                          </p>
                          <p className={cn("text-xs text-muted-foreground", x.statut === "erreur" && "text-urgent")}>
                            {TYPES[x.type]} ·{" "}
                            {x.statut === "en_cours"
                              ? "génération…"
                              : x.statut === "erreur"
                                ? "échec"
                                : ilYa(x.created_at)}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 overflow-y-auto scrollbar-thin">
          {!selection ? (
            <div className="p-6">
              <EtatVide titre="Aucun rapport pour l'instant.">
                Choisis une période à gauche puis « Générer ». Les rapports hebdomadaires et mensuels apparaîtront ici
                automatiquement.
              </EtatVide>
            </div>
          ) : rapport.isPending ? (
            <div className="space-y-3 p-6">
              <Skeleton className="h-8 w-80" />
              <Skeleton className="h-40 max-w-4xl" />
            </div>
          ) : !r ? (
            <div className="p-6">
              <EtatVide titre="Ce rapport n'existe plus." />
            </div>
          ) : (
            <div className="space-y-6 p-6">
              <div className="flex max-w-4xl flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-semibold">{titreRapport(r)}</h2>
                  <p className="text-sm text-muted-foreground">
                    Du {dateFr(r.periode_debut)} au {dateFr(r.periode_fin)} · généré {ilYa(r.created_at)}{" "}
                    {auteur ? `par ${auteur}` : "automatiquement"}
                    {d && (d.filtres.domaines.length || d.filtres.projets.length)
                      ? ` · filtres : ${[...d.filtres.domaines, ...d.filtres.projets].join(", ")}`
                      : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={exporterPdf} disabled={!d || export_}>
                  {export_ ? <Loader2 className="animate-spin" aria-hidden /> : <FileDown aria-hidden />}
                  Exporter en PDF
                </Button>
                <Button variant="outline" onClick={exporterMd} disabled={!r.contenu_md}>
                  <FileText aria-hidden /> Markdown
                </Button>
                {estAdmin || r.genere_par === userId ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Supprimer le rapport"
                    onClick={() =>
                      supprimer.mutate(r.id, {
                        onSuccess: () => {
                          toast.success("Supprimé");
                          setParams({}, { replace: true });
                        },
                      })
                    }
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              {r.statut === "en_cours" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Génération en cours…
                </p>
              ) : r.statut === "erreur" ? (
                <MessageErreur>
                  {r.erreur ?? "La génération a échoué."} Relance la génération depuis le panneau de gauche.
                </MessageErreur>
              ) : d ? (
                <VueRapport d={d} synthese={r.synthese} erreurIa={r.erreur} />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
