// Détecte la fenêtre de capture rapide (créée par Rust avec le label « capture »)
// avant la création du routeur, pour afficher directement la bonne vue.
type Internes = { metadata?: { currentWindow?: { label?: string } } };
const label = (window as unknown as { __TAURI_INTERNALS__?: Internes }).__TAURI_INTERNALS__?.metadata?.currentWindow
  ?.label;
if (label === "capture" && !location.hash.startsWith("#/capture")) location.hash = "#/capture";

export const estFenetreCapture = location.hash.startsWith("#/capture");
