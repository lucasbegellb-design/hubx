import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { useEcriture } from "@/hooks/useEcriture";
import { urlFonction } from "@/lib/fonctions";
import { dateCourte } from "@/lib/format";
import { messageErreur, supabase } from "@/lib/supabase";

/** Lien secret d'abonnement au calendrier (Outlook, Google, iPhone), montré une seule fois. */
export function AbonnementCalendrier() {
  const { userId } = useAuth();
  const { peutEcrire } = useEcriture();
  const qc = useQueryClient();
  const [lien, setLien] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  const actuel = useQuery({
    queryKey: ["calendriers", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("calendriers").select("created_at").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function generer() {
    setOccupe(true);
    try {
      const { data, error } = await supabase.rpc("generer_jeton_calendrier");
      if (error) throw new Error(messageErreur(error));
      setLien(`${urlFonction("calendrier")}?jeton=${data}`);
      await qc.invalidateQueries({ queryKey: ["calendriers"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOccupe(false);
    }
  }

  async function desactiver() {
    const { error } = await supabase.rpc("supprimer_jeton_calendrier");
    if (error) return toast.error(messageErreur(error));
    setLien(null);
    toast.success("Désactivé");
    await qc.invalidateQueries({ queryKey: ["calendriers"] });
  }

  return (
    <div className="space-y-2 border-t pt-5">
      <Label>Calendrier dans Outlook</Label>
      <p className="text-sm text-muted-foreground">
        Tes échéances (tâches assignées à toi ou à personne), tes rappels et les échéances du suivi Chine dans Outlook,
        Google Agenda ou sur ton iPhone. Lecture seule ; Outlook se met à jour toutes les quelques heures.
      </p>
      {actuel.error ? (
        <p className="text-sm text-muted-foreground">
          Disponible après la mise à jour du serveur (Paramètres › Clés et connexions).
        </p>
      ) : lien ? (
        <div className="space-y-2 rounded-md border p-3">
          <div className="flex gap-2">
            <Input readOnly value={lien} className="font-mono text-xs" aria-label="Lien d'abonnement" />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copier le lien"
              onClick={() => navigator.clipboard.writeText(lien).then(() => toast.success("Copié"))}
            >
              <Copy />
            </Button>
          </div>
          <p className="text-sm">Copie-le maintenant : il ne sera plus affiché. Garde-le pour toi.</p>
          <ul className="list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
            <li>Outlook : Calendrier › Ajouter un calendrier › S'abonner à partir du web, puis coller le lien.</li>
            <li>Google Agenda : Autres agendas › + › À partir de l'URL.</li>
            <li>iPhone : Réglages › Calendrier › Comptes › Ajouter un compte › Autre › Calendrier avec abonnement.</li>
          </ul>
        </div>
      ) : actuel.data ? (
        <p className="text-sm">Lien actif depuis le {dateCourte(actuel.data.created_at)}.</p>
      ) : null}
      {!actuel.error ? (
        <div className="flex gap-2">
          <Button variant="outline" onClick={generer} disabled={occupe || !peutEcrire}>
            {occupe ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {actuel.data ? "Régénérer le lien" : "Créer mon lien d'abonnement"}
          </Button>
          {actuel.data ? (
            <Button variant="ghost" onClick={desactiver} disabled={!peutEcrire}>
              Désactiver
            </Button>
          ) : null}
        </div>
      ) : null}
      {actuel.data && !lien ? (
        <p className="text-xs text-muted-foreground">Régénérer invalide l'ancien lien (à refaire dans Outlook).</p>
      ) : null}
    </div>
  );
}
