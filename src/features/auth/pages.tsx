import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageErreur } from "@/components/common";
import { enregistrerConfigServeur } from "@/lib/config";
import { messageErreur, supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "./AuthProvider";

function Cadre({ titre, sousTitre, children }: { titre: string; sousTitre?: string; children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-background p-6">
      <div className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-6">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Hub XTIM</p>
          <h1 className="text-xl font-semibold">{titre}</h1>
          {sousTitre ? <p className="text-sm text-muted-foreground">{sousTitre}</p> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

const schemaServeur = z.object({
  url: z.string().trim().url("Adresse invalide (ex. https://abcd.supabase.co)."),
  anonKey: z.string().trim().min(20, "Clé trop courte : copie la clé « anon » ou « publishable » complète."),
});

/** Premier lancement sans configuration intégrée au build. */
export function PageConfigServeur() {
  const form = useForm<z.infer<typeof schemaServeur>>({ resolver: zodResolver(schemaServeur) });
  const onSubmit = form.handleSubmit((v) => {
    enregistrerConfigServeur({ url: v.url.replace(/\/$/, ""), anonKey: v.anonKey });
    location.reload();
  });
  return (
    <Cadre
      titre="Connexion au serveur"
      sousTitre="Renseigne une fois l'adresse du projet Supabase (voir SETUP.md, étape 1)."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="url">Adresse du projet</Label>
          <Input id="url" placeholder="https://xxxx.supabase.co" autoFocus {...form.register("url")} />
          {form.formState.errors.url ? (
            <p className="text-sm text-urgent">{form.formState.errors.url.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="anon">Clé publique (anon)</Label>
          <Input id="anon" {...form.register("anonKey")} />
          {form.formState.errors.anonKey ? (
            <p className="text-sm text-urgent">{form.formState.errors.anonKey.message}</p>
          ) : null}
        </div>
        <Button type="submit" className="w-full">
          Enregistrer
        </Button>
      </form>
    </Cadre>
  );
}

const schemaConnexion = z.object({
  email: z.string().trim().email("Adresse e-mail invalide."),
  motDePasse: z.string().min(1, "Saisis ton mot de passe."),
});

export function PageConnexion() {
  const [erreur, setErreur] = useState<string | null>(null);
  const form = useForm<z.infer<typeof schemaConnexion>>({ resolver: zodResolver(schemaConnexion) });
  const onSubmit = form.handleSubmit(async (v) => {
    setErreur(null);
    const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.motDePasse });
    if (error) {
      setErreur(
        /invalid login|invalid credentials/i.test(error.message)
          ? "E-mail ou mot de passe incorrect."
          : messageErreur(error),
      );
    }
  });
  return (
    <Cadre titre="Connexion" sousTitre="XTIM SAS · Bionic Bird">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" type="email" autoComplete="username" autoFocus {...form.register("email")} />
          {form.formState.errors.email ? (
            <p className="text-sm text-urgent">{form.formState.errors.email.message}</p>
          ) : null}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mdp">Mot de passe</Label>
          <Input id="mdp" type="password" autoComplete="current-password" {...form.register("motDePasse")} />
          {form.formState.errors.motDePasse ? (
            <p className="text-sm text-urgent">{form.formState.errors.motDePasse.message}</p>
          ) : null}
        </div>
        {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
        <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Connexion…" : "Se connecter"}
        </Button>
        <p className="text-sm text-muted-foreground">
          Mot de passe oublié ? L'administrateur peut le réinitialiser dans Paramètres › Comptes.
        </p>
      </form>
    </Cadre>
  );
}

/** Compte authentifié mais absent de `membres`. */
export function PageAccesRefuse() {
  const { session } = useAuth();
  const [nom, setNom] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const premierAdmin = useQuery({
    queryKey: ["premier_admin_possible"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("premier_admin_possible");
      if (error) throw error;
      return Boolean(data);
    },
  });

  async function devenirAdmin() {
    setErreur(null);
    const { error } = await supabase.rpc("devenir_premier_admin", { p_nom: nom.trim() || "Administrateur" });
    if (error) setErreur(messageErreur(error));
    else await queryClient.invalidateQueries({ queryKey: ["membres"] });
  }

  return (
    <Cadre
      titre="Accès non autorisé"
      sousTitre={`Le compte ${session?.user.email ?? ""} n'est pas encore membre du Hub.`}
    >
      {premierAdmin.data ? (
        <div className="space-y-3">
          <p className="text-sm">
            Aucun administrateur n'existe encore. Tu peux initialiser le Hub avec ce compte : tu pourras ensuite ajouter
            les autres membres dans Paramètres.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nom">Ton nom</Label>
            <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Lucas" />
          </div>
          {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
          <Button className="w-full" onClick={devenirAdmin}>
            Devenir administrateur
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Demande à l'administrateur de t'ajouter dans Paramètres › Comptes.
        </p>
      )}
      <Button variant="outline" className="w-full" onClick={() => supabase.auth.signOut()}>
        Se déconnecter
      </Button>
    </Cadre>
  );
}
