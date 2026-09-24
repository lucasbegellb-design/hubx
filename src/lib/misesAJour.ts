import { toast } from "sonner";
import { estTauri } from "./tauri";

export type EtatMaj =
  | { type: "a_jour" }
  | { type: "disponible"; version: string; notes?: string }
  | { type: "erreur"; message: string }
  | { type: "indisponible" };

/** Vérifie la présence d'une nouvelle version (GitHub Releases, signée). */
export async function verifierMiseAJour(): Promise<EtatMaj> {
  if (!estTauri()) return { type: "indisponible" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const maj = await check();
    if (!maj) return { type: "a_jour" };
    return { type: "disponible", version: maj.version, notes: maj.body };
  } catch (e) {
    const m = String((e as Error)?.message ?? e);
    return {
      type: "erreur",
      message: /pubkey|signature|REMPLACER/i.test(m)
        ? "Mises à jour non configurées (clé de signature absente, voir SETUP.md)."
        : "Serveur de mises à jour injoignable. Nouvel essai plus tard.",
    };
  }
}

/** Télécharge, installe puis relance l'application. */
export async function installerMiseAJour(): Promise<void> {
  const { check } = await import("@tauri-apps/plugin-updater");
  const { relaunch } = await import("@tauri-apps/plugin-process");
  const maj = await check();
  if (!maj) return;
  const id = toast.loading(`Téléchargement de la version ${maj.version}…`);
  try {
    await maj.downloadAndInstall();
    toast.success("Mise à jour installée, redémarrage…", { id });
    await relaunch();
  } catch {
    toast.error("Installation impossible. Réessaie plus tard ou télécharge la dernière version sur GitHub.", { id });
  }
}

/** Vérification discrète au démarrage : propose l'installation si une version est disponible. */
export async function verifierAuDemarrage() {
  const etat = await verifierMiseAJour();
  if (etat.type === "disponible") {
    toast(`Nouvelle version ${etat.version} disponible`, {
      duration: 30_000,
      action: { label: "Installer", onClick: () => installerMiseAJour() },
    });
  }
}
