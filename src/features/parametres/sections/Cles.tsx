import { Check, Copy, ExternalLink, Loader2, LogOut, RefreshCw, X } from "lucide-react";
import { fournisseur } from "@shared/ia";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/features/auth/AuthProvider";
import { DialogueMiseAJourServeur } from "@/features/installation/DialogueMiseAJourServeur";
import { useEtatConfiguration, useVersionServeur } from "@/features/installation/etat";
import { useEcriture } from "@/hooks/useEcriture";
import { codeInvitation, configViaBuild, enregistrerConfigServeur, lireConfigServeur } from "@/lib/config";
import { appelerFonction } from "@/lib/fonctions";
import { queryClient } from "@/lib/queryClient";
import { messageErreur, supabase, urlServeur } from "@/lib/supabase";
import { ouvrirUrl } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import { useMajParametres, useParametres } from "../api";
import { ChoixIa, problemeIa, type ValeurIa } from "../ChoixIa";

const LIEN_GUIDE_AZURE =
  "https://github.com/lucasbegellb-design/hubx/blob/main/SETUP.md#3-connecter-le-fichier-excel-dedwin-application-azure";

function Statut({ ok, oui, non }: { ok: boolean | undefined; oui: string; non: string }) {
  if (ok === undefined) return <span className="text-sm text-muted-foreground">…</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", ok ? "text-fait" : "text-retard")}>
      {ok ? <Check className="size-4" aria-hidden /> : <X className="size-4" aria-hidden />}
      {ok ? oui : non}
    </span>
  );
}

function Bloc({ titre, statut, children }: { titre: string; statut: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center gap-3">
        <p className="flex-1 font-medium">{titre}</p>
        {statut}
      </div>
      {children}
    </section>
  );
}

async function enregistrer(valeurs: Record<string, string>) {
  for (const [nom, valeur] of Object.entries(valeurs)) {
    const { error } = await supabase.rpc("definir_secret", { p_nom: nom, p_valeur: valeur.trim() });
    if (error) throw new Error(messageErreur(error));
  }
  await queryClient.invalidateQueries({ queryKey: ["parametres", "configuration"] });
}

export function SectionCles() {
  const { estAdmin } = useAuth();
  const { peutEcrire } = useEcriture();
  const etat = useEtatConfiguration();
  const version = useVersionServeur();
  const p = useParametres();
  const majParametres = useMajParametres();
  const [ia, setIa] = useState<ValeurIa | null>(null);
  const [azure, setAzure] = useState({ tenant: "", client: "", secret: "" });
  const [resultat, setResultat] = useState<Record<string, { ok: boolean; message: string }>>({});
  const [occupe, setOccupe] = useState<string | null>(null);
  const [maj, setMaj] = useState(false);
  const config = lireConfigServeur();
  const e = etat.data;

  useEffect(() => {
    if (p.data && !ia)
      setIa({
        fournisseur: fournisseur(p.data.ia_fournisseur).id,
        modele: p.data.modele_ia,
        url: p.data.ia_url ?? "",
        cle: "",
      });
  }, [p.data, ia]);
  const changementFournisseur = Boolean(ia && p.data && ia.fournisseur !== p.data.ia_fournisseur);
  const reglagesIaModifies = Boolean(
    ia &&
    p.data &&
    (changementFournisseur ||
      ia.modele.trim() !== p.data.modele_ia ||
      (ia.fournisseur === "autre" && ia.url.trim() !== (p.data.ia_url ?? ""))),
  );

  async function enregistrerIa() {
    if (!ia || !p.data) return;
    const probleme = problemeIa(ia);
    if (probleme) return { ok: false, message: probleme };
    if (reglagesIaModifies)
      await majParametres.mutateAsync({
        id: p.data.id,
        ia_fournisseur: ia.fournisseur,
        modele_ia: ia.modele.trim(),
        ia_url: ia.fournisseur === "autre" ? ia.url.trim() : null,
      });
    if (ia.cle.trim()) await enregistrer({ ia_api_key: ia.cle });
    else await queryClient.invalidateQueries({ queryKey: ["parametres", "configuration"] });
    setIa({ ...ia, cle: "" });
    if (!ia.cle.trim() && !e?.ia) return { ok: true, message: "Réglages enregistrés. Il reste à coller la clé API." };
    const r = await appelerFonction<{ ok: boolean; erreur?: string; modele?: string; fournisseur?: string }>(
      "configuration",
      { action: "tester_ia" },
    );
    return {
      ok: r.ok,
      message: r.ok
        ? `Enregistré et vérifié : ${r.fournisseur} répond (modèle ${r.modele}).`
        : `Enregistré, mais le test échoue : ${r.erreur}`,
    };
  }

  async function action(id: string, fn: () => Promise<{ ok: boolean; message: string } | void>) {
    setOccupe(id);
    setResultat(({ [id]: _ancien, ...autres }) => autres);
    try {
      const r = await fn();
      if (r) setResultat((x) => ({ ...x, [id]: r }));
    } catch (err) {
      setResultat((x) => ({ ...x, [id]: { ok: false, message: (err as Error).message } }));
    } finally {
      setOccupe(null);
    }
  }

  const tester = (quoi: "tester_ia" | "tester_azure", id: string) =>
    action(id, async () => {
      const r = await appelerFonction<{ ok: boolean; erreur?: string; modele?: string; fournisseur?: string }>(
        "configuration",
        { action: quoi },
      );
      return {
        ok: r.ok,
        message: r.ok
          ? quoi === "tester_ia"
            ? `Connexion réussie : ${r.fournisseur} répond (modèle ${r.modele}).`
            : "Connexion à Microsoft réussie."
          : (r.erreur ?? "Échec du test."),
      };
    });

  const Resultat = ({ id }: { id: string }) =>
    resultat[id] ? (
      resultat[id].ok ? (
        <p className="text-sm text-fait">{resultat[id].message}</p>
      ) : (
        <MessageErreur>{resultat[id].message}</MessageErreur>
      )
    ) : null;

  return (
    <div className="space-y-4">
      {etat.error ? (
        <MessageErreur>
          État des clés indisponible : {(etat.error as Error).message}
          {estAdmin ? " Si le serveur vient d'être mis à jour, utilise « Mettre à jour le serveur »." : ""}
        </MessageErreur>
      ) : null}

      <Bloc
        titre="Serveur"
        statut={
          <Statut ok={version.data ? !version.data.enRetard : undefined} oui="À jour" non="Mise à jour requise" />
        }
      >
        <p className="text-sm text-muted-foreground">
          {urlServeur.replace(/^https?:\/\//, "")} · version du serveur {version.data?.serveur ?? "inconnue"} · attendue{" "}
          {version.data?.app}
        </p>
        {estAdmin ? (
          <Button
            variant={version.data?.enRetard ? "default" : "outline"}
            size="sm"
            onClick={() => setMaj(true)}
            disabled={!peutEcrire}
          >
            <RefreshCw aria-hidden /> Mettre à jour le serveur
          </Button>
        ) : version.data?.enRetard ? (
          <p className="text-sm text-retard">
            Préviens l'administrateur : le serveur doit être mis à jour pour cette version.
          </p>
        ) : null}
      </Bloc>

      <Bloc titre="Intelligence artificielle" statut={<Statut ok={e?.ia} oui="Clé enregistrée" non="Aucune clé" />}>
        <p className="text-sm text-muted-foreground">
          Analyse des documents, structuration des process, synthèse des rapports. Les appels partent du serveur : la
          clé n'est jamais relisible depuis l'application.
        </p>
        {estAdmin && ia && p.data ? (
          <>
            <ChoixIa valeur={ia} onChange={setIa} cleEnregistree={Boolean(e?.ia)} desactive={Boolean(occupe)} />
            {changementFournisseur && !ia.cle.trim() ? (
              <p className="text-sm text-muted-foreground">
                Colle la clé {fournisseur(ia.fournisseur).nom} pour changer de fournisseur.
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={
                  !peutEcrire ||
                  Boolean(occupe) ||
                  (!reglagesIaModifies && !ia.cle.trim()) ||
                  (changementFournisseur && !ia.cle.trim())
                }
                onClick={() => action("ia", enregistrerIa)}
              >
                {occupe === "ia" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Enregistrer
              </Button>
              <Button variant="ghost" onClick={() => tester("tester_ia", "ia")} disabled={!e?.ia || Boolean(occupe)}>
                Tester
              </Button>
            </div>
          </>
        ) : p.data ? (
          <p className="text-sm">
            {fournisseur(p.data.ia_fournisseur).nom} · <span className="font-mono">{p.data.modele_ia}</span>
          </p>
        ) : null}
        <Resultat id="ia" />
      </Bloc>

      <Bloc
        titre="Fichier Excel d'Edwin (Microsoft 365)"
        statut={<Statut ok={e?.azure} oui="Identifiants enregistrés" non="Mode démo" />}
      >
        <p className="text-sm text-muted-foreground">
          Lecture seule du suivi Chine sur OneDrive (application Azure avec la permission Files.Read.All).{" "}
          <button
            type="button"
            className="inline-flex items-center gap-1 text-primary hover:underline"
            onClick={() => ouvrirUrl(LIEN_GUIDE_AZURE)}
          >
            Guide pas à pas <ExternalLink className="size-3.5" aria-hidden />
          </button>{" "}
          Le lien du fichier et le mapping se règlent dans la section Suivi Chine.
        </p>
        {estAdmin ? (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input
                value={azure.tenant}
                onChange={(x) => setAzure({ ...azure, tenant: x.target.value })}
                placeholder="ID de l'annuaire"
                aria-label="ID de l'annuaire (tenant)"
                className="font-mono text-sm"
              />
              <Input
                value={azure.client}
                onChange={(x) => setAzure({ ...azure, client: x.target.value })}
                placeholder="ID d'application"
                aria-label="ID d'application (client)"
                className="font-mono text-sm"
              />
              <Input
                type="password"
                value={azure.secret}
                onChange={(x) => setAzure({ ...azure, secret: x.target.value })}
                placeholder="Secret client"
                aria-label="Secret client"
                className="font-mono text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={
                  !azure.tenant.trim() || !azure.client.trim() || !azure.secret.trim() || Boolean(occupe) || !peutEcrire
                }
                onClick={() =>
                  action("azure", async () => {
                    await enregistrer({
                      azure_tenant_id: azure.tenant,
                      azure_client_id: azure.client,
                      azure_client_secret: azure.secret,
                    });
                    setAzure({ tenant: "", client: "", secret: "" });
                    const r = await appelerFonction<{ ok: boolean; erreur?: string }>("configuration", {
                      action: "tester_azure",
                    });
                    return {
                      ok: r.ok,
                      message: r.ok
                        ? "Identifiants enregistrés et vérifiés : le fichier sera lu à la prochaine synchronisation."
                        : `Identifiants enregistrés mais le test échoue : ${r.erreur}`,
                    };
                  })
                }
              >
                {occupe === "azure" ? <Loader2 className="animate-spin" aria-hidden /> : null}
                Enregistrer
              </Button>
              <Button
                variant="ghost"
                onClick={() => tester("tester_azure", "azure")}
                disabled={!e?.azure || Boolean(occupe)}
              >
                Tester
              </Button>
            </div>
          </>
        ) : null}
        <Resultat id="azure" />
      </Bloc>

      <Bloc
        titre="Tâches automatiques"
        statut={<Statut ok={e ? e.url && e.cron : undefined} oui="Actives" non="À réparer" />}
      >
        <p className="text-sm text-muted-foreground">
          Synchronisation du fichier Chine toutes les 15 minutes, rapports du vendredi et de fin de mois.
        </p>
        {estAdmin && e && !(e.url && e.cron) ? (
          <Button
            variant="outline"
            size="sm"
            disabled={Boolean(occupe)}
            onClick={() =>
              action("cron", async () => {
                await enregistrer({ url: urlServeur });
                return { ok: true, message: "Tâches automatiques réactivées." };
              })
            }
          >
            Réparer
          </Button>
        ) : null}
        <Resultat id="cron" />
      </Bloc>

      {config ? (
        <Bloc titre="Inviter un collègue" statut={null}>
          <p className="text-sm text-muted-foreground">
            Crée son compte dans Comptes et rôles, puis envoie-lui ce code : il le collera au premier lancement de
            l'application.
          </p>
          <div className="flex gap-2">
            <Input
              readOnly
              value={codeInvitation(config)}
              className="font-mono text-xs"
              aria-label="Code d'invitation"
            />
            <Button
              variant="outline"
              size="icon"
              aria-label="Copier le code"
              onClick={() => navigator.clipboard.writeText(codeInvitation(config)).then(() => toast.success("Copié"))}
            >
              <Copy />
            </Button>
          </div>
        </Bloc>
      ) : null}

      {!configViaBuild() ? (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              <LogOut aria-hidden /> Changer de serveur
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 space-y-2">
            <p className="text-sm">
              Oublier ce serveur sur ce poste ? Les données restent sur le serveur ; l'assistant de configuration se
              relancera.
            </p>
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await supabase.auth.signOut();
                enregistrerConfigServeur(null);
                location.reload();
              }}
            >
              Oublier ce serveur
            </Button>
          </PopoverContent>
        </Popover>
      ) : null}

      <DialogueMiseAJourServeur ouvert={maj} onOuvert={setMaj} />
    </div>
  );
}
