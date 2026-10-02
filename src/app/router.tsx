import { Navigate, createHashRouter } from "react-router-dom";
import { AppShell } from "./AppShell";

// Pages chargées à la demande (démarrage rapide), puis préchargées en tâche de fond
// pour que la navigation soit instantanée.
const PAGES = {
  capture: () => import("@/features/capture/FenetreCapture"),
  aujourdhui: () => import("@/features/aujourdhui/PageAujourdhui"),
  taches: () => import("@/features/taches/PageTaches"),
  postits: () => import("@/features/postits/PagePostits"),
  process: () => import("@/features/process/PageProcess"),
  processDetail: () => import("@/features/process/PageProcessDetail"),
  chine: () => import("@/features/chine/PageChine"),
  documents: () => import("@/features/documents/PageDocuments"),
  rapports: () => import("@/features/rapports/PageRapports"),
  parametres: () => import("@/features/parametres/PageParametres"),
};

const page = (cle: keyof typeof PAGES) => async () => ({ Component: (await PAGES[cle]()).default });

export function prechargerPages() {
  for (const [cle, charger] of Object.entries(PAGES)) if (cle !== "capture") void charger();
}

export const router = createHashRouter([
  {
    path: "/capture",
    lazy: page("capture"),
  },
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <Navigate to="/aujourdhui" replace /> },
      {
        path: "aujourdhui",
        lazy: page("aujourdhui"),
      },
      { path: "taches", lazy: page("taches") },
      { path: "postits", lazy: page("postits") },
      { path: "process", lazy: page("process") },
      {
        path: "process/:id",
        lazy: page("processDetail"),
      },
      { path: "chine", lazy: page("chine") },
      {
        path: "documents",
        lazy: page("documents"),
      },
      {
        path: "rapports",
        lazy: page("rapports"),
      },
      {
        path: "parametres",
        lazy: page("parametres"),
      },
      { path: "*", element: <Navigate to="/aujourdhui" replace /> },
    ],
  },
]);
