import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "clair" | "sombre" | "systeme";

interface UiState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  paletteOuverte: boolean;
  setPaletteOuverte: (v: boolean) => void;
  /** Raccourci global de capture (format plugin global-shortcut). */
  raccourciCapture: string;
  setRaccourciCapture: (r: string) => void;
  /** Brouillons de saisie conservés même hors ligne ou après fermeture. */
  brouillons: Record<string, string>;
  setBrouillon: (cle: string, valeur: string) => void;
}

export const RACCOURCI_CAPTURE_DEFAUT = "CommandOrControl+Shift+Space";

export const useUi = create<UiState>()(
  persist(
    (set) => ({
      theme: "systeme",
      setTheme: (theme) => set({ theme }),
      paletteOuverte: false,
      setPaletteOuverte: (paletteOuverte) => set({ paletteOuverte }),
      raccourciCapture: RACCOURCI_CAPTURE_DEFAUT,
      setRaccourciCapture: (raccourciCapture) => set({ raccourciCapture }),
      brouillons: {},
      setBrouillon: (cle, valeur) =>
        set((s) => {
          const brouillons = { ...s.brouillons };
          if (valeur) brouillons[cle] = valeur;
          else delete brouillons[cle];
          return { brouillons };
        }),
    }),
    {
      name: "hubx-ui",
      partialize: (s) => ({ theme: s.theme, raccourciCapture: s.raccourciCapture, brouillons: s.brouillons }),
    },
  ),
);

function systemeSombre() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Thème effectif (clair/sombre) en tenant compte du système. */
export function useResolvedTheme(): "light" | "dark" {
  const theme = useUi((s) => s.theme);
  const [sys, setSys] = useState(systemeSombre);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const fn = () => setSys(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, []);
  if (theme === "systeme") return sys ? "dark" : "light";
  return theme === "sombre" ? "dark" : "light";
}

/** Applique la classe `dark` sur <html>. */
export function useApplyTheme() {
  const resolved = useResolvedTheme();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);
}

/** Brouillon persistant pour un champ de saisie (aucune perte en cas de coupure). */
export function useBrouillon(cle: string): [string, (v: string) => void] {
  const valeur = useUi((s) => s.brouillons[cle] ?? "");
  const setBrouillon = useUi((s) => s.setBrouillon);
  return [valeur, (v: string) => setBrouillon(cle, v)];
}
