import { Archive, ArchiveRestore, ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/features/auth/AuthProvider";
import { useDomaines, useProjets } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { messageErreur } from "@/lib/supabase";
import { useEcrireReferentiel } from "../api";

function ChampNom({
  valeur,
  onValider,
  desactive,
}: {
  valeur: string;
  onValider: (v: string) => void;
  desactive?: boolean;
}) {
  const [v, setV] = useState(valeur);
  return (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => (v.trim() && v.trim() !== valeur ? onValider(v.trim()) : setV(valeur))}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      disabled={desactive}
      className="h-8 flex-1"
      aria-label="Nom"
    />
  );
}

export function SectionReferentiels() {
  const { estAdmin } = useAuth();
  const { peutEcrire } = useEcriture();
  const domaines = useDomaines();
  const projets = useProjets();
  const ecrireD = useEcrireReferentiel("domaines");
  const ecrireP = useEcrireReferentiel("projets");
  const [nouveauD, setNouveauD] = useState("");
  const [nouveauP, setNouveauP] = useState("");
  const erreur = (e: unknown) => toast.error(messageErreur(e));
  const listeD = domaines.data ?? [];

  function deplacer(i: number, delta: number) {
    const a = listeD[i];
    const b = listeD[i + delta];
    if (!a || !b) return;
    ecrireD.mutate({ type: "maj", id: a.id, valeurs: { ordre: b.ordre } }, { onError: erreur });
    ecrireD.mutate(
      { type: "maj", id: b.id, valeurs: { ordre: a.ordre === b.ordre ? a.ordre + delta : a.ordre } },
      { onError: erreur },
    );
  }

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <p className="font-medium">Domaines</p>
          <p className="text-sm text-muted-foreground">
            {estAdmin
              ? "Un domaine utilisé par des tâches ne peut pas être supprimé : renomme-le plutôt."
              : "Modifiables par l'administrateur."}
          </p>
        </div>
        <ul className="space-y-1.5">
          {listeD.map((d, i) => (
            <li key={d.id} className="flex items-center gap-2">
              <input
                type="color"
                value={d.couleur}
                onChange={(e) =>
                  ecrireD.mutate(
                    { type: "maj", id: d.id, valeurs: { couleur: e.target.value.toUpperCase() } },
                    { onError: erreur },
                  )
                }
                disabled={!estAdmin || !peutEcrire}
                aria-label={`Couleur de ${d.nom}`}
                className="h-8 w-9 cursor-pointer rounded border bg-transparent p-0.5"
              />
              <ChampNom
                valeur={d.nom}
                onValider={(nom) => ecrireD.mutate({ type: "maj", id: d.id, valeurs: { nom } }, { onError: erreur })}
                desactive={!estAdmin || !peutEcrire}
              />
              {estAdmin ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Monter"
                    onClick={() => deplacer(i, -1)}
                    disabled={i === 0 || !peutEcrire}
                  >
                    <ArrowUp />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Descendre"
                    onClick={() => deplacer(i, 1)}
                    disabled={i === listeD.length - 1 || !peutEcrire}
                  >
                    <ArrowDown />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label={`Supprimer ${d.nom}`}
                    disabled={!peutEcrire}
                    onClick={() =>
                      ecrireD.mutate(
                        { type: "supprimer", id: d.id },
                        { onSuccess: () => toast.success("Supprimé"), onError: erreur },
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {estAdmin ? (
          <div className="flex max-w-md gap-2">
            <Input
              value={nouveauD}
              onChange={(e) => setNouveauD(e.target.value)}
              placeholder="Nouveau domaine"
              className="h-8"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={!nouveauD.trim() || !peutEcrire}
              onClick={() =>
                ecrireD.mutate(
                  { type: "ajouter", valeurs: { nom: nouveauD.trim(), ordre: (listeD.at(-1)?.ordre ?? 0) + 1 } },
                  { onSuccess: () => (setNouveauD(""), toast.success("Ajouté")), onError: erreur },
                )
              }
            >
              <Plus aria-hidden /> Ajouter
            </Button>
          </div>
        ) : null}
      </div>

      <div className="space-y-3 border-t pt-6">
        <div>
          <p className="font-medium">Projets</p>
          <p className="text-sm text-muted-foreground">
            Un projet archivé reste consultable mais sort des vues par défaut et des alertes.
          </p>
        </div>
        <ul className="space-y-1.5">
          {(projets.data ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-2">
              <ChampNom
                valeur={p.nom}
                onValider={(nom) => ecrireP.mutate({ type: "maj", id: p.id, valeurs: { nom } }, { onError: erreur })}
                desactive={!peutEcrire}
              />
              <span className="w-16 text-sm text-muted-foreground">{p.statut === "archive" ? "Archivé" : "Actif"}</span>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={p.statut === "archive" ? "Désarchiver" : "Archiver"}
                disabled={!peutEcrire}
                onClick={() =>
                  ecrireP.mutate(
                    { type: "maj", id: p.id, valeurs: { statut: p.statut === "archive" ? "actif" : "archive" } },
                    {
                      onSuccess: () => toast.success(p.statut === "archive" ? "Désarchivé" : "Archivé"),
                      onError: erreur,
                    },
                  )
                }
              >
                {p.statut === "archive" ? <ArchiveRestore /> : <Archive />}
              </Button>
              {estAdmin ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-8"
                  aria-label={`Supprimer ${p.nom}`}
                  disabled={!peutEcrire}
                  onClick={() =>
                    ecrireP.mutate(
                      { type: "supprimer", id: p.id },
                      { onSuccess: () => toast.success("Supprimé"), onError: erreur },
                    )
                  }
                >
                  <Trash2 />
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex max-w-md gap-2">
          <Input
            value={nouveauP}
            onChange={(e) => setNouveauP(e.target.value)}
            placeholder="Nouveau projet"
            className="h-8"
          />
          <Button
            size="sm"
            variant="outline"
            disabled={!nouveauP.trim() || !peutEcrire}
            onClick={() =>
              ecrireP.mutate(
                { type: "ajouter", valeurs: { nom: nouveauP.trim() } },
                { onSuccess: () => (setNouveauP(""), toast.success("Ajouté")), onError: erreur },
              )
            }
          >
            <Plus aria-hidden /> Ajouter
          </Button>
        </div>
      </div>
    </div>
  );
}
