import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/features/auth/AuthProvider";
import { queryClient } from "@/lib/queryClient";
import { messageErreur, supabase } from "@/lib/supabase";

export function SectionCompte() {
  const { membre, session } = useAuth();
  const [nom, setNom] = useState(membre?.nom ?? "");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");

  async function renommer() {
    const { error } = await supabase.rpc("renommer_moi", { p_nom: nom.trim() });
    if (error) return toast.error(messageErreur(error));
    queryClient.invalidateQueries({ queryKey: ["membres"] });
    toast.success("Nom enregistré");
  }

  async function changerMdp() {
    if (mdp.length < 10) return toast.error("10 caractères minimum.");
    if (mdp !== mdp2) return toast.error("Les deux saisies ne correspondent pas.");
    const { error } = await supabase.auth.updateUser({ password: mdp });
    if (error) return toast.error(messageErreur(error));
    setMdp("");
    setMdp2("");
    toast.success("Mot de passe changé");
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="nom">Nom affiché</Label>
        <div className="flex gap-2">
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} className="max-w-xs" />
          <Button variant="outline" onClick={renommer} disabled={!nom.trim() || nom.trim() === membre?.nom}>
            Enregistrer
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {session?.user.email} · {membre?.role === "admin" ? "administrateur" : "membre"}
        </p>
      </div>
      <div className="space-y-1.5 border-t pt-5">
        <Label>Changer de mot de passe</Label>
        <div className="flex max-w-lg flex-wrap gap-2">
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Nouveau mot de passe"
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            className="w-52"
            aria-label="Nouveau mot de passe"
          />
          <Input
            type="password"
            autoComplete="new-password"
            placeholder="Confirmation"
            value={mdp2}
            onChange={(e) => setMdp2(e.target.value)}
            className="w-40"
            aria-label="Confirmation"
          />
          <Button variant="outline" onClick={changerMdp} disabled={!mdp}>
            Changer
          </Button>
        </div>
      </div>
      <div className="border-t pt-5">
        <Button variant="outline" onClick={() => supabase.auth.signOut()}>
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
