import { forwardRef, useImperativeHandle, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { analyserSaisie, type TypeSaisie } from "@shared/saisie.ts";
import { aujourdhuiParis } from "@shared/dates.ts";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/features/auth/AuthProvider";
import { useCreerPostit } from "@/features/postits/api";
import { useReferentiels } from "@/features/referentiels/api";
import { useCreerTache } from "@/features/taches/api";
import { useEcriture } from "@/hooks/useEcriture";
import { dateCourte } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBrouillon } from "@/stores/ui";

const LIBELLES: Record<TypeSaisie, string> = { tache: "Tâche", postit: "Post-it", fait: "Fait" };
const AIDE: Record<TypeSaisie, string> = {
  tache: "Nouvelle tâche…  #domaine  +projet  @demain  !",
  postit: "Nouveau post-it…",
  fait: "Ce que tu viens de terminer…  #domaine",
};
const CLE_DOMAINE = "hubx-dernier-domaine";

function dernierDomaine(): string | null {
  try {
    return localStorage.getItem(CLE_DOMAINE);
  } catch {
    return null;
  }
}

/**
 * Barre de saisie en une ligne : tâche / post-it / « fait ».
 * Préfixes « t: », « p: », « f: » ou sélecteur ; Tab dans le champ vide change de type.
 */
interface ProprietesSaisie {
  cleBrouillon?: string;
  autoFocus?: boolean;
  onTermine?: () => void;
  typeInitial?: TypeSaisie;
  /** Types proposés (un seul : sélecteur masqué). */
  types?: TypeSaisie[];
  placeholder?: string;
  className?: string;
}

const TOUS_TYPES: TypeSaisie[] = ["tache", "postit", "fait"];

export const SaisieRapide = forwardRef<HTMLInputElement, ProprietesSaisie>(function SaisieRapide(
  {
    cleBrouillon = "saisie-rapide",
    autoFocus,
    onTermine,
    typeInitial = "tache",
    types = TOUS_TYPES,
    placeholder,
    className,
  },
  refExterne,
) {
  const { userId } = useAuth();
  const ref = useReferentiels();
  const [texte, setTexte] = useBrouillon(cleBrouillon);
  const [type, setType] = useState<TypeSaisie>(typeInitial);
  const [domaineChoisi, setDomaineChoisi] = useState<string | null>(dernierDomaine);
  const input = useRef<HTMLInputElement>(null);
  useImperativeHandle(refExterne, () => input.current as HTMLInputElement);
  const creerTache = useCreerTache();
  const creerPostit = useCreerPostit();
  const { peutEcrire } = useEcriture();

  const aujourdhui = aujourdhuiParis();
  const analyse = useMemo(
    () => analyserSaisie(texte, { domaines: ref.listeDomaines, projets: ref.projetsActifs, aujourdhui }),
    [texte, ref.listeDomaines, ref.projetsActifs, aujourdhui],
  );
  const typeEffectif = analyse.type && types.includes(analyse.type) ? analyse.type : type;
  const domaineParDefaut =
    (domaineChoisi && ref.domaines.has(domaineChoisi) ? domaineChoisi : null) ?? ref.listeDomaines[0]?.id ?? null;
  const domaineId = analyse.domaineId ?? domaineParDefaut;
  const enCours = creerTache.isPending || creerPostit.isPending;

  async function valider() {
    const titre = analyse.titre.trim();
    if (!titre || enCours) return;
    try {
      if (typeEffectif === "postit") {
        await creerPostit.mutateAsync({ contenu: titre, proprietaire: userId });
        toast.success("Post-it ajouté");
      } else {
        await creerTache.mutateAsync({
          titre,
          domaine_id: domaineId,
          projet_id: analyse.projetId,
          echeance: typeEffectif === "fait" ? null : analyse.echeance,
          priorite: analyse.urgente ? "urgente" : "normale",
          statut: typeEffectif === "fait" ? "fait" : "a_faire",
          assigne_a: userId,
        });
        toast.success(typeEffectif === "fait" ? "Enregistré comme fait" : "Tâche ajoutée");
      }
      setTexte("");
      onTermine?.();
    } catch {
      /* message affiché par le cache de mutations ; brouillon conservé */
    }
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      valider();
    } else if (e.key === "Tab" && !texte && !e.shiftKey && types.length > 1) {
      e.preventDefault();
      setType(types[(types.indexOf(type) + 1) % types.length]);
    }
  }

  const indices: string[] = [];
  if (typeEffectif !== "postit") {
    if (analyse.projetId) indices.push(ref.projets.get(analyse.projetId)?.nom ?? "");
    if (analyse.echeance && typeEffectif === "tache") indices.push(`échéance ${dateCourte(analyse.echeance)}`);
    if (analyse.urgente) indices.push("urgente");
    if (analyse.inconnus.length) indices.push(`non reconnu : ${analyse.inconnus.join(" ")}`);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center gap-2">
        {types.length > 1 ? (
          <ToggleGroup
            type="single"
            value={typeEffectif}
            onValueChange={(v) => v && setType(v as TypeSaisie)}
            className="shrink-0 rounded-md border p-0.5"
            aria-label="Type de saisie"
          >
            {types.map((t) => (
              <ToggleGroupItem key={t} value={t} className="h-7 px-2.5 text-sm data-[state=on]:bg-accent">
                {LIBELLES[t]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <div className="relative flex-1">
          <Input
            ref={input}
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder ?? AIDE[typeEffectif]}
            autoFocus={autoFocus}
            aria-label="Saisie rapide (Entrée pour ajouter)"
            className="h-9 pr-20"
            disabled={!peutEcrire && !texte}
          />
          {analyse.titre.trim() ? (
            <span className="pointer-events-none absolute right-2.5 top-2.5 text-xs text-muted-foreground">
              {enCours ? "Ajout…" : "Entrée ↵"}
            </span>
          ) : null}
        </div>
        {typeEffectif !== "postit" ? (
          <Select
            value={domaineId ?? undefined}
            onValueChange={(v) => {
              setDomaineChoisi(v);
              try {
                localStorage.setItem(CLE_DOMAINE, v);
              } catch {
                /* stockage indisponible */
              }
            }}
          >
            <SelectTrigger className="h-9 w-36 shrink-0" aria-label="Domaine">
              <SelectValue placeholder="Domaine" />
            </SelectTrigger>
            <SelectContent>
              {ref.listeDomaines.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
      {indices.length ? (
        <p className="pl-1 text-xs text-muted-foreground">{indices.filter(Boolean).join(" · ")}</p>
      ) : null}
    </div>
  );
});
