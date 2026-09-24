import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/features/auth/AuthProvider";
import { dateCourte, heure } from "@/lib/format";
import { ecouterRealtime } from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import { estTauri, notifier } from "@/lib/tauri";
import { useUi } from "@/stores/ui";
import { useOnlineStore } from "@/lib/online";

const INTERVALLE_RAPPELS = 30_000;

/**
 * Rappels des post-its : notification native à l'heure dite, y compris app réduite.
 * Au démarrage, les rappels manqués (app fermée) sont rattrapés.
 */
function useRappels(userId: string) {
  useEffect(() => {
    let actif = true;
    let premierPassage = true;
    async function verifier() {
      if (!useOnlineStore.getState().online) return;
      const { data, error } = await supabase
        .from("postits")
        .select("id, contenu, rappel_at")
        .eq("proprietaire", userId)
        .eq("rappel_envoye", false)
        .is("archived_at", null)
        .lte("rappel_at", new Date().toISOString())
        .order("rappel_at")
        .limit(20);
      if (error || !data?.length || !actif) return;
      for (const p of data) {
        // Marque d'abord (évite un double envoi si deux fenêtres/postes sont ouverts)
        const { data: marque } = await supabase
          .from("postits")
          .update({ rappel_envoye: true })
          .eq("id", p.id)
          .eq("rappel_envoye", false)
          .select("id");
        if (!marque?.length) continue;
        const manque = premierPassage && Date.now() - new Date(p.rappel_at!).getTime() > 5 * 60_000;
        const titre = manque ? `Rappel manqué (${dateCourte(p.rappel_at)} ${heure(p.rappel_at)})` : "Rappel";
        await notifier(titre, p.contenu.slice(0, 180));
        toast(titre, { description: p.contenu.slice(0, 180), duration: 15_000 });
      }
      premierPassage = false;
    }
    verifier();
    const t = window.setInterval(verifier, INTERVALLE_RAPPELS);
    return () => {
      actif = false;
      window.clearInterval(t);
    };
  }, [userId]);
}

/** Notification dans l'app (et native) quand un rapport est prêt. */
function useNotificationsRapports() {
  const naviguer = useNavigate();
  useEffect(
    () =>
      ecouterRealtime((table, evt, ligne) => {
        if (table !== "rapports" || ligne.statut !== "pret") return;
        if (evt !== "INSERT" && evt !== "UPDATE") return;
        const libelle = ligne.type === "hebdo" ? "Rapport hebdomadaire" : ligne.type === "mensuel" ? "Rapport mensuel" : "Rapport";
        toast.success(`${libelle} prêt`, {
          description: `Période du ${dateCourte(ligne.periode_debut as string)} au ${dateCourte(ligne.periode_fin as string)}`,
          action: { label: "Ouvrir", onClick: () => naviguer(`/rapports?r=${ligne.id}`) },
        });
        if (ligne.type !== "demande") notifier(`${libelle} prêt`, "Disponible dans Hub XTIM › Rapports.");
      }),
    [naviguer],
  );
}

/** Raccourci global (Ctrl+Maj+Espace par défaut) : ouvre la fenêtre de capture, même app en arrière-plan. */
function useRaccourciGlobal() {
  const raccourci = useUi((s) => s.raccourciCapture);
  useEffect(() => {
    if (!estTauri()) return;
    let annule = false;
    (async () => {
      const gs = await import("@tauri-apps/plugin-global-shortcut");
      const { invoke } = await import("@tauri-apps/api/core");
      try {
        if (await gs.isRegistered(raccourci)) await gs.unregister(raccourci);
        if (annule) return;
        await gs.register(raccourci, (e) => {
          if (e.state === "Pressed") invoke("ouvrir_capture");
        });
      } catch {
        toast.warning(`Raccourci global « ${raccourci} » indisponible (déjà utilisé par une autre application ?). Change-le dans Paramètres.`);
      }
    })();
    return () => {
      annule = true;
      import("@tauri-apps/plugin-global-shortcut").then((gs) => gs.unregister(raccourci).catch(() => undefined));
    };
  }, [raccourci]);
}

export function ServicesArrierePlan() {
  const { userId } = useAuth();
  useRappels(userId);
  useNotificationsRapports();
  useRaccourciGlobal();
  return null;
}
