import { KeyRound, UserMinus, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/AuthProvider";
import { useMembres } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { ilYa } from "@/lib/format";
import { queryClient } from "@/lib/queryClient";
import { gererMembre } from "../api";

function genererMotDePasse(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const v = crypto.getRandomValues(new Uint32Array(14));
  return Array.from(v, (n) => alphabet[n % alphabet.length]).join("");
}

export function SectionComptes() {
  const { estAdmin, userId } = useAuth();
  const membres = useMembres();
  const { peutEcrire } = useEcriture();
  const [form, setForm] = useState({ email: "", nom: "", role: "membre", mot_de_passe: genererMotDePasse() });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [nouveauMdp, setNouveauMdp] = useState("");

  async function action(corps: Record<string, unknown>, succes: string) {
    setErreur(null);
    setEnCours(true);
    try {
      await gererMembre(corps);
      toast.success(succes);
      queryClient.invalidateQueries({ queryKey: ["membres"] });
      return true;
    } catch (e) {
      setErreur((e as Error).message);
      return false;
    } finally {
      setEnCours(false);
    }
  }

  return (
    <div className="space-y-6">
      <ul className="divide-y rounded-lg border bg-card">
        {membres.data?.map((m) => (
          <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {m.nom} {m.user_id === userId ? <span className="text-sm font-normal text-muted-foreground">(toi)</span> : null}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {m.email} · dernière ouverture {ilYa(m.derniere_ouverture_at)}
              </p>
            </div>
            {estAdmin ? (
              <>
                <Select value={m.role} onValueChange={(v) => action({ action: "role", user_id: m.user_id, role: v }, "Rôle modifié")} disabled={!peutEcrire || enCours}>
                  <SelectTrigger className="h-8 w-36" aria-label={`Rôle de ${m.nom}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrateur</SelectItem>
                    <SelectItem value="membre">Membre</SelectItem>
                  </SelectContent>
                </Select>
                <Popover onOpenChange={(o) => o && setNouveauMdp(genererMotDePasse())}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Réinitialiser le mot de passe de ${m.nom}`} disabled={!peutEcrire}>
                      <KeyRound />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 space-y-2">
                    <p className="text-sm font-medium">Nouveau mot de passe pour {m.nom}</p>
                    <Input value={nouveauMdp} onChange={(e) => setNouveauMdp(e.target.value)} className="font-mono text-sm" aria-label="Nouveau mot de passe" />
                    <p className="text-xs text-muted-foreground">Transmets-le de vive voix ; la personne pourra le changer dans Paramètres › Mon compte.</p>
                    <Button size="sm" onClick={() => action({ action: "mot_de_passe", user_id: m.user_id, mot_de_passe: nouveauMdp }, "Mot de passe réinitialisé")}>
                      Réinitialiser
                    </Button>
                  </PopoverContent>
                </Popover>
                {m.user_id !== userId ? (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label={`Retirer l'accès de ${m.nom}`} disabled={!peutEcrire}>
                        <UserMinus />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 space-y-2">
                      <p className="text-sm">
                        Retirer l'accès de <strong>{m.nom}</strong> ? Son compte est bloqué ; ses tâches, process et documents restent en place.
                      </p>
                      <Button size="sm" variant="destructive" onClick={() => action({ action: "retirer", user_id: m.user_id }, "Accès retiré")}>
                        Retirer l'accès
                      </Button>
                    </PopoverContent>
                  </Popover>
                ) : null}
              </>
            ) : (
              <span className="text-sm text-muted-foreground">{m.role === "admin" ? "Administrateur" : "Membre"}</span>
            )}
          </li>
        ))}
      </ul>

      {estAdmin ? (
        <div className="space-y-3 border-t pt-5">
          <p className="font-medium">Ajouter un compte</p>
          <div className="grid max-w-2xl grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="c-nom">Nom</Label>
              <Input id="c-nom" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} placeholder="Edwin" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-email">E-mail</Label>
              <Input id="c-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="edwin@xtim.fr" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="c-mdp">Mot de passe provisoire</Label>
              <Input id="c-mdp" value={form.mot_de_passe} onChange={(e) => setForm({ ...form, mot_de_passe: e.target.value })} className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <Label>Rôle</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger aria-label="Rôle">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="membre">Membre</SelectItem>
                  <SelectItem value="admin">Administrateur</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            onClick={async () => {
              if (await action({ action: "creer", ...form }, "Compte créé")) setForm({ email: "", nom: "", role: "membre", mot_de_passe: genererMotDePasse() });
            }}
            disabled={!form.email || !form.nom || enCours || !peutEcrire}
          >
            <UserPlus aria-hidden /> Créer le compte
          </Button>
          <p className="text-sm text-muted-foreground">Communique l'e-mail et le mot de passe provisoire à la personne ; elle le changera à sa première connexion.</p>
        </div>
      ) : null}
      {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
    </div>
  );
}
