import { Navigate, createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";

// Routes chargées à la demande (démarrage rapide, RAM réduite)
export const router = createHashRouter([
  {
    path: "/capture",
    lazy: async () => ({ Component: (await import("@/features/capture/FenetreCapture")).default }),
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/aujourdhui" replace /> },
      {
        path: "aujourdhui",
        lazy: async () => ({ Component: (await import("@/features/aujourdhui/PageAujourdhui")).default }),
      },
      { path: "taches", lazy: async () => ({ Component: (await import("@/features/taches/PageTaches")).default }) },
      { path: "postits", lazy: async () => ({ Component: (await import("@/features/postits/PagePostits")).default }) },
      { path: "process", lazy: async () => ({ Component: (await import("@/features/process/PageProcess")).default }) },
      {
        path: "process/:id",
        lazy: async () => ({ Component: (await import("@/features/process/PageProcessDetail")).default }),
      },
      { path: "chine", lazy: async () => ({ Component: (await import("@/features/chine/PageChine")).default }) },
      {
        path: "documents",
        lazy: async () => ({ Component: (await import("@/features/documents/PageDocuments")).default }),
      },
      {
        path: "rapports",
        lazy: async () => ({ Component: (await import("@/features/rapports/PageRapports")).default }),
      },
      {
        path: "parametres",
        lazy: async () => ({ Component: (await import("@/features/parametres/PageParametres")).default }),
      },
      { path: "*", element: <Navigate to="/aujourdhui" replace /> },
    ],
  },
]);
