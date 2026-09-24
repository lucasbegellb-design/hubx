import { Download, FileDown, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { exporterPackPassation } from "@/features/process/exports";
import { useReferentiels } from "@/features/referentiels/api";
import { installerMiseAJour, verifierMiseAJour, type EtatMaj } from "@/lib/misesAJour";
import { estTauri, versionApp } from "@/lib/tauri";
import { exporterTout } from "../exportComplet";

export function SectionSysteme() {
  const { membre } = useAuth();
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
