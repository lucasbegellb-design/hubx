/**
 * Pont vers les API Tauri. Toutes les fonctions sont neutres hors Tauri
 * (navigateur, `npm run dev`) pour que le front reste testable seul.
 */
export const estTauri = (): boolean => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export async function labelFenetre(): Promise<string> {
  if (!estTauri()) return new URLSearchParams(location.search).get("fenetre") ?? "main";
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  return getCurrentWindow().label;
}

/** Notification native (Windows : centre de notifications, même app réduite). */
export async function notifier(titre: string, corps: string): Promise<void> {
  if (estTauri()) {
    const n = await import("@tauri-apps/plugin-notification");
    let ok = await n.isPermissionGranted();
    if (!ok) ok = (await n.requestPermission()) === "granted";
    if (ok) n.sendNotification({ title: titre, body: corps });
    return;
  }
  if ("Notification" in window) {
    if (Notification.permission === "default") await Notification.requestPermission();
    if (Notification.permission === "granted") new Notification(titre, { body: corps });
  }
}

export async function ouvrirUrl(url: string): Promise<void> {
  if (estTauri()) {
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  } else {
    window.open(url, "_blank", "noopener");
  }
}

/**
 * Enregistre un fichier via la boîte de dialogue native. Renvoie le chemin choisi,
 * ou `null` si l'utilisateur annule. Hors Tauri : téléchargement navigateur.
 */
export async function enregistrerFichier(
  nomParDefaut: string,
  donnees: Uint8Array | Blob,
  filtre?: { nom: string; extensions: string[] },
): Promise<string | null> {
  const octets = donnees instanceof Blob ? new Uint8Array(await donnees.arrayBuffer()) : donnees;
  if (estTauri()) {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const chemin = await save({
      defaultPath: nomParDefaut,
      filters: filtre ? [{ name: filtre.nom, extensions: filtre.extensions }] : undefined,
    });
    if (!chemin) return null;
    const { writeFile } = await import("@tauri-apps/plugin-fs");
    await writeFile(chemin, octets);
    return chemin;
  }
  const url = URL.createObjectURL(new Blob([octets as BlobPart]));
  const a = document.createElement("a");
  a.href = url;
  a.download = nomParDefaut;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return nomParDefaut;
}

export async function montrerFenetrePrincipale(): Promise<void> {
  if (!estTauri()) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("montrer_principale");
}

export async function fermerFenetreCourante(): Promise<void> {
  if (!estTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  await getCurrentWindow().close();
}

export async function versionApp(): Promise<string> {
  if (!estTauri()) return import.meta.env.VITE_APP_VERSION ?? "dev";
  const { getVersion } = await import("@tauri-apps/api/app");
  return getVersion();
}
