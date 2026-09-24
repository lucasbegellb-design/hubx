import { Suspense, useEffect } from "react";
import { Outlet } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { demarrerRealtime } from "@/lib/realtime";
import { BandeauHorsLigne } from "./BandeauHorsLigne";
import { BarreLaterale } from "./BarreLaterale";
import { PaletteCommandes } from "@/features/palette/PaletteCommandes";
import { ServicesArrierePlan } from "./ServicesArrierePlan";

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
  useEffect(() => {
    demarrerRealtime();
  }, []);

  return (
    <div className="flex h-full">
      <BarreLaterale />
      <div className="flex min-w-0 flex-1 flex-col">
        <BandeauHorsLigne />
        <main className="min-h-0 flex-1 overflow-hidden">
          <Suspense fallback={<SquelettePage />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <PaletteCommandes />
      <ServicesArrierePlan />
    </div>
  );
}
