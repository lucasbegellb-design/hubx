import { Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ajouterJours, aujourdhuiParis } from "@shared/dates.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { useRaccourci } from "@/hooks/useRaccourci";
import { dateHeure, ilYa } from "@/lib/format";
import { LIBELLE_STATUT, type StatutTache, type Tache } from "@/lib/types";
import { useBrouillon } from "@/stores/ui";
import { useMajTache, useSupprimerTache } from "./api";

const AUCUN = "__aucun__";

/** Champ texte enregistré à la sortie (et après une pause), brouillon conservé hors ligne. */
function useChampAuto(tache: Tache, champ: "titre" | "notes" | "en_attente_de", delai = 900) {
  const maj = useMajTache();
  const valeurServeur = (tache[champ] ?? "") as string;
  const [brouillon, setBrouillon] = useBrouillon(`tache-${tache.id}-${champ}`);
  const [valeur, setValeur] = useState(brouillon || valeurServeur);
  const modifie = useRef(Boolean(brouillon));
  const minuteur = useRef<number>();

  // Synchronise avec les modifications distantes (Edwin) si le champ n'est pas en cours d'édition.
  useEffect(() => {
    if (!modifie.current) setValeur(valeurServeur);
  }, [valeurServeur]);

  function enregistrer(v = valeur) {
    window.clearTimeout(minuteur.current);
    if (!modifie.current) return;
    const propre = champ === "titre" ? v.trim() : v;
    if (champ === "titre" && !propre) {
      setValeur(valeurServeur);
      modifie.current = false;
      setBrouillon("");
      return;
    }
    if (propre === valeurServeur) {
      modifie.current = false;
      setBrouillon("");
      return;
    }
    maj.mutate(
      { id: tache.id, [champ]: champ === "en_attente_de" ? propre || null : propre },
      {
        onSuccess: () => {
          modifie.current = false;
          setBrouillon("");
        },
      },
    );
  }

  return {
    valeur,
    onChange: (v: string) => {
      setValeur(v);
      modifie.current = true;
      setBrouillon(v);
      window.clearTimeout(minuteur.current);
      minuteur.current = window.setTimeout(() => enregistrer(v), delai);
    },
    onBlur: () => enregistrer(),
  };
}

export function PanneauTache({ tache, onFermer }: { tache: Tache; onFermer: () => void }) {
  const r = useReferentiels();
  const maj = useMajTache();
  const supprimer = useSupprimerTache();
  const { peutEcrire } = useEcriture();
  const titre = useChampAuto(tache, "titre", 1200);
  const notes = useChampAuto(tache, "notes");
  const attente = useChampAuto(tache, "en_attente_de");
  const aujourdhui = aujourdhuiParis();

  useRaccourci("Escape", onFermer);

  const set = (champs: Partial<Tache>) => maj.mutate({ id: tache.id, ...champs });

  return (
    <aside
      aria-label="Détail de la tâche"
      className="flex w-[400px] shrink-0 animate-slide-in-right flex-col border-l bg-card"
    >
      <div className="flex h-12 items-center gap-1 border-b px-3">
        <p className="flex-1 text-sm text-muted-foreground">Détail</p>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Supprimer la tâche"
              disabled={!peutEcrire}
              onClick={() => {
                supprimer(tache);
                onFermer();
              }}
            >
              <Trash2 />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Supprimer (Suppr)</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Fermer le détail" onClick={onFermer}>
              <X />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fermer (Échap)</TooltipContent>
        </Tooltip>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        <Textarea
          value={titre.valeur}
          onChange={(e) => titre.onChange(e.target.value)}
          onBlur={titre.onBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              (e.target as HTMLTextAreaElement).blur();
            }
          }}
          rows={2}
          aria-label="Titre"
          disabled={!peutEcrire}
          className="min-h-0 resize-none border-transparent bg-transparent px-1 text-lg font-medium hover:border-input focus-visible:border-input"
        />

        <div className="space-y-1.5">
          <Label>Statut</Label>
          <ToggleGroup
            type="single"
            value={tache.statut}
            onValueChange={(v) => v && set({ statut: v as StatutTache })}
            className="grid grid-cols-4 gap-1 rounded-md border p-0.5"
            disabled={!peutEcrire}
          >
            {(Object.keys(LIBELLE_STATUT) as StatutTache[]).map((s) => (
              <ToggleGroupItem key={s} value={s} className="h-7 px-1 text-sm data-[state=on]:bg-accent">
                {LIBELLE_STATUT[s]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        {tache.statut === "en_attente" ? (
          <div className="space-y-1.5">
            <Label htmlFor="attente">En attente de</Label>
            <Input
              id="attente"
              value={attente.valeur}
              onChange={(e) => attente.onChange(e.target.value)}
              onBlur={attente.onBlur}
              placeholder="Ex. retour usine, devis transitaire…"
              disabled={!peutEcrire}
            />
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <Label htmlFor="urgente">Urgente</Label>
          <Switch
            id="urgente"
            checked={tache.priorite === "urgente"}
            onCheckedChange={(c) => set({ priorite: c ? "urgente" : "normale" })}
            disabled={!peutEcrire}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="echeance">Échéance</Label>
          <div className="flex gap-1.5">
            <Input
              id="echeance"
              type="date"
              value={tache.echeance ?? ""}
              onChange={(e) => set({ echeance: e.target.value || null })}
              className="flex-1 tabular"
              disabled={!peutEcrire}
            />
            <Button variant="outline" size="sm" className="h-9" onClick={() => set({ echeance: aujourdhui })} disabled={!peutEcrire}>
              Aujourd'hui
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => set({ echeance: ajouterJours(aujourdhui, 1) })}
              disabled={!peutEcrire}
            >
              Demain
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Domaine</Label>
            <Select value={tache.domaine_id ?? AUCUN} onValueChange={(v) => set({ domaine_id: v === AUCUN ? null : v })} disabled={!peutEcrire}>
              <SelectTrigger aria-label="Domaine">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Sans domaine</SelectItem>
                {r.listeDomaines.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Projet</Label>
            <Select value={tache.projet_id ?? AUCUN} onValueChange={(v) => set({ projet_id: v === AUCUN ? null : v })} disabled={!peutEcrire}>
              <SelectTrigger aria-label="Projet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Aucun projet</SelectItem>
                {r.listeProjets
                  .filter((p) => p.statut === "actif" || p.id === tache.projet_id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nom}
                      {p.statut === "archive" ? " (archivé)" : ""}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Assignée à</Label>
          <Select value={tache.assigne_a ?? AUCUN} onValueChange={(v) => set({ assigne_a: v === AUCUN ? null : v })} disabled={!peutEcrire}>
            <SelectTrigger aria-label="Assignée à">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUN}>Personne</SelectItem>
              {r.listeMembres.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>
                  {m.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            value={notes.valeur}
            onChange={(e) => notes.onChange(e.target.value)}
            onBlur={notes.onBlur}
            rows={8}
            placeholder="Contexte, liens, contacts…"
            disabled={!peutEcrire}
          />
        </div>
      </div>

      <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Créée par {r.nomMembre(tache.cree_par) || "—"} le {dateHeure(tache.created_at)} · modifiée {ilYa(tache.updated_at)}
        {tache.done_at ? ` · faite le ${dateHeure(tache.done_at)}` : ""}
      </div>
    </aside>
  );
}
