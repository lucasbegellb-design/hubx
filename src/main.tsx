import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "./index.css";
import "./app/fenetre";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { initialiserDetectionReseau } from "./lib/online";

initialiserDetectionReseau();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
