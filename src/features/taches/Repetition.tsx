import { jourSemaine } from "@shared/dates.ts";
import { libelleRecurrence, prochaineEcheance, type Frequence, type Recurrence } from "@shared/recurrence";
import { Repeat } from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { dateLongue } from "@/lib/format";
import { cn } from "@/lib/utils";

const AUCUNE = "aucune";
const FREQUENCES: [Frequence | typeof AUCUNE, string][] = [
  [AUCUNE, "Ne se répète pas"],
  ["jour", "Tous les jours"],
  ["semaine", "Toutes les semaines"],
  ["mois", "Tous les mois"],
  ["annee", "Tous les ans"],
];
const UNITES: Record<Frequence, string> = { jour: "jour(s)", semaine: "semaine(s)", mois: "mois", annee: "an(s)" };
const JOURS = ["L", "M", "M", "J", "V", "S", "D"];
const NOMS_JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

/** Choix de la répétition d'une tâche (l'occurrence suivante est créée par le serveur à la clôture). */
export function Repetition({
  recurrence,
  echeance,
  aujourdhui,
  onChange,
  desactive,
}: {
  recurrence: Recurrence | null;
  echeance: string | null;
  aujourdhui: string;
  onChange: (r: Recurrence | null) => void;
  desactive?: boolean;
}) {
  const base = echeance ?? aujourdhui;
  const [intervalle, setIntervalle] = useState(String(recurrence?.intervalle ?? 1));
  useEffect(() => setIntervalle(String(recurrence?.intervalle ?? 1)), [recurrence?.intervalle]);

  function changerFrequence(v: string) {
    if (v === AUCUNE) return onChange(null);
    const f = v as Frequence;
    onChange({
      frequence: f,
      ...(f === "semaine" ? { jours_semaine: [jourSemaine(base)] } : {}),
      ...(f === "mois" ? { jour_mois: Number(base.slice(8, 10)) } : {}),
      ...(recurrence?.jusqu_au ? { jusqu_au: recurrence.jusqu_au } : {}),
    });
  }

  function validerIntervalle() {
    if (!recurrence) return;
    const n = Math.min(Math.max(Math.round(Number(intervalle)) || 1, 1), 12);
    setIntervalle(String(n));
    if (n !== (recurrence.intervalle ?? 1)) onChange({ ...recurrence, intervalle: n });
  }

  function basculerJour(j: number) {
    if (!recurrence) return;
    const jours = recurrence.jours_semaine ?? [];
    const suivants = jours.includes(j) ? jours.filter((x) => x !== j) : [...jours, j].sort();
    if (suivants.length) onChange({ ...recurrence, jours_semaine: suivants });
  }

  const suivante = recurrence && echeance ? prochaineEcheance(echeance, recurrence) : null;

  return (
    <div className="space-y-2">
      <Label htmlFor="repetition">Répétition</Label>
      <Select value={recurrence?.frequence ?? AUCUNE} onValueChange={changerFrequence} disabled={desactive}>
        <SelectTrigger id="repetition">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FREQUENCES.map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {recurrence ? (
        <div className="space-y-2 rounded-md border p-2.5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span>Toutes les</span>
            <Input
              type="number"
              min={1}
              max={12}
              value={intervalle}
              onChange={(e) => setIntervalle(e.target.value)}
              onBlur={validerIntervalle}
              className="h-8 w-16 tabular"
              aria-label="Intervalle"
              disabled={desactive}
            />
            <span>{UNITES[recurrence.frequence]}</span>
          </div>
          {recurrence.frequence === "semaine" ? (
            <div className="flex gap-1" role="group" aria-label="Jours de la semaine">
              {JOURS.map((l, i) => {
                const actif = recurrence.jours_semaine?.includes(i + 1) ?? false;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={actif}
                    aria-label={NOMS_JOURS[i]}
                    disabled={desactive}
                    onClick={() => basculerJour(i + 1)}
                    className={cn(
                      "size-7 rounded-full border text-xs font-medium",
                      actif ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent",
                    )}
                  >
                    {l}
                  </button>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-2 text-sm">
            <Label htmlFor="jusqu-au" className="font-normal">
              Jusqu'au
            </Label>
            <Input
              id="jusqu-au"
              type="date"
              value={recurrence.jusqu_au ?? ""}
              onChange={(e) => onChange({ ...recurrence, jusqu_au: e.target.value || null })}
              className="h-8 w-40 tabular"
              disabled={desactive}
            />
          </div>
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
            <Repeat className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {libelleRecurrence(recurrence)}.{" "}
              {suivante
                ? `Une fois faite, la suivante sera créée pour le ${dateLongue(suivante)}, avec les mêmes étapes.`
                : echeance
                  ? "Dernière occurrence."
                  : "Ajoute une échéance pour planifier les suivantes."}
            </span>
          </p>
        </div>
      ) : null}
    </div>
  );
}
