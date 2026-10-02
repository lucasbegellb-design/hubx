import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { refProjet } from "@/lib/config";
import { queryClient } from "@/lib/queryClient";
import { urlServeur } from "@/lib/supabase";
import { ouvrirUrl } from "@/lib/tauri";
import { ListeEtapes } from "./Etapes";
import { mettreAJourServeur, type Etape } from "./installation";

/** Applique les nouvelles migrations et redéploie les fonctions (jeton Supabase demandé, non conservé). */
export function DialogueMiseAJourServeur({ ouvert, onOuvert }: { ouvert: boolean; onOuvert: (v: boolean) => void }) {
  const [jeton, setJeton] = useState("");
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  // VITE_INSTALL_REF : uniquement pour tester en local avec un faux service de gestion
  const ref = refProjet(urlServeur) ?? ((import.meta.env.VITE_INSTALL_REF as string | undefined) || null);

  async function lancer() {
    if (!ref) return setErreur("Adresse de serveur non reconnue (projet Supabase hébergé attendu).");
    setErreur(null);
    setEnCours(true);
    try {
      await mettreAJourServeur(jeton.trim(), ref, setEtapes);
      toast.success("Serveur mis à jour");
      setJeton("");
      queryClient.invalidateQueries({ queryKey: ["parametres"] });
      onOuvert(false);
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  return (
    <Dialog open={ouvert} onOpenChange={(o) => !enCours && onOuvert(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mettre à jour le serveur</DialogTitle>
          <DialogDescription>
            Installe sur le serveur les nouveautés de cette version (base de données et fonctions). Tes données sont
            conservées.
          </DialogDescription>
        </DialogHeader>
        {etapes.length ? (
          <ListeEtapes etapes={etapes} />
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="jeton-maj">Jeton d'accès Supabase</Label>
            <Input
              id="jeton-maj"
              type="password"
              value={jeton}
              onChange={(e) => setJeton(e.target.value)}
              placeholder="sbp_…"
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              À générer sur{" "}
              <button
                type="button"
                className="text-primary hover:underline"
                onClick={() => ouvrirUrl("https://supabase.com/dashboard/account/tokens")}
              >
                supabase.com › Access Tokens
              </button>
              . Utilisé une seule fois, jamais enregistré.
            </p>
          </div>
        )}
        {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOuvert(false)} disabled={enCours}>
            Fermer
          </Button>
          <Button onClick={lancer} disabled={enCours || jeton.trim().length < 20}>
            {enCours ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {erreur ? "Réessayer" : "Mettre à jour"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
