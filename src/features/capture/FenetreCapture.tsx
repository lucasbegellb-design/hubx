import { Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRaccourci } from "@/hooks/useRaccourci";
import { fermerFenetreCourante, montrerFenetrePrincipale } from "@/lib/tauri";
import { SaisieRapide } from "./SaisieRapide";

/** Petite fenêtre ouverte par le raccourci global : tâche / post-it / fait, puis fermeture. */
export default function FenetreCapture() {
  useRaccourci("Escape", () => fermerFenetreCourante());
  return (
    <div className="flex h-full flex-col gap-2 border bg-card p-3" data-tauri-drag-region>
      <div className="flex items-center gap-2" data-tauri-drag-region>
        <p className="flex-1 text-sm font-medium" data-tauri-drag-region>
          Capture rapide
        </p>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Ouvrir Hub XTIM" onClick={() => montrerFenetrePrincipale()}>
          <Maximize2 />
        </Button>
        <Button variant="ghost" size="icon" className="size-7" aria-label="Fermer (Échap)" onClick={() => fermerFenetreCourante()}>
          <X />
        </Button>
      </div>
      <SaisieRapide autoFocus cleBrouillon="saisie-capture" onTermine={() => setTimeout(fermerFenetreCourante, 600)} />
      <p className="text-xs text-muted-foreground">Entrée pour ajouter · Tab pour changer de type · Échap pour fermer</p>
    </div>
  );
}
