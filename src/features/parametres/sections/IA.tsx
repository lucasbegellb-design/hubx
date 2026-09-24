import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/features/auth/AuthProvider";
import { useMajParametres, useParametres } from "../api";

const SUGGESTIONS = [
  ["claude-sonnet-5", "Sonnet 5 — équilibré (défaut)"],
  ["claude-opus-5", "Opus 5 — plus précis, plus coûteux"],
  ["claude-haiku-4-5", "Haiku 4.5 — rapide et économique"],
];

export function SectionIA() {
  const { estAdmin } = useAuth();
  const p = useParametres();
  const maj = useMajParametres();
  const [modele, setModele] = useState("");
  useEffect(() => setModele(p.data?.modele_ia ?? ""), [p.data?.modele_ia]);
  if (!p.data) return null;
  const id = p.data.id;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="modele">Modèle IA</Label>
        <p className="text-sm text-muted-foreground">
          Utilisé pour l'analyse des documents, la structuration des process et la synthèse des rapports. La clé API reste sur le serveur
          (secret ANTHROPIC_API_KEY).
        </p>
        <div className="flex gap-2">
          <Input id="modele" value={modele} onChange={(e) => setModele(e.target.value)} className="max-w-xs font-mono text-sm" disabled={!estAdmin} list="modeles" />
          <datalist id="modeles">
            {SUGGESTIONS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </datalist>
          <Button
            variant="outline"
            disabled={!estAdmin || modele.trim().length < 3 || modele.trim() === p.data.modele_ia}
            onClick={() => maj.mutate({ id, modele_ia: modele.trim() }, { onSuccess: () => toast.success("Modèle enregistré") })}
          >
            Enregistrer
          </Button>
        </div>
        <ul className="text-sm text-muted-foreground">
          {SUGGESTIONS.map(([v, l]) => (
            <li key={v}>
              <button type="button" className="font-mono hover:text-foreground disabled:cursor-default" disabled={!estAdmin} onClick={() => setModele(v)}>
                {v}
              </button>{" "}
              — {l.split("— ")[1]}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-5">
        <div>
          <Label htmlFor="auto">Rapports automatiques</Label>
          <p className="text-sm text-muted-foreground">Hebdomadaire le vendredi à 17 h, mensuel le dernier jour ouvré à 17 h (heure de Paris).</p>
        </div>
        <Switch
          id="auto"
          checked={p.data.rapports_auto}
          disabled={!estAdmin}
          onCheckedChange={(v) => maj.mutate({ id, rapports_auto: v }, { onSuccess: () => toast.success(v ? "Rapports automatiques activés" : "Rapports automatiques désactivés") })}
        />
      </div>
      {!estAdmin ? <p className="text-sm text-muted-foreground">Réglages modifiables par l'administrateur.</p> : null}
    </div>
  );
}
