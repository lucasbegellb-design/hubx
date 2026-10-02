import { Suspense, useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { demarrerRealtime } from "@/lib/realtime";
import { BandeauConfiguration } from "./BandeauConfiguration";
import { BandeauHorsLigne } from "./BandeauHorsLigne";
import { BarreLaterale } from "./BarreLaterale";
import { PaletteCommandes } from "@/features/palette/PaletteCommandes";
import { useAnalyseChine } from "@/features/chine/api";
import { useDocuments } from "@/features/documents/api";
import { useProcessListe } from "@/features/process/api";
import { useRapports } from "@/features/rapports/api";
import { prechargerPages } from "./router";
import { ServicesArrierePlan } from "./ServicesArrierePlan";

/** Données des autres modules chargées en tâche de fond : chaque page s'ouvre déjà remplie. */
function Prechargement() {
  useProcessListe();
  useDocuments();
  useRapports();
  useAnalyseChine();
  return null;
}

export function SquelettePage() {
  return (
    <div className="space-y-3 p-6" aria-busy="true" aria-label="Chargement">
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-4 w-80" />
      <div className="space-y-2 pt-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

export function AppShell() {
  const [prechargement, setPrechargement] = useState(false);
  useEffect(() => {
    demarrerRealtime();
    // Après le premier affichage : pages et données des autres modules, sans ralentir le démarrage
    const t = window.setTimeout(() => {
      prechargerPages();
      setPrechargement(true);
    }, 1500);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className="flex h-full">
      <BarreLaterale />
      <div className="flex min-w-0 flex-1 flex-col">
        <BandeauHorsLigne />
        <BandeauConfiguration />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<SquelettePage />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <PaletteCommandes />
      <ServicesArrierePlan />
      {prechargement ? <Prechargement /> : null}
    </div>
  );
}
