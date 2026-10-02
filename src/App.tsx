import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { lazy, Suspense, type ReactNode } from "react";
import { RouterProvider } from "react-router-dom";
import { EcranChargement } from "@/components/common";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { PageAccesRefuse, PageConnexion } from "@/features/auth/pages";
import { optionsPersistance } from "@/lib/persistance";
import { queryClient } from "@/lib/queryClient";
import { supabaseOuNull } from "@/lib/supabase";
import { useApplyTheme } from "@/stores/ui";
import { estFenetreCapture } from "./app/fenetre";
import { router } from "./app/router";

const AssistantPremierLancement = lazy(() => import("@/features/installation/AssistantPremierLancement"));

function PorteAuth({ children }: { children: ReactNode }) {
  const { sessionChargee, session, membreCharge, membre } = useAuth();
  if (!sessionChargee) return <EcranChargement />;
  if (!session) return <PageConnexion />;
  if (!membreCharge) return <EcranChargement />;
  if (!membre) return <PageAccesRefuse />;
  return <>{children}</>;
}

export default function App() {
  useApplyTheme();
  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={optionsPersistance}>
      <TooltipProvider delayDuration={400}>
        {supabaseOuNull ? (
          <AuthProvider marquerOuverture={!estFenetreCapture}>
            <PorteAuth>
              <RouterProvider router={router} />
            </PorteAuth>
          </AuthProvider>
        ) : (
          <Suspense fallback={<EcranChargement />}>
            <AssistantPremierLancement />
          </Suspense>
        )}
        <Toaster />
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}
