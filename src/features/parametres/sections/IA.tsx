import { fournisseur } from "@shared/ia";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/features/auth/AuthProvider";
import { useMajParametres, useParametres } from "../api";

export function SectionIA() {
  const { estAdmin } = useAuth();
  const p = useParametres();
  const maj = useMajParametres();
  const [, setParams] = useSearchParams();
  if (!p.data) return null;
  const id = p.data.id;

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <p className="text-sm font-medium leading-none">Fournisseur d'IA</p>
        <p className="text-sm text-muted-foreground">
          Utilisé pour l'analyse des documents, la structuration des process et la synthèse des rapports.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-sm">
            {fournisseur(p.data.ia_fournisseur).nom} · <span className="font-mono">{p.data.modele_ia}</span>
          </p>
          {estAdmin ? (
            <Button variant="outline" size="sm" onClick={() => setParams({ section: "cles" }, { replace: true })}>
              Changer de fournisseur ou de clé
            </Button>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 border-t pt-5">
        <div>
          <Label htmlFor="auto">Rapports automatiques</Label>
          <p className="text-sm text-muted-foreground">
            Hebdomadaire le vendredi à 17 h, mensuel le dernier jour ouvré à 17 h (heure de Paris).
          </p>
        </div>
        <Switch
          id="auto"
          checked={p.data.rapports_auto}
          disabled={!estAdmin}
          onCheckedChange={(v) =>
            maj.mutate(
              { id, rapports_auto: v },
              {
                onSuccess: () =>
                  toast.success(v ? "Rapports automatiques activés" : "Rapports automatiques désactivés"),
              },
            )
          }
        />
      </div>
      {!estAdmin ? <p className="text-sm text-muted-foreground">Réglages modifiables par l'administrateur.</p> : null}
    </div>
  );
}
