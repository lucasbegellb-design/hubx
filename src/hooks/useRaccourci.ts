import { useEffect, useRef } from "react";

export function estChampSaisie(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/**
 * Raccourci clavier : "n", "/", "Escape", "mod+k" (Ctrl ou Cmd), "mod+shift+f"…
 * Par défaut ignoré quand le focus est dans un champ de saisie (sauf combinaisons avec mod).
 */
export function useRaccourci(
  combinaison: string,
  handler: (e: KeyboardEvent) => void,
  options: { actif?: boolean; dansChamps?: boolean } = {},
) {
  const { actif = true, dansChamps } = options;
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    if (!actif) return;
    const parties = combinaison.toLowerCase().split("+");
    const touche = parties.pop()!;
    const mod = parties.includes("mod");
    const shift = parties.includes("shift");
    const alt = parties.includes("alt");
    const fn = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      const cle = e.key.toLowerCase();
      if (cle !== touche && !(touche === "space" && e.code === "Space")) return;
      if (mod !== (e.ctrlKey || e.metaKey) || alt !== e.altKey) return;
      if (shift !== e.shiftKey && touche.length === 1 && /[a-z0-9]/.test(touche)) return;
      const autoriseDansChamp = dansChamps ?? (mod || touche === "escape");
      if (!autoriseDansChamp && estChampSaisie(e.target)) return;
      e.preventDefault();
      ref.current(e);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [combinaison, actif, dansChamps]);
}
