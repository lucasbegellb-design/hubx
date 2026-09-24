import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { RouterProvider } from "react-router-dom";
import { EcranChargement } from "@/components/common";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/features/auth/AuthProvider";
import { PageAccesRefuse, PageConfigServeur, PageConnexion } from "@/features/auth/pages";
import { queryClient } from "@/lib/queryClient";
import { supabaseOuNull } from "@/lib/supabase";
import { useApplyTheme } from "@/stores/ui";
import { estFenetreCapture } from "./app/fenetre";
import { router } from "./app/router";

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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={400}>
        {supabaseOuNull ? (
          <AuthProvider marquerOuverture={!estFenetreCapture}>
            <PorteAuth>
              <RouterProvider router={router} />
            </PorteAuth>
          </AuthProvider>
        ) : (
          <PageConfigServeur />
        )}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
