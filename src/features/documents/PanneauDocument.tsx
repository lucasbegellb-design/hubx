import { Download, ExternalLink, Loader2, Pin, PinOff, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReferentiels } from "@/features/referentiels/api";
import { useCreerTache } from "@/features/taches/api";
import { useEcriture } from "@/hooks/useEcriture";
import { useRaccourci } from "@/hooks/useRaccourci";
import { dateCourte, dateHeure, taille } from "@/lib/format";
import { enregistrerFichier, ouvrirUrl } from "@/lib/tauri";
import type { DocumentXtim } from "@/lib/types";
import { lancerAnalyse, telecharger, urlSignee, useMajDocument, type InfoCle, type TacheSuggeree } from "./api";

const AUCUN = "__aucun__";

function Action({
  libelle,
  onClick,
  children,
  disabled,
}: {
  libelle: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={libelle} onClick={onClick} disabled={disabled}>
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{libelle}</TooltipContent>
    </Tooltip>
  );
}

export function PanneauDocument({ doc, onFermer }: { doc: DocumentXtim; onFermer: () => void }) {
  const { userId } = useAuth();
  const r = useReferentiels();
  const maj = useMajDocument();
  const creerTache = useCreerTache();
  const { peutEcrire, verifier } = useEcriture();
  const [nom, setNom] = useState(doc.nom);
  const [categorie, setCategorie] = useState(doc.categorie ?? "");
  const [relance, setRelance] = useState(false);
  useRaccourci("Escape", onFermer);

  useEffect(() => setNom(doc.nom), [doc.nom]);
  useEffect(() => setCategorie(doc.categorie ?? ""), [doc.categorie]);

  const infos = (Array.isArray(doc.infos_cles) ? doc.infos_cles : []) as unknown as InfoCle[];
  const suggestions = (Array.isArray(doc.taches_suggerees) ? doc.taches_suggerees : []) as unknown as TacheSuggeree[];

  async function ouvrir() {
    try {
      await ouvrirUrl(await urlSignee(doc.storage_path));
    } catch {
      toast.error("Ouverture impossible. Vérifie ta connexion puis réessaie.");
    }
  }

  async function sauvegarder() {
    try {
      const chemin = await enregistrerFichier(doc.nom, await telecharger(doc.storage_path));
      if (chemin) toast.success("Téléchargé");
    } catch {
      toast.error("Téléchargement impossible. Vérifie ta connexion puis réessaie.");
    }
  }

  async function relancer() {
    if (!verifier()) return;
    setRelance(true);
    await maj.mutateAsync({ id: doc.id, analyse_statut: "en_attente", analyse_message: null });
    try {
      const r = await lancerAnalyse(doc.id);
      if (r.ok) toast.success("Analyse terminée");
      else toast.error(r.erreur ?? "Analyse impossible.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRelance(false);
    }
  }

  async function ajouterTache(i: number) {
    if (!verifier()) return;
    const s = suggestions[i];
    await creerTache.mutateAsync({
      titre: s.titre.slice(0, 300),
      echeance: s.echeance,
      notes: `Issue du document « ${doc.nom} »`,
      domaine_id: doc.domaine_id ?? r.listeDomaines[0]?.id ?? null,
      projet_id: doc.projet_id,
      assigne_a: userId,
    });
    const liste = suggestions.map((x, j) => (j === i ? { ...x, ajoutee: true } : x));
    maj.mutate({ id: doc.id, taches_suggerees: liste as unknown as DocumentXtim["taches_suggerees"] });
    toast.success("Tâche ajoutée");
  }

  return (
    <aside
      aria-label="Détail du document"
      className="flex w-[420px] shrink-0 animate-slide-in-right flex-col border-l bg-card"
    >
      <div className="flex h-12 items-center gap-0.5 border-b px-3">
        <p className="flex-1 text-sm text-muted-foreground">Document</p>
        <Action libelle="Ouvrir" onClick={ouvrir}>
          <ExternalLink />
        </Action>
        <Action libelle="Télécharger" onClick={sauvegarder}>
          <Download />
        </Action>
        <Action
          libelle={doc.epingle ? "Désépingler" : "Épingler"}
          onClick={() => maj.mutate({ id: doc.id, epingle: !doc.epingle })}
          disabled={!peutEcrire}
        >
          {doc.epingle ? <PinOff /> : <Pin />}
        </Action>
        <Action
          libelle="Supprimer"
          disabled={!peutEcrire}
          onClick={() => {
            maj.mutate(
              { id: doc.id, deleted_at: new Date().toISOString() },
              {
                onSuccess: () =>
                  toast.success("Supprimé", {
                    action: { label: "Annuler", onClick: () => maj.mutate({ id: doc.id, deleted_at: null }) },
                  }),
              },
            );
            onFermer();
          }}
        >
          <Trash2 />
        </Action>
        <Action libelle="Fermer (Échap)" onClick={onFermer}>
          <X />
        </Action>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
        <Input
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          onBlur={() => nom.trim() && nom.trim() !== doc.nom && maj.mutate({ id: doc.id, nom: nom.trim() })}
          aria-label="Nom du document"
          disabled={!peutEcrire}
          className="border-transparent bg-transparent px-1 text-lg font-medium hover:border-input focus-visible:border-input"
        />
        <p className="px-1 text-sm text-muted-foreground">
          {taille(doc.taille)} · ajouté le {dateHeure(doc.created_at)} par {r.nomMembre(doc.ajoute_par) || "—"}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Domaine</Label>
            <Select
              value={doc.domaine_id ?? AUCUN}
              onValueChange={(v) => maj.mutate({ id: doc.id, domaine_id: v === AUCUN ? null : v })}
              disabled={!peutEcrire}
            >
              <SelectTrigger aria-label="Domaine">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Sans domaine</SelectItem>
                {r.listeDomaines.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Projet</Label>
            <Select
              value={doc.projet_id ?? AUCUN}
              onValueChange={(v) => maj.mutate({ id: doc.id, projet_id: v === AUCUN ? null : v })}
              disabled={!peutEcrire}
            >
              <SelectTrigger aria-label="Projet">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={AUCUN}>Aucun projet</SelectItem>
                {r.listeProjets.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="categorie">Catégorie</Label>
          <Input
            id="categorie"
            value={categorie}
            onChange={(e) => setCategorie(e.target.value)}
            onBlur={() =>
              categorie.trim() !== (doc.categorie ?? "") &&
              maj.mutate({ id: doc.id, categorie: categorie.trim() || null })
            }
            placeholder="Facture, contrat, fiche technique…"
            disabled={!peutEcrire}
          />
        </div>

        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-sm font-semibold text-muted-foreground">Analyse IA</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={relancer}
              disabled={relance || !peutEcrire || doc.analyse_statut === "en_attente"}
            >
              <RefreshCw aria-hidden className={relance ? "animate-spin" : undefined} />
              Relancer l'analyse
            </Button>
          </div>
          {doc.analyse_statut === "en_attente" ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Analyse en cours…
            </p>
          ) : doc.analyse_statut === "erreur" ? (
            <MessageErreur>{doc.analyse_message ?? "L'analyse a échoué. Relance-la dans un instant."}</MessageErreur>
          ) : (
            <>
              {doc.resume ? <p className="leading-6">{doc.resume}</p> : null}
              {infos.length ? (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
                  {infos.map((i, k) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{i.libelle}</dt>
                      <dd className="tabular">{i.valeur}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </>
          )}
        </div>

        {suggestions.length ? (
          <div className="space-y-2 border-t pt-4">
            <p className="text-sm font-semibold text-muted-foreground">Tâches suggérées</p>
            <ul className="space-y-1">
              {suggestions.map((s, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md px-1 py-1">
                  <span className="min-w-0 flex-1">
                    {s.titre}
                    {s.echeance ? (
                      <span className="ml-1.5 text-sm text-muted-foreground">· {dateCourte(s.echeance)}</span>
                    ) : null}
                  </span>
                  {s.ajoutee ? (
                    <span className="text-sm text-fait">Ajoutée</span>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => ajouterTache(i)} disabled={!peutEcrire}>
                      <Plus aria-hidden /> Ajouter
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}
