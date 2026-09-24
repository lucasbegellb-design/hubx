import { CheckCheck, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { aujourdhuiParis } from "@shared/dates.ts";
import { grouperParEcheance } from "@shared/echeances.ts";
import { normaliser } from "@shared/saisie.ts";
import { EnteteePage, EtatVide, Kbd, Section } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { SaisieRapide } from "@/features/capture/SaisieRapide";
import { useReferentiels } from "@/features/referentiels/api";
import { useRaccourci } from "@/hooks/useRaccourci";
import { LIBELLE_STATUT, type StatutTache, type Tache } from "@/lib/types";
import { useBasculerFait, useSupprimerTache, useTaches, useTachesFaites } from "./api";
import { LigneTache } from "./LigneTache";
import { PanneauTache } from "./PanneauTache";

const TOUS = "__tous__";
const SANS = "__sans__";

interface Filtres {
  domaine: string;
  projet: string;
  statut: string;
  assigne: string;
}
const FILTRES_DEFAUT: Filtres = { domaine: TOUS, projet: TOUS, statut: TOUS, assigne: TOUS };

export default function PageTaches() {
  const { userId } = useAuth();
  const r = useReferentiels();
  const [params, setParams] = useSearchParams();
  const ouverte = params.get("t");
  const [filtres, setFiltres] = useState<Filtres>(FILTRES_DEFAUT);
  const [recherche, setRecherche] = useState("");
  const [selection, setSelection] = useState<string | null>(ouverte);
  const [faitOuvert, setFaitOuvert] = useState(false);
  const refRecherche = useRef<HTMLInputElement>(null);
  const refCreation = useRef<HTMLInputElement>(null);
  const refsLignes = useRef(new Map<string, HTMLButtonElement>());

  const liste = useTaches();
  const faites = useTachesFaites(filtres.statut === "fait");
  const basculer = useBasculerFait();
  const supprimer = useSupprimerTache();
  const aujourdhui = aujourdhuiParis();

  const visibles = useMemo(() => {
    const source = filtres.statut === "fait" ? (faites.data ?? []) : (liste.data ?? []);
    const q = normaliser(recherche);
    return source.filter((t) => {
      if (t.deleted_at) return false;
      if (filtres.domaine !== TOUS && (t.domaine_id ?? SANS) !== filtres.domaine) return false;
      if (filtres.projet === TOUS) {
        // Les projets archivés sortent des vues par défaut
        if (t.projet_id && r.projets.get(t.projet_id)?.statut === "archive") return false;
      } else if ((t.projet_id ?? SANS) !== filtres.projet) return false;
      if (filtres.statut !== TOUS && t.statut !== filtres.statut) return false;
      if (filtres.assigne !== TOUS && (t.assigne_a ?? SANS) !== filtres.assigne) return false;
      if (q && !normaliser(`${t.titre} ${t.notes} ${t.en_attente_de ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [liste.data, faites.data, filtres, recherche, r.projets]);

  const groupes = useMemo(() => {
    if (filtres.statut === "fait") return [{ cle: "faites", libelle: "Faites", taches: visibles }];
    return grouperParEcheance(visibles, aujourdhui).filter((g) => g.taches.length > 0);
  }, [visibles, aujourdhui, filtres.statut]);

  const ordre = useMemo(() => groupes.flatMap((g) => g.taches), [groupes]);
  const tacheOuverte = ouverte ? (liste.data?.find((t) => t.id === ouverte) ?? faites.data?.find((t) => t.id === ouverte)) : undefined;
  const tacheSelection = ordre.find((t) => t.id === selection);

  function ouvrir(id: string | null) {
    const p = new URLSearchParams(params);
    if (id) p.set("t", id);
    else p.delete("t");
    setParams(p, { replace: true });
    if (id) setSelection(id);
  }

  useEffect(() => {
    if (ouverte) setSelection(ouverte);
  }, [ouverte]);

  function deplacer(delta: number) {
    if (!ordre.length) return;
    const i = ordre.findIndex((t) => t.id === selection);
    const suivant = ordre[Math.min(ordre.length - 1, Math.max(0, i === -1 ? 0 : i + delta))];
    setSelection(suivant.id);
    refsLignes.current.get(suivant.id)?.focus();
    if (ouverte) ouvrir(suivant.id);
  }

  useRaccourci("n", () => refCreation.current?.focus());
  useRaccourci("/", () => refRecherche.current?.focus());
  useRaccourci("f", () => setFaitOuvert(true));
  useRaccourci("x", () => tacheSelection && basculer(tacheSelection));
  useRaccourci("e", () => selection && ouvrir(selection));
  useRaccourci("arrowdown", () => deplacer(1));
  useRaccourci("j", () => deplacer(1));
  useRaccourci("arrowup", () => deplacer(-1));
  useRaccourci("k", () => deplacer(-1));
  useRaccourci("delete", () => tacheSelection && supprimer(tacheSelection));
  useRaccourci("Escape", () => (recherche ? setRecherche("") : setSelection(null)), { actif: !ouverte });

  const filtresActifs = JSON.stringify(filtres) !== JSON.stringify(FILTRES_DEFAUT) || recherche !== "";
  const set = (k: keyof Filtres) => (v: string) => setFiltres((f) => ({ ...f, [k]: v }));

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <EnteteePage
          titre="Tâches"
          actions={
            <Popover open={faitOuvert} onOpenChange={setFaitOuvert}>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CheckCheck aria-hidden />
                  Fait
                  <Kbd className="ml-1">F</Kbd>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[560px] p-3">
                <p className="mb-2 text-sm text-muted-foreground">
                  Enregistre en 10 secondes un travail déjà terminé : il apparaîtra dans les rapports.
                </p>
                <SaisieRapide
                  types={["fait"]}
                  typeInitial="fait"
                  cleBrouillon="saisie-fait"
                  autoFocus
                  onTermine={() => setFaitOuvert(false)}
                />
              </PopoverContent>
            </Popover>
          }
        />

        <div className="space-y-3 border-b bg-card px-6 pb-3 pt-3">
          <SaisieRapide ref={refCreation} types={["tache"]} cleBrouillon="saisie-taches" />
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
              <Input
                ref={refRecherche}
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Rechercher"
                aria-label="Rechercher une tâche"
                className="h-9 pl-8 pr-8"
                onKeyDown={(e) => e.key === "Escape" && (setRecherche(""), e.currentTarget.blur())}
              />
              <Kbd className="absolute right-2 top-2">/</Kbd>
            </div>
            <Filtre valeur={filtres.domaine} onChange={set("domaine")} libelle="Domaine" tous="Tous les domaines">
              <SelectItem value={SANS}>Sans domaine</SelectItem>
              {r.listeDomaines.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </Filtre>
            <Filtre valeur={filtres.projet} onChange={set("projet")} libelle="Projet" tous="Tous les projets">
              <SelectItem value={SANS}>Sans projet</SelectItem>
              {r.listeProjets.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nom}
                  {p.statut === "archive" ? " (archivé)" : ""}
                </SelectItem>
              ))}
            </Filtre>
            <Filtre valeur={filtres.statut} onChange={set("statut")} libelle="Statut" tous="Tous les statuts">
              {(Object.keys(LIBELLE_STATUT) as StatutTache[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {s === "fait" ? "Fait (historique)" : LIBELLE_STATUT[s]}
                </SelectItem>
              ))}
            </Filtre>
            <Filtre valeur={filtres.assigne} onChange={set("assigne")} libelle="Assignée à" tous="Tout le monde">
              <SelectItem value={userId}>Moi</SelectItem>
              {r.listeMembres
                .filter((m) => m.user_id !== userId)
                .map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.nom}
                  </SelectItem>
                ))}
              <SelectItem value={SANS}>Personne</SelectItem>
            </Filtre>
            {filtresActifs ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFiltres(FILTRES_DEFAUT);
                  setRecherche("");
                }}
              >
                Réinitialiser
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 scrollbar-thin">
          {liste.isPending ? (
            <div className="space-y-2 px-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : groupes.length === 0 ? (
            <EtatVide
              className="mx-2"
              titre={filtresActifs ? "Aucune tâche ne correspond à ces filtres." : "Aucune tâche pour l'instant."}
            >
              {filtresActifs ? "Élargis la recherche ou réinitialise les filtres." : "Ajoute la prochaine avec N."}
            </EtatVide>
          ) : (
            <div className="space-y-5">
              {groupes.map((g) => (
                <Section key={g.cle} titre={g.libelle} compteur={g.taches.length} className="px-2">
                  <ul className="-mx-2">
                    {g.taches.map((t: Tache) => (
                      <LigneTache
                        key={t.id}
                        ref={(el) => {
                          if (el) refsLignes.current.set(t.id, el);
                          else refsLignes.current.delete(t.id);
                        }}
                        tache={t}
                        aujourdhui={aujourdhui}
                        selectionnee={t.id === selection}
                        onSelection={() => setSelection(t.id)}
                        onOuvrir={() => ouvrir(t.id)}
                        onBasculer={() => basculer(t)}
                      />
                    ))}
                  </ul>
                </Section>
              ))}
              <p className="px-2 pt-2 text-xs text-muted-foreground">
                <Kbd>N</Kbd> nouvelle · <Kbd>X</Kbd> faite · <Kbd>E</Kbd> éditer · <Kbd>/</Kbd> rechercher ·{" "}
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> naviguer · <Kbd>F</Kbd> fait
              </p>
            </div>
          )}
        </div>
      </div>
      {tacheOuverte ? <PanneauTache key={tacheOuverte.id} tache={tacheOuverte} onFermer={() => ouvrir(null)} /> : null}
    </div>
  );
}

function Filtre({
  valeur,
  onChange,
  libelle,
  tous,
  children,
}: {
  valeur: string;
  onChange: (v: string) => void;
  libelle: string;
  tous: string;
  children: React.ReactNode;
}) {
  return (
    <Select value={valeur} onValueChange={onChange}>
      <SelectTrigger className="h-9 w-auto min-w-36 gap-2" aria-label={libelle}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={TOUS}>{tous}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  );
}
