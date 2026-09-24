import { FileDown, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { normaliser } from "@shared/saisie.ts";
import { EnteteePage, EtatVide, Kbd, Section } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { useRaccourci } from "@/hooks/useRaccourci";
import { ilYa } from "@/lib/format";
import { LIBELLE_STATUT_PROCESS, type StatutProcess } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCreerProcess, useProcessListe, useRechercheProcess } from "./api";
import { exporterPackPassation } from "./exports";

const TOUS = "__tous__";

export function BadgeStatutProcess({ statut }: { statut: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "shrink-0 font-normal",
        statut === "actif" && "border-fait/40 text-fait",
        statut === "brouillon" && "text-muted-foreground",
        statut === "obsolete" && "text-muted-foreground line-through",
      )}
    >
      {LIBELLE_STATUT_PROCESS[statut as StatutProcess] ?? statut}
    </Badge>
  );
}

export default function PageProcess() {
  const { membre } = useAuth();
  const r = useReferentiels();
  const liste = useProcessListe();
  const creer = useCreerProcess();
  const naviguer = useNavigate();
  const [params, setParams] = useSearchParams();
  const { peutEcrire } = useEcriture();
  const [q, setQ] = useState("");
  const [domaine, setDomaine] = useState(TOUS);
  const [statut, setStatut] = useState("courants");
  const [pack, setPack] = useState(false);
  const refRecherche = useRef<HTMLInputElement>(null);
  const plein = useRechercheProcess(q);

  async function nouveau() {
    const id = await creer.mutateAsync({ domaine_id: domaine !== TOUS ? domaine : null });
    naviguer(`/process/${id}`);
  }

  useEffect(() => {
    if (params.get("nouveau") && peutEcrire) {
      setParams({}, { replace: true });
      nouveau();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  useRaccourci("n", () => peutEcrire && nouveau());
  useRaccourci("/", () => refRecherche.current?.focus());

  const groupes = useMemo(() => {
    const terme = normaliser(q);
    const filtres = (liste.data ?? []).filter((p) => {
      if (domaine !== TOUS && p.domaine_id !== domaine) return false;
      if (statut === "courants" && p.statut === "obsolete") return false;
      if (statut !== "courants" && statut !== TOUS && p.statut !== statut) return false;
      if (terme && !normaliser(`${p.titre} ${p.responsable ?? ""}`).includes(terme) && !plein.data?.has(p.id)) return false;
      return true;
    });
    const map = new Map<string, typeof filtres>();
    for (const p of filtres) map.set(p.domaine_id ?? "", [...(map.get(p.domaine_id ?? "") ?? []), p]);
    return [...map.entries()]
      .map(([id, ps]) => ({ domaine: r.domaines.get(id), ps }))
      .sort((a, b) => (a.domaine?.ordre ?? 99) - (b.domaine?.ordre ?? 99));
  }, [liste.data, q, domaine, statut, plein.data, r.domaines]);

  async function lancerPack() {
    setPack(true);
    try {
      await exporterPackPassation(r.domaines, membre?.nom ?? "");
    } catch (e) {
      toast.error(`Export impossible : ${(e as Error).message}`);
    } finally {
      setPack(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <EnteteePage
        titre="Process"
        sousTitre="Bibliothèque des façons de faire — la base de la passation"
        actions={
          <>
            <Button variant="outline" onClick={lancerPack} disabled={pack}>
              <FileDown aria-hidden />
              {pack ? "Génération…" : "Pack de passation"}
            </Button>
            <Button onClick={nouveau} disabled={!peutEcrire || creer.isPending}>
              <Plus aria-hidden />
              Nouveau process
              <Kbd className="ml-1 border-white/30 bg-white/10 text-inherit">N</Kbd>
            </Button>
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-2 border-b bg-card px-6 py-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input
            ref={refRecherche}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans les titres et contenus"
            aria-label="Rechercher un process"
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
        <Select value={statut} onValueChange={setStatut}>
          <SelectTrigger className="h-9 w-auto min-w-40" aria-label="Statut">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="courants">Actifs et brouillons</SelectItem>
            <SelectItem value="actif">Actifs</SelectItem>
            <SelectItem value="brouillon">Brouillons</SelectItem>
            <SelectItem value="obsolete">Obsolètes</SelectItem>
            <SelectItem value={TOUS}>Tous</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {liste.isPending ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9" />
            ))}
          </div>
        ) : groupes.length === 0 ? (
          <EtatVide titre={q || domaine !== TOUS ? "Aucun process ne correspond." : "Aucun process documenté pour l'instant."}>
            {q || domaine !== TOUS
              ? "Essaie d'autres mots : la recherche porte aussi sur le contenu."
              : "Crée le premier avec N : le modèle XTIM (objectif, déclencheur, étapes…) est pré-rempli."}
          </EtatVide>
        ) : (
          <div className="max-w-5xl space-y-6">
            {groupes.map((g) => (
              <Section key={g.domaine?.id ?? "aucun"} titre={g.domaine?.nom ?? "Sans domaine"} compteur={g.ps.length}>
                <ul className="divide-y rounded-lg border bg-card">
                  {g.ps.map((p) => (
                    <li key={p.id}>
                      <Link to={`/process/${p.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50">
                        <span className="min-w-0 flex-1 truncate font-medium">{p.titre}</span>
                        {p.responsable ? <span className="hidden text-sm text-muted-foreground md:inline">{p.responsable}</span> : null}
                        <BadgeStatutProcess statut={p.statut} />
                        <span className="w-40 shrink-0 text-right text-sm text-muted-foreground">
                          modifié {ilYa(p.updated_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

