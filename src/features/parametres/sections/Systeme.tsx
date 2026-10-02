import { useQuery } from "@tanstack/react-query";
import { Archive, Download, FileDown, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { exporterPackPassation } from "@/features/process/exports";
import { useReferentiels } from "@/features/referentiels/api";
import { appelerFonction } from "@/lib/fonctions";
import { dateLongue, taille } from "@/lib/format";
import { installerMiseAJour, verifierMiseAJour, type EtatMaj } from "@/lib/misesAJour";
import { supabase } from "@/lib/supabase";
import { enregistrerFichier, estTauri, versionApp } from "@/lib/tauri";
import { exporterTout } from "../exportComplet";

/** Sauvegardes automatiques du dimanche (bucket privé, lecture administrateur). */
function Sauvegardes() {
  const [occupe, setOccupe] = useState<string | null>(null);
  const liste = useQuery({
    queryKey: ["sauvegardes"],
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("sauvegardes")
        .list("", { limit: 100, sortBy: { column: "name", order: "desc" } });
      if (error) throw error;
      return data.filter((f) => f.name.endsWith(".zip"));
    },
  });

  async function sauvegarder() {
    setOccupe("maintenant");
    try {
      await appelerFonction("sauvegarde", {});
      toast.success("Sauvegardé");
      await liste.refetch();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(null);
    }
  }

  async function telecharger(nom: string) {
    setOccupe(nom);
    try {
      const { data, error } = await supabase.storage.from("sauvegardes").download(nom);
      if (error) throw error;
      const chemin = await enregistrerFichier(`hub-xtim-sauvegarde-${nom}`, data, {
        nom: "Archive zip",
        extensions: ["zip"],
      });
      if (chemin) toast.success("Téléchargé");
    } catch {
      toast.error("Téléchargement impossible. Réessaie.");
    } finally {
      setOccupe(null);
    }
  }

  return (
    <div className="space-y-2 border-t pt-5">
      <Label>Sauvegardes automatiques</Label>
      <p className="text-sm text-muted-foreground">
        Chaque dimanche dans la nuit, toutes les données sont sauvegardées sur le serveur (8 dernières semaines). Les
        fichiers déposés restent dans le stockage des documents ; les post-its privés ne sont pas copiés.
      </p>
      {liste.error ? (
        <MessageErreur>
          Sauvegardes indisponibles : mets d'abord le serveur à jour (Paramètres › Clés et connexions).
        </MessageErreur>
      ) : liste.data?.length ? (
        <ul className="divide-y rounded-md border">
          {liste.data.map((f) => (
            <li key={f.name} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Archive className="size-4 text-muted-foreground" aria-hidden />
              <span className="flex-1">{dateLongue(f.name.replace(".zip", ""))}</span>
              <span className="tabular text-muted-foreground">
                {taille((f.metadata as { size?: number } | null)?.size)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => telecharger(f.name)}
                disabled={Boolean(occupe)}
                aria-label={`Télécharger la sauvegarde du ${dateLongue(f.name.replace(".zip", ""))}`}
              >
                {occupe === f.name ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
              </Button>
            </li>
          ))}
        </ul>
      ) : liste.isSuccess ? (
        <p className="text-sm text-muted-foreground">Aucune sauvegarde pour l'instant.</p>
      ) : null}
      <Button variant="outline" onClick={sauvegarder} disabled={Boolean(occupe)}>
        {occupe === "maintenant" ? <Loader2 className="animate-spin" aria-hidden /> : <Archive aria-hidden />}
        Sauvegarder maintenant
      </Button>
    </div>
  );
}

export function SectionSysteme() {
  const { membre, estAdmin } = useAuth();
  const r = useReferentiels();
  const [version, setVersion] = useState("");
  const [maj, setMaj] = useState<EtatMaj | null>(null);
  const [verif, setVerif] = useState(false);
  const [progression, setProgression] = useState<string | null>(null);

  useEffect(() => {
    versionApp().then(setVersion);
  }, []);

  async function verifier() {
    setVerif(true);
    setMaj(await verifierMiseAJour());
    setVerif(false);
  }

  async function exporter() {
    setProgression("Préparation…");
    try {
      const chemin = await exporterTout(setProgression);
      if (chemin) toast.success("Export complet enregistré");
    } catch (e) {
      toast.error(`Export impossible : ${(e as Error).message}`);
    } finally {
      setProgression(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Mises à jour</Label>
        <p className="text-sm text-muted-foreground">
          Version installée : <span className="tabular">{version}</span>. Les nouvelles versions sont proposées
          automatiquement au démarrage.
        </p>
        <Button variant="outline" onClick={verifier} disabled={verif || !estTauri()}>
          <RefreshCw aria-hidden className={verif ? "animate-spin" : undefined} /> Rechercher une mise à jour
        </Button>
        {!estTauri() ? <p className="text-sm text-muted-foreground">Disponible dans l'application de bureau.</p> : null}
        {maj?.type === "a_jour" ? <p className="text-sm text-fait">Tu utilises la dernière version.</p> : null}
        {maj?.type === "disponible" ? (
          <div className="flex items-center gap-3">
            <p className="text-sm">Version {maj.version} disponible.</p>
            <Button size="sm" onClick={() => installerMiseAJour()}>
              <Download aria-hidden /> Installer et redémarrer
            </Button>
          </div>
        ) : null}
        {maj?.type === "erreur" ? <MessageErreur>{maj.message}</MessageErreur> : null}
      </div>

      <div className="space-y-2 border-t pt-5">
        <Label>Export complet</Label>
        <p className="text-sm text-muted-foreground">
          Toutes les données (JSON et CSV pour Excel) et tous les fichiers déposés, dans une archive zip. À faire avant
          une passation ou régulièrement comme sauvegarde.
        </p>
        <Button variant="outline" onClick={exporter} disabled={Boolean(progression)}>
          <Download aria-hidden /> {progression ?? "Exporter toutes les données"}
        </Button>
      </div>

      {estAdmin ? <Sauvegardes /> : null}

      <div className="space-y-2 border-t pt-5">
        <Label>Pack de passation</Label>
        <p className="text-sm text-muted-foreground">Tous les process actifs dans un seul PDF, avec sommaire.</p>
        <Button
          variant="outline"
          onClick={() => exporterPackPassation(r.domaines, membre?.nom ?? "").catch((e) => toast.error(e.message))}
        >
          <FileDown aria-hidden /> Générer le pack de passation
        </Button>
      </div>
    </div>
  );
}
