import { createClient } from "@supabase/supabase-js";
import { ArrowLeft, Copy, ExternalLink, KeyRound, Loader2, Plus, Server, Users } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ChoixIa, problemeIa, valeurIaInitiale, type ValeurIa } from "@/features/parametres/ChoixIa";
import { codeInvitation, enregistrerConfigServeur, lireCodeInvitation, type ConfigServeur } from "@/lib/config";
import { ouvrirUrl } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { ListeEtapes } from "./Etapes";
import {
  attendreProjetActif,
  creerProjet,
  listerOrganisations,
  listerProjets,
  REGIONS,
  type Organisation,
  type ProjetSupabase,
} from "./gestion";
import { installerServeur, type ClesServices, type Etape } from "./installation";

type Ecran = "accueil" | "rejoindre" | "jeton" | "projet" | "compte" | "cles" | "installation" | "fin";

const LIEN_JETONS = "https://supabase.com/dashboard/account/tokens";
const LIEN_GUIDE_AZURE =
  "https://github.com/lucasbegellb-design/hubx/blob/main/SETUP.md#3-connecter-le-fichier-excel-dedwin-application-azure";

function motDePasseAleatoire(n = 24) {
  const a = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  return Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => a[x % a.length]).join("");
}

function Cadre({
  titre,
  sousTitre,
  retour,
  children,
  large,
}: {
  titre: string;
  sousTitre?: ReactNode;
  retour?: () => void;
  children: ReactNode;
  large?: boolean;
}) {
  return (
    <div className="flex h-full items-start justify-center overflow-y-auto bg-background px-6 py-10 scrollbar-thin">
      <div className={cn("w-full space-y-6 rounded-lg border bg-card p-7", large ? "max-w-2xl" : "max-w-xl")}>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {retour ? (
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 size-8"
                onClick={retour}
                aria-label="Étape précédente"
              >
                <ArrowLeft />
              </Button>
            ) : null}
            <p className="text-sm font-medium text-primary">Hub XTIM · configuration</p>
          </div>
          <h1 className="text-xl font-semibold">{titre}</h1>
          {sousTitre ? <div className="text-sm text-muted-foreground">{sousTitre}</div> : null}
        </div>
        {children}
      </div>
    </div>
  );
}

function Lien({ href, children }: { href: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => ouvrirUrl(href)}
      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
    >
      {children}
      <ExternalLink className="size-3.5" aria-hidden />
    </button>
  );
}

function Choix({
  icone,
  titre,
  texte,
  onClick,
}: {
  icone: ReactNode;
  titre: string;
  texte: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-4 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-accent/40"
    >
      <span className="mt-0.5 text-primary">{icone}</span>
      <span>
        <span className="block font-medium">{titre}</span>
        <span className="block text-sm text-muted-foreground">{texte}</span>
      </span>
    </button>
  );
}

/** Ouvre l'app sur le serveur configuré, avec la session déjà ouverte si les identifiants sont connus. */
async function terminer(config: ConfigServeur, identifiants?: { email: string; motDePasse: string }) {
  enregistrerConfigServeur(config);
  if (identifiants) {
    const c = createClient(config.url, config.anonKey, { auth: { persistSession: true, storageKey: "hubx-auth" } });
    await c.auth.signInWithPassword({ email: identifiants.email, password: identifiants.motDePasse });
  }
  location.reload();
}

// ---------------------------------------------------------------------------

function Rejoindre({ retour }: { retour: () => void }) {
  const [code, setCode] = useState("");
  const [manuel, setManuel] = useState(false);
  const [url, setUrl] = useState("");
  const [cle, setCle] = useState("");
  const [erreur, setErreur] = useState<string | null>(null);
  const [test, setTest] = useState(false);

  async function valider() {
    setErreur(null);
    const config = manuel
      ? /^https?:\/\//.test(url.trim()) && cle.trim().length > 20
        ? { url: url.trim().replace(/\/$/, ""), anonKey: cle.trim() }
        : null
      : lireCodeInvitation(code);
    if (!config)
      return setErreur(
        manuel
          ? "Adresse ou clé invalide."
          : "Code d'invitation invalide : copie-le en entier (il commence par HUBX1.).",
      );
    setTest(true);
    try {
      const r = await fetch(`${config.url}/auth/v1/settings`, { headers: { apikey: config.anonKey } });
      if (!r.ok) throw new Error();
      await terminer(config);
    } catch {
      setErreur("Serveur injoignable avec ce code : vérifie ta connexion internet ou demande un nouveau code.");
      setTest(false);
    }
  }

  return (
    <Cadre
      titre="Rejoindre mon équipe"
      sousTitre="Colle le code d'invitation envoyé par l'administrateur (Paramètres › Clés et connexions)."
      retour={retour}
    >
      {!manuel ? (
        <div className="space-y-1.5">
          <Label htmlFor="code">Code d'invitation</Label>
          <Textarea
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={4}
            placeholder="HUBX1.eyJ1Ijoi…"
            className="font-mono text-sm"
            autoFocus
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="url">Adresse du serveur</Label>
            <Input
              id="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://xxxx.supabase.co"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cle">Clé publique</Label>
            <Input id="cle" value={cle} onChange={(e) => setCle(e.target.value)} className="font-mono text-sm" />
          </div>
        </div>
      )}
      {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setManuel(!manuel)}
        >
          {manuel ? "Utiliser un code d'invitation" : "Saisir l'adresse et la clé à la main"}
        </button>
        <Button onClick={valider} disabled={test || (!manuel && !code.trim())}>
          {test ? <Loader2 className="animate-spin" aria-hidden /> : null}
          Continuer
        </Button>
      </div>
    </Cadre>
  );
}

// ---------------------------------------------------------------------------

export default function AssistantPremierLancement() {
  const [ecran, setEcran] = useState<Ecran>("accueil");
  const [jeton, setJeton] = useState("");
  const [projets, setProjets] = useState<ProjetSupabase[]>([]);
  const [organisations, setOrganisations] = useState<Organisation[]>([]);
  const [choix, setChoix] = useState<string>("__nouveau__");
  const [nouveau, setNouveau] = useState({
    nom: "hub-xtim",
    region: "eu-west-3",
    organisation: "",
    motDePasse: motDePasseAleatoire(),
  });
  const [ref, setRef] = useState<string | null>(null);
  const [admin, setAdmin] = useState({ nom: "", email: "", motDePasse: "", confirmation: "" });
  const [services, setServices] = useState<ClesServices>({});
  const [ia, setIa] = useState<ValeurIa>(valeurIaInitiale());
  const [choixServices, setChoixServices] = useState<ClesServices>({});
  const [etapes, setEtapes] = useState<Etape[]>([]);
  const [config, setConfig] = useState<ConfigServeur | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState<string | null>(null);

  async function verifierJeton() {
    setErreur(null);
    setOccupe("Vérification du jeton…");
    try {
      const [p, o] = await Promise.all([listerProjets(jeton.trim()), listerOrganisations(jeton.trim())]);
      setProjets(p);
      setOrganisations(o);
      setNouveau((n) => ({ ...n, organisation: o[0]?.slug ?? "" }));
      setChoix(p.find((x) => x.status === "ACTIVE_HEALTHY")?.ref ?? "__nouveau__");
      setEcran("projet");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOccupe(null);
    }
  }

  async function validerProjet() {
    setErreur(null);
    if (choix !== "__nouveau__") {
      setRef(choix);
      return setEcran("compte");
    }
    if (!nouveau.organisation)
      return setErreur("Aucune organisation Supabase : crée-en une sur supabase.com puis réessaie.");
    setOccupe("Création du projet chez Supabase…");
    try {
      const p = await creerProjet(jeton.trim(), nouveau);
      await attendreProjetActif(jeton.trim(), p.ref, (s) =>
        setOccupe(s === "ACTIVE_HEALTHY" ? "Projet prêt" : "Démarrage du projet (1 à 3 minutes)…"),
      );
      setRef(p.ref);
      setEcran("compte");
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setOccupe(null);
    }
  }

  function validerCompte() {
    setErreur(null);
    if (!admin.nom.trim()) return setErreur("Indique ton nom.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin.email.trim())) return setErreur("Adresse e-mail invalide.");
    if (admin.motDePasse.length < 10) return setErreur("Mot de passe : 10 caractères minimum.");
    if (admin.motDePasse !== admin.confirmation) return setErreur("Les deux mots de passe ne correspondent pas.");
    setEcran("cles");
  }

  function installerAvecCles() {
    const choix: ClesServices = { ...services, ia: ia.cle.trim() ? ia : undefined };
    const probleme = ia.cle.trim() ? problemeIa(ia) : null;
    if (probleme) return setErreur(probleme);
    void lancerInstallation(choix);
  }

  async function lancerInstallation(choix: ClesServices) {
    setChoixServices(choix);
    setErreur(null);
    setEcran("installation");
    try {
      const c = await installerServeur({
        jeton: jeton.trim(),
        ref: ref!,
        admin: { nom: admin.nom, email: admin.email, motDePasse: admin.motDePasse },
        services: choix,
        onEtapes: setEtapes,
      });
      setConfig(c);
      setEcran("fin");
    } catch (e) {
      setErreur((e as Error).message);
    }
  }

  switch (ecran) {
    case "accueil":
      return (
        <Cadre
          titre="Bienvenue dans Hub XTIM"
          sousTitre="Tâches, process, documents, suivi Chine et rapports — au même endroit."
        >
          <div className="space-y-3">
            <Choix
              icone={<Server className="size-5" />}
              titre="Installer Hub XTIM"
              texte="Je suis l'administrateur : l'assistant prépare le serveur (Supabase) et ton compte. Environ 10 minutes."
              onClick={() => setEcran("jeton")}
            />
            <Choix
              icone={<Users className="size-5" />}
              titre="Rejoindre mon équipe"
              texte="Hub XTIM est déjà installé : j'ai reçu un code d'invitation."
              onClick={() => setEcran("rejoindre")}
            />
          </div>
        </Cadre>
      );

    case "rejoindre":
      return <Rejoindre retour={() => setEcran("accueil")} />;

    case "jeton":
      return (
        <Cadre
          titre="Connecte ton compte Supabase"
          sousTitre="Supabase héberge la base de données partagée (offre gratuite suffisante pour démarrer)."
          retour={() => setEcran("accueil")}
        >
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Crée un compte gratuit (ou connecte-toi) sur{" "}
              <Lien href="https://supabase.com/dashboard/sign-up">supabase.com</Lien>.
            </li>
            <li>
              Ouvre la page <Lien href={LIEN_JETONS}>Access Tokens</Lien>, clique « Generate new token », nomme-le « Hub
              XTIM ».
            </li>
            <li>Copie le jeton affiché (il commence par sbp_) et colle-le ci-dessous.</li>
          </ol>
          <div className="space-y-1.5">
            <Label htmlFor="jeton">Jeton d'accès Supabase</Label>
            <Input
              id="jeton"
              type="password"
              value={jeton}
              onChange={(e) => setJeton(e.target.value)}
              placeholder="sbp_…"
              className="font-mono text-sm"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Utilisé uniquement pendant l'installation, jamais enregistré. Tu pourras le supprimer ensuite sur
              supabase.com.
            </p>
          </div>
          {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
          <div className="flex justify-end">
            <Button onClick={verifierJeton} disabled={jeton.trim().length < 20 || Boolean(occupe)}>
              {occupe ? <Loader2 className="animate-spin" aria-hidden /> : <KeyRound aria-hidden />}
              {occupe ?? "Continuer"}
            </Button>
          </div>
        </Cadre>
      );

    case "projet":
      return (
        <Cadre
          titre="Choisis le projet Supabase"
          sousTitre="Hub XTIM s'installe dans un projet dédié."
          retour={() => setEcran("jeton")}
        >
          <div className="space-y-2" role="radiogroup" aria-label="Projet">
            {projets.map((p) => (
              <label
                key={p.ref}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg border p-3",
                  choix === p.ref && "border-primary bg-accent/40",
                )}
              >
                <input
                  type="radio"
                  name="projet"
                  checked={choix === p.ref}
                  onChange={() => setChoix(p.ref)}
                  className="accent-[hsl(var(--primary))]"
                />
                <span className="flex-1">
                  <span className="block font-medium">{p.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {p.region} ·{" "}
                    {p.status === "ACTIVE_HEALTHY"
                      ? "actif"
                      : p.status === "INACTIVE"
                        ? "en pause"
                        : p.status.toLowerCase()}
                  </span>
                </span>
              </label>
            ))}
            <label
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3",
                choix === "__nouveau__" && "border-primary bg-accent/40",
              )}
            >
              <input
                type="radio"
                name="projet"
                checked={choix === "__nouveau__"}
                onChange={() => setChoix("__nouveau__")}
                className="mt-1 accent-[hsl(var(--primary))]"
              />
              <span className="flex-1 space-y-3">
                <span className="flex items-center gap-1.5 font-medium">
                  <Plus className="size-4" aria-hidden /> Créer un nouveau projet
                </span>
                {choix === "__nouveau__" ? (
                  <span className="grid gap-3 sm:grid-cols-2">
                    <span className="space-y-1">
                      <Label htmlFor="p-nom">Nom</Label>
                      <Input
                        id="p-nom"
                        value={nouveau.nom}
                        onChange={(e) => setNouveau({ ...nouveau, nom: e.target.value })}
                      />
                    </span>
                    <span className="space-y-1">
                      <Label>Région</Label>
                      <Select value={nouveau.region} onValueChange={(v) => setNouveau({ ...nouveau, region: v })}>
                        <SelectTrigger aria-label="Région">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REGIONS.map((r) => (
                            <SelectItem key={r.code} value={r.code}>
                              {r.libelle}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </span>
                    {organisations.length > 1 ? (
                      <span className="space-y-1 sm:col-span-2">
                        <Label>Organisation</Label>
                        <Select
                          value={nouveau.organisation}
                          onValueChange={(v) => setNouveau({ ...nouveau, organisation: v })}
                        >
                          <SelectTrigger aria-label="Organisation">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {organisations.map((o) => (
                              <SelectItem key={o.slug} value={o.slug}>
                                {o.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </span>
                    ) : null}
                    <span className="space-y-1 sm:col-span-2">
                      <Label htmlFor="p-mdp">Mot de passe de la base (généré)</Label>
                      <span className="flex gap-2">
                        <Input id="p-mdp" value={nouveau.motDePasse} readOnly className="font-mono text-sm" />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          aria-label="Copier le mot de passe"
                          onClick={() =>
                            navigator.clipboard.writeText(nouveau.motDePasse).then(() => toast.success("Copié"))
                          }
                        >
                          <Copy />
                        </Button>
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        À ranger dans ton coffre-fort : il ne sert qu'à un informaticien en cas de besoin.
                      </span>
                    </span>
                  </span>
                ) : null}
              </span>
            </label>
          </div>
          {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
          <div className="flex items-center justify-end gap-3">
            {occupe ? <p className="text-sm text-muted-foreground">{occupe}</p> : null}
            <Button
              onClick={validerProjet}
              disabled={Boolean(occupe) || (choix === "__nouveau__" && !nouveau.nom.trim())}
            >
              {occupe ? <Loader2 className="animate-spin" aria-hidden /> : null}
              {choix === "__nouveau__" ? "Créer le projet" : "Continuer"}
            </Button>
          </div>
        </Cadre>
      );

    case "compte":
      return (
        <Cadre
          titre="Ton compte administrateur"
          sousTitre="C'est avec ce compte que tu te connecteras. Tu ajouteras Edwin ensuite, depuis l'app."
          retour={() => setEcran("projet")}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="a-nom">Nom</Label>
              <Input
                id="a-nom"
                value={admin.nom}
                onChange={(e) => setAdmin({ ...admin, nom: e.target.value })}
                placeholder="Lucas"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-email">E-mail</Label>
              <Input
                id="a-email"
                type="email"
                value={admin.email}
                onChange={(e) => setAdmin({ ...admin, email: e.target.value })}
                placeholder="lucas@xtim.fr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-mdp">Mot de passe</Label>
              <Input
                id="a-mdp"
                type="password"
                autoComplete="new-password"
                value={admin.motDePasse}
                onChange={(e) => setAdmin({ ...admin, motDePasse: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-mdp2">Confirmation</Label>
              <Input
                id="a-mdp2"
                type="password"
                autoComplete="new-password"
                value={admin.confirmation}
                onChange={(e) => setAdmin({ ...admin, confirmation: e.target.value })}
              />
            </div>
          </div>
          {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
          <div className="flex justify-end">
            <Button onClick={validerCompte}>Continuer</Button>
          </div>
        </Cadre>
      );

    case "cles":
      return (
        <Cadre
          large
          titre="Connecte les services"
          sousTitre="Facultatif : tout fonctionne sans, et tu pourras le faire plus tard dans Paramètres › Clés et connexions."
          retour={() => setEcran("compte")}
        >
          <section className="space-y-2 rounded-lg border p-4">
            <p className="font-medium">Intelligence artificielle</p>
            <p className="text-sm text-muted-foreground">
              Analyse des documents déposés, structuration des process, synthèse des rapports. Mistral propose une offre
              gratuite : crée un compte, puis une clé API, et colle-la ci-dessous.
            </p>
            <ChoixIa valeur={ia} onChange={setIa} />
          </section>
          <section className="space-y-2 rounded-lg border p-4">
            <p className="font-medium">Fichier Excel d'Edwin (Microsoft 365)</p>
            <p className="text-sm text-muted-foreground">
              Lecture seule du suivi fournisseurs Chine sur OneDrive. Demande un administrateur Microsoft 365.{" "}
              <Lien href={LIEN_GUIDE_AZURE}>Guide pas à pas</Lien>
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                aria-label="ID de l'annuaire (tenant)"
                placeholder="ID de l'annuaire"
                value={services.azureTenant ?? ""}
                onChange={(e) => setServices({ ...services, azureTenant: e.target.value })}
                className="font-mono text-sm"
              />
              <Input
                aria-label="ID d'application (client)"
                placeholder="ID d'application"
                value={services.azureClient ?? ""}
                onChange={(e) => setServices({ ...services, azureClient: e.target.value })}
                className="font-mono text-sm"
              />
              <Input
                aria-label="Secret client"
                type="password"
                placeholder="Secret client"
                value={services.azureSecret ?? ""}
                onChange={(e) => setServices({ ...services, azureSecret: e.target.value })}
                className="font-mono text-sm"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Sans ces identifiants, le suivi Chine fonctionne en mode démo sur un fichier d'exemple.
            </p>
          </section>
          <p className="text-xs text-muted-foreground">
            Les clés sont stockées chiffrées sur ton serveur et ne sont jamais relisibles depuis l'application.
          </p>
          {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => void lancerInstallation({})}>
              Plus tard
            </Button>
            <Button onClick={installerAvecCles}>Installer</Button>
          </div>
        </Cadre>
      );

    case "installation":
      return (
        <Cadre titre="Installation en cours" sousTitre="Ne ferme pas l'application : 1 à 2 minutes.">
          <ListeEtapes etapes={etapes} />
          {erreur ? (
            <>
              <MessageErreur>{erreur}</MessageErreur>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEcran("cles")}>
                  Retour
                </Button>
                <Button onClick={() => void lancerInstallation(choixServices)}>Réessayer</Button>
              </div>
            </>
          ) : null}
        </Cadre>
      );

    case "fin":
      return (
        <Cadre titre="Hub XTIM est prêt" sousTitre="Ton serveur est installé et ton compte administrateur créé.">
          <div className="space-y-2 rounded-lg border p-4">
            <p className="font-medium">Code d'invitation pour Edwin</p>
            <p className="text-sm text-muted-foreground">
              Crée d'abord son compte dans Paramètres › Comptes et rôles, puis envoie-lui ce code : il le collera au
              premier lancement. Tu le retrouveras dans Paramètres.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={config ? codeInvitation(config) : ""}
                className="font-mono text-xs"
                aria-label="Code d'invitation"
              />
              <Button
                variant="outline"
                size="icon"
                aria-label="Copier le code"
                onClick={() =>
                  config && navigator.clipboard.writeText(codeInvitation(config)).then(() => toast.success("Copié"))
                }
              >
                <Copy />
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              onClick={() => {
                setOccupe("Ouverture…");
                terminer(config!, { email: admin.email.trim().toLowerCase(), motDePasse: admin.motDePasse });
              }}
              disabled={Boolean(occupe)}
            >
              {occupe ? <Loader2 className="animate-spin" aria-hidden /> : null}
              Ouvrir Hub XTIM
            </Button>
          </div>
        </Cadre>
      );
  }
}
