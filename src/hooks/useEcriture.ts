import { toast } from "sonner";
import { useOnline, useOnlineStore } from "@/lib/online";

const MESSAGE = "Hors connexion : modification impossible pour l'instant. Ta saisie est conservée.";

/** Garde d'écriture : désactive proprement les actions hors connexion. */
export function useEcriture() {
  const online = useOnline();
  return {
    peutEcrire: online,
    /** Renvoie false (et prévient) si l'écriture est impossible. */
    verifier(): boolean {
      if (useOnlineStore.getState().online) return true;
      toast.warning(MESSAGE);
      return false;
    },
  };
}

export function verifierEcriture(): boolean {
  if (useOnlineStore.getState().online) return true;
  toast.warning(MESSAGE);
  return false;
}
