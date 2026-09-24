import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Kbd } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { estTauri } from "@/lib/tauri";
import { RACCOURCI_CAPTURE_DEFAUT, useUi, type Theme } from "@/stores/ui";

const RACCOURCIS: [string, string][] = [
  ["Ctrl K", "Palette de commandes : naviguer, créer, chercher partout"],
  ["Ctrl 1 … 7", "Aller à Aujourd'hui, Tâches, Post-its, Process, Suivi Chine, Documents, Rapports"],
  ["N", "Nouvelle tâche / nouveau post-it / nouveau process / déposer un document (selon la page)"],
  ["X", "Marquer la tâche sélectionnée comme faite"],
  ["E", "Éditer la tâche sélectionnée"],
  ["F", "« Fait » : enregistrer un travail déjà terminé"],
  ["/", "Rechercher dans la page"],
  ["↑ ↓ ou J K", "Parcourir les tâches"],
  ["Suppr", "Supprimer la tâche sélectionnée (annulable)"],
  ["Ctrl S", "Enregistrer le process"],
  ["Échap", "Fermer le panneau ou la fenêtre"],
];

function versAffichage(r: string) {
  return r
    .replace("CommandOrControl", "Ctrl")
    .replace("Shift", "Maj")
    .replace("Space", "Espace")
    .split("+")
    .join(" + ");
}

export function SectionBureau() {
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const raccourci = useUi((s) => s.raccourciCapture);
  const setRaccourci = useUi((s) => s.setRaccourciCapture);
  const [saisie, setSaisie] = useState(raccourci);
  const [autostart, setAutostart] = useState<boolean | null>(null);
  const desktop = estTauri();

  useEffect(() => {
    if (!desktop) return;
    import("@tauri-apps/plugin-autostart")
      .then((a) => a.isEnabled().then(setAutostart))
      .catch(() => setAutostart(false));
  }, [desktop]);

  async function basculerAutostart(v: boolean) {
    const a = await import("@tauri-apps/plugin-autostart");
    try {
      if (v) await a.enable();
      else await a.disable();
      setAutostart(v);
      toast.success(v ? "Démarrage automatique activé" : "Démarrage automatique désactivé");
    } catch {
      toast.error("Réglage impossible : droits insuffisants sur ce poste.");
    }
  }

  function enregistrerRaccourci() {
    const v = saisie.trim();
    if (
      !/^((CommandOrControl|Ctrl|Alt|Shift|Super)\+)+[A-Za-z0-9]+$|^((CommandOrControl|Ctrl|Alt|Shift|Super)\+)+(Space|F\d{1,2})$/.test(
        v,
      )
    ) {
      return toast.error("Format attendu : CommandOrControl+Shift+Space (au moins un modificateur + une touche).");
    }
    setRaccourci(v);
    toast.success("Raccourci enregistré");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Thème</Label>
        <ToggleGroup
          type="single"
          value={theme}
          onValueChange={(v) => v && setTheme(v as Theme)}
          className="w-fit rounded-md border p-0.5"
        >
          {(
            [
              ["clair", "Clair"],
              ["sombre", "Sombre"],
              ["systeme", "Système"],
            ] as const
          ).map(([v, l]) => (
            <ToggleGroupItem key={v} value={v} className="h-7 px-3 text-sm data-[state=on]:bg-accent">
              {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="flex items-center justify-between gap-4 border-t pt-5">
        <div>
          <Label htmlFor="autostart">Démarrer avec Windows</Label>
          <p className="text-sm text-muted-foreground">
            L'application se lance réduite dans la zone de notification, prête pour les rappels.
          </p>
        </div>
        <Switch
          id="autostart"
          checked={Boolean(autostart)}
          onCheckedChange={basculerAutostart}
          disabled={!desktop || autostart === null}
        />
      </div>

      <div className="space-y-1.5 border-t pt-5">
        <Label htmlFor="raccourci">Raccourci global de capture rapide</Label>
        <p className="text-sm text-muted-foreground">
          Actuel : <Kbd>{versAffichage(raccourci)}</Kbd> — ouvre une petite fenêtre tâche / post-it / fait, même quand
          l'app est en arrière-plan.
        </p>
        <div className="flex gap-2">
          <Input
            id="raccourci"
            value={saisie}
            onChange={(e) => setSaisie(e.target.value)}
            className="max-w-xs font-mono text-sm"
          />
          <Button variant="outline" onClick={enregistrerRaccourci} disabled={saisie === raccourci || !desktop}>
            Enregistrer
          </Button>
          <Button
            variant="ghost"
            onClick={() => (setSaisie(RACCOURCI_CAPTURE_DEFAUT), setRaccourci(RACCOURCI_CAPTURE_DEFAUT))}
            disabled={raccourci === RACCOURCI_CAPTURE_DEFAUT}
          >
            Par défaut
          </Button>
        </div>
        {!desktop ? <p className="text-sm text-muted-foreground">Disponible dans l'application de bureau.</p> : null}
      </div>

      <div className="space-y-2 border-t pt-5">
        <Label>Raccourcis clavier</Label>
        <table className="w-full text-sm">
          <tbody>
            {RACCOURCIS.map(([k, d]) => (
              <tr key={k} className="border-b last:border-b-0">
                <td className="w-32 py-1.5">
                  <Kbd>{k}</Kbd>
                </td>
                <td className="py-1.5 text-muted-foreground">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
