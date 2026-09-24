import { create } from "zustand";
import { urlServeur } from "./supabase";

interface OnlineState {
  online: boolean;
  set: (v: boolean) => void;
}

export const useOnlineStore = create<OnlineState>((set) => ({
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  set: (online) => set({ online }),
}));

export const useOnline = () => useOnlineStore((s) => s.online);

let sonde: number | undefined;

async function pinger(): Promise<boolean> {
  if (!urlServeur) return navigator.onLine;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const r = await fetch(`${urlServeur}/auth/v1/health`, { signal: ctrl.signal, cache: "no-store" });
    clearTimeout(t);
    return r.status < 500 || r.status === 503 ? true : false;
  } catch {
    return false;
  }
}

function demarrerSonde() {
  if (sonde) return;
  sonde = window.setInterval(async () => {
    if (await pinger()) {
      window.clearInterval(sonde);
      sonde = undefined;
      useOnlineStore.getState().set(true);
    }
  }, 8000);
}

/** À appeler quand une requête échoue pour cause réseau. */
export function signalerErreurReseau() {
  if (!useOnlineStore.getState().online) return;
  useOnlineStore.getState().set(false);
  demarrerSonde();
}

export function estErreurReseau(e: unknown) {
  const msg = (e as { message?: string })?.message ?? "";
  return /Failed to fetch|NetworkError|Load failed|fetch failed/i.test(msg);
}

export function initialiserDetectionReseau() {
  window.addEventListener("offline", () => {
    useOnlineStore.getState().set(false);
    demarrerSonde();
  });
  window.addEventListener("online", async () => {
    if (await pinger()) useOnlineStore.getState().set(true);
    else demarrerSonde();
  });
}
