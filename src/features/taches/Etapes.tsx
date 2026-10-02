import { Plus, X } from "lucide-react";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useEcriture } from "@/hooks/useEcriture";
import type { SousTache } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useEcrireSousTache, useSousTaches } from "./apiDetail";

function Etape({ etape }: { etape: SousTache }) {
  const ecrire = useEcrireSousTache();
  const { peutEcrire } = useEcriture();
  const [titre, setTitre] = useState(etape.titre);
  const temporaire = etape.id.startsWith("tmp-");

  return (
    <li className="group flex items-center gap-2">
      <Checkbox
        checked={etape.fait}
        onCheckedChange={(c) => ecrire.mutate({ type: "maj", id: etape.id, fait: c === true })}
        disabled={!peutEcrire || temporaire}
        aria-label={`Étape faite : ${etape.titre}`}
      />
      <Input
        value={titre}
        onChange={(e) => setTitre(e.target.value)}
        onBlur={() => {
          const t = titre.trim();
          if (!t) setTitre(etape.titre);
          else if (t !== etape.titre) ecrire.mutate({ type: "maj", id: etape.id, titre: t });
        }}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        className={cn(
          "h-7 border-transparent bg-transparent px-1 hover:border-input focus-visible:border-input",
          etape.fait && "text-muted-foreground line-through",
        )}
        aria-label="Intitulé de l'étape"
        disabled={!peutEcrire || temporaire}
      />
      <button
        type="button"
        className="rounded p-1 text-muted-foreground opacity-0 hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        onClick={() => ecrire.mutate({ type: "supprimer", id: etape.id })}
        aria-label={`Supprimer l'étape ${etape.titre}`}
        disabled={!peutEcrire || temporaire}
      >
        <X className="size-3.5" />
      </button>
    </li>
  );
}

/** Checklist d'une tâche (copiée, décochée, dans l'occurrence suivante d'une tâche récurrente). */
export function Etapes({ tacheId }: { tacheId: string }) {
  const etapes = useSousTaches().get(tacheId) ?? [];
  const ecrire = useEcrireSousTache();
  const { peutEcrire } = useEcriture();
  const [nouvelle, setNouvelle] = useState("");
  const faites = etapes.filter((e) => e.fait).length;

  function ajouter() {
    const t = nouvelle.trim();
    if (!t) return;
    ecrire.mutate({
      type: "creer",
      tache_id: tacheId,
      titre: t,
      ordre: (etapes.at(-1)?.ordre ?? -1) + 1,
    });
    setNouvelle("");
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <Label htmlFor={`etape-${tacheId}`}>Étapes</Label>
        {etapes.length ? (
          <span className="tabular text-xs text-muted-foreground">
            {faites}/{etapes.length}
          </span>
        ) : null}
      </div>
      {etapes.length ? (
        <ul className="space-y-0.5">
          {etapes.map((e) => (
            <Etape key={e.id} etape={e} />
          ))}
        </ul>
      ) : null}
      <div className="flex items-center gap-2">
        <Plus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <Input
          id={`etape-${tacheId}`}
          value={nouvelle}
          onChange={(e) => setNouvelle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              ajouter();
            }
          }}
          onBlur={ajouter}
          placeholder="Ajouter une étape"
          className="h-8"
          disabled={!peutEcrire}
        />
      </div>
    </div>
  );
}
