import { AlertCircle, Loader2, Pin, Search, Upload } from "lucide-react";
import { useMemo, useRef, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { normaliser } from "@shared/saisie.ts";
import { EnteteePage, EtatVide, PastilleDomaine } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { useRaccourci } from "@/hooks/useRaccourci";
import { dateCourte, taille } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useDeposerDocuments, useDocuments } from "./api";
import { iconeFichier } from "./icones";
import { PanneauDocument } from "./PanneauDocument";

const TOUS = "__tous__";
const ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.gif,.doc,.docx,.xls,.xlsx,.ods,.odt,.ppt,.pptx,.csv,.txt,.md";

export default function PageDocuments() {
  const r = useReferentiels();
  const docs = useDocuments();
  const deposer = useDeposerDocuments();
  const { peutEcrire } = useEcriture();
  const [params, setParams] = useSearchParams();
  const ouvert = params.get("d");
  const [q, setQ] = useState("");
  const [domaine, setDomaine] = useState(TOUS);
  const [projet, setProjet] = useState(TOUS);
  const [categorie, setCategorie] = useState(TOUS);
  const [survol, setSurvol] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const refRecherche = useRef<HTMLInputElement>(null);
  const compteurDrag = useRef(0);

  useRaccourci("/", () => refRecherche.current?.focus());
  useRaccourci("n", () => input.current?.click());

  const categories = useMemo(
    () =>
      [...new Set((docs.data ?? []).map((d) => d.categorie).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b, "fr"),
      ),
    [docs.data],
  );

  const liste = useMemo(() => {
    const t = normaliser(q);
    return (docs.data ?? [])
      .filter((d) => {
        if (domaine !== TOUS && d.domaine_id !== domaine) return false;
        if (projet !== TOUS && d.projet_id !== projet) return false;
        if (categorie !== TOUS && d.categorie !== categorie) return false;
        if (
          t &&
          !normaliser(`${d.nom} ${d.categorie ?? ""} ${d.resume ?? ""} ${JSON.stringify(d.infos_cles)}`).includes(t)
        )
          return false;
        return true;
      })
      .sort((a, b) => Number(b.epingle) - Number(a.epingle));
  }, [docs.data, q, domaine, projet, categorie]);

  const docOuvert = docs.data?.find((d) => d.id === ouvert);

  function ouvrir(id: string | null) {
    const p = new URLSearchParams(params);
    if (id) p.set("d", id);
    else p.delete("d");
    setParams(p, { replace: true });
  }

  function envoyer(fichiers: FileList | File[] | null) {
    if (!fichiers || !fichiers.length || !peutEcrire) return;
    deposer.mutate({
      fichiers: Array.from(fichiers),
      domaine_id: domaine !== TOUS ? domaine : null,
      projet_id: projet !== TOUS ? projet : null,
    });
  }

  const avecFichiers = (e: DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  return (
    <div
      className="relative flex h-full"
      onDragEnter={(e) => {
        if (!avecFichiers(e)) return;
        compteurDrag.current++;
        setSurvol(true);
      }}
      onDragLeave={() => {
        compteurDrag.current = Math.max(0, compteurDrag.current - 1);
        if (!compteurDrag.current) setSurvol(false);
      }}
      onDragOver={(e) => avecFichiers(e) && e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        compteurDrag.current = 0;
        setSurvol(false);
        envoyer(e.dataTransfer.files);
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col">
        <EnteteePage
          titre="Documents"
          sousTitre="Glisse-dépose des fichiers n'importe où sur cette page"
          actions={
            <>
              <input
                ref={input}
                type="file"
                multiple
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => (envoyer(e.target.files), (e.target.value = ""))}
              />
              <Button onClick={() => input.current?.click()} disabled={!peutEcrire || deposer.isPending}>
                {deposer.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
                {deposer.isPending ? "Envoi…" : "Déposer des fichiers"}
              </Button>
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-2 border-b bg-card px-6 py-3">
          <div className="relative w-72">
            <Search
              className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={refRecherche}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher (nom, résumé, infos clés)"
              aria-label="Rechercher un document"
              className="h-9 pl-8"
            />
          </div>
          <Select value={domaine} onValueChange={setDomaine}>
            <SelectTrigger className="h-9 w-auto min-w-40" aria-label="Domaine">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les domaines</SelectItem>
              {r.listeDomaines.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={projet} onValueChange={setProjet}>
            <SelectTrigger className="h-9 w-auto min-w-36" aria-label="Projet">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Tous les projets</SelectItem>
              {r.listeProjets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={categorie} onValueChange={setCategorie}>
            <SelectTrigger className="h-9 w-auto min-w-40" aria-label="Catégorie">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TOUS}>Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {docs.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-11" />
              ))}
            </div>
          ) : liste.length === 0 ? (
            <EtatVide
              titre={docs.data?.length ? "Aucun document ne correspond." : "Aucun document pour l'instant."}
              action={
                docs.data?.length ? undefined : (
                  <Button variant="outline" onClick={() => input.current?.click()} disabled={!peutEcrire}>
                    <Upload aria-hidden /> Déposer un premier fichier
                  </Button>
                )
              }
            >
              {docs.data?.length
                ? "Modifie la recherche ou les filtres."
                : "Dépose factures, contrats, fiches techniques… L'IA propose une catégorie, un résumé et les tâches à prévoir."}
            </EtatVide>
          ) : (
            <ul className="divide-y rounded-lg border bg-card">
              {liste.map((d) => {
                const Icone = iconeFichier(d.mime, d.nom);
                const dom = d.domaine_id ? r.domaines.get(d.domaine_id) : undefined;
                return (
                  <li key={d.id}>
                    <button
                      type="button"
                      onClick={() => ouvrir(d.id)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/50",
                        d.id === ouvert && "bg-accent",
                      )}
                    >
                      <Icone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          {d.epingle ? (
                            <Pin className="size-3 shrink-0 text-muted-foreground" aria-label="Épinglé" />
                          ) : null}
                          <span className="truncate font-medium">{d.nom}</span>
                        </span>
                        {d.resume ? (
                          <span className="block truncate text-sm text-muted-foreground">{d.resume}</span>
                        ) : null}
                      </span>
                      {d.analyse_statut === "en_attente" ? (
                        <span className="flex shrink-0 items-center gap-1 text-sm text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" aria-hidden /> Analyse…
                        </span>
                      ) : d.analyse_statut === "erreur" ? (
                        <span
                          className="flex shrink-0 items-center gap-1 text-sm text-retard"
                          title={d.analyse_message ?? undefined}
                        >
                          <AlertCircle className="size-3.5" aria-hidden /> Non analysé
                        </span>
                      ) : d.categorie ? (
                        <Badge variant="outline" className="shrink-0 font-normal">
                          {d.categorie}
                        </Badge>
                      ) : null}
                      {dom ? (
                        <PastilleDomaine
                          nom={dom.nom}
                          couleur={dom.couleur}
                          className="hidden w-28 shrink-0 lg:inline-flex"
                        />
                      ) : null}
                      <span className="hidden w-16 shrink-0 text-right text-sm tabular text-muted-foreground md:inline">
                        {taille(d.taille)}
                      </span>
                      <span className="w-16 shrink-0 text-right text-sm tabular text-muted-foreground">
                        {dateCourte(d.created_at)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
      {docOuvert ? <PanneauDocument key={docOuvert.id} doc={docOuvert} onFermer={() => ouvrir(null)} /> : null}
      {survol ? (
        <div className="pointer-events-none absolute inset-3 z-20 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/85">
          <p className="text-lg font-medium text-primary">Dépose tes fichiers ici</p>
        </div>
      ) : null}
    </div>
  );
}
