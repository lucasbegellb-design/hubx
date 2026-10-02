import { Settings2, X } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/AuthProvider";
import { DialogueMiseAJourServeur } from "@/features/installation/DialogueMiseAJourServeur";
import { useEtatConfiguration, useVersionServeur } from "@/features/installation/etat";

const CLE_MASQUE = "hubx-bandeau-config-masque";

function masqueRecemment(): boolean {
  try {
    return Date.now() - Number(localStorage.getItem(CLE_MASQUE) ?? 0) < 7 * 86_400_000;
  } catch {
    return false;
  }
}

/** Rappelle ce qui reste à configurer (admin) ou que le serveur doit être mis à jour. */
export function BandeauConfiguration() {
  const { estAdmin } = useAuth();
  const naviguer = useNavigate();
  const version = useVersionServeur();
  const etat = useEtatConfiguration(estAdmin);
  const [masque, setMasque] = useState(masqueRecemment);
  const [maj, setMaj] = useState(false);

  if (version.data?.enRetard) {
    return (
      <div
        role="status"
        className="flex items-center gap-3 border-b border-primary/30 bg-primary/10 px-6 py-1.5 text-sm"
      >
        <Settings2 className="size-4 text-primary" aria-hidden />
        <span className="flex-1">
          {estAdmin
            ? "Cette version de l'application apporte des nouveautés à installer sur le serveur."
            : "Le serveur doit être mis à jour pour cette version : préviens l'administrateur."}
        </span>
        {estAdmin ? (
          <Button size="sm" className="h-7" onClick={() => setMaj(true)}>
            Mettre à jour le serveur
          </Button>
        ) : null}
        <DialogueMiseAJourServeur ouvert={maj} onOuvert={setMaj} />
      </div>
    );
  }

  const e = etat.data;
  if (!estAdmin || !e || masque || (e.ia && e.azure && e.url && e.cron)) return null;
  const manques = [
    !e.ia && "clé IA",
    !e.azure && "fichier Excel d'Edwin (mode démo)",
    !(e.url && e.cron) && "tâches automatiques",
  ].filter(Boolean);
  return (
    <div role="status" className="flex items-center gap-3 border-b bg-accent/60 px-6 py-1.5 text-sm">
      <Settings2 className="size-4 text-primary" aria-hidden />
      <span className="flex-1">Configuration à terminer : {manques.join(" · ")}.</span>
      <Button size="sm" variant="outline" className="h-7" onClick={() => naviguer("/parametres?section=cles")}>
        Terminer
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="size-7"
        aria-label="Masquer pendant 7 jours"
        onClick={() => {
          try {
            localStorage.setItem(CLE_MASQUE, String(Date.now()));
          } catch {
            /* stockage indisponible */
          }
          setMasque(true);
        }}
      >
        <X />
      </Button>
    </div>
  );
}
