import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./index.css";
import "./app/fenetre";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initialiserDetectionReseau } from "./lib/online";
import { signalerInterfacePrete } from "./lib/tauri";

initialiserDetectionReseau();

// Les fenêtres sont créées cachées (pas de flash blanc) et affichées dès le premier rendu validé par React.
// Pas de requestAnimationFrame ici : il ne s'exécute pas tant que la fenêtre est cachée.
function SignalPret() {
  React.useEffect(() => void signalerInterfacePrete(), []);
  return null;
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
    <SignalPret />
  </React.StrictMode>,
);
