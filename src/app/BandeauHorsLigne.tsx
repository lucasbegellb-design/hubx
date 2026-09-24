import { WifiOff } from "lucide-react";
import { useOnline } from "@/lib/online";

export function BandeauHorsLigne() {
  const online = useOnline();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2 border-b border-retard/30 bg-retard/10 px-6 py-1.5 text-sm">
      <WifiOff className="size-4 text-retard" aria-hidden />
      <span>
        <strong className="font-medium">Hors connexion.</strong> Consultation seule : les modifications sont
        désactivées. Tes saisies en cours sont conservées.
      </span>
    </div>
  );
}
