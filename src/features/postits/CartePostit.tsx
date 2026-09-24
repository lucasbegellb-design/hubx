import { addDays, format, nextMonday, set as setDate } from "date-fns";
import { Archive, ArchiveRestore, Bell, BellOff, ListTodo, Palette, Pin, PinOff, Trash2, Users } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReferentiels } from "@/features/referentiels/api";
import { useCreerTache } from "@/features/taches/api";
import { useEcriture } from "@/hooks/useEcriture";
import { dateHeure } from "@/lib/format";
import type { CouleurPostit, Postit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useMajPostit, useSupprimerPostit } from "./api";

export const COULEURS: { valeur: CouleurPostit; libelle: string; classe: string }[] = [
  { valeur: "sable", libelle: "Sable", classe: "bg-postit-sable" },
  { valeur: "sauge", libelle: "Sauge", classe: "bg-postit-sauge" },
  { valeur: "ciel", libelle: "Ciel", classe: "bg-postit-ciel" },
  { valeur: "lavande", libelle: "Lavande", classe: "bg-postit-lavande" },
];

export const classeCouleur = (c: string) => COULEURS.find((x) => x.valeur === c)?.classe ?? "bg-postit-sable";

const versLocal = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm");

export function ChoixRappel({ valeur, onChange }: { valeur: string | null; onChange: (iso: string | null) => void }) {
  const maintenant = new Date();
  const neufHeures = (d: Date) => setDate(d, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
  const raccourcis: [string, Date][] = [
    ["Dans 1 heure", new Date(maintenant.getTime() + 3_600_000)],
    ["Demain 9 h", neufHeures(addDays(maintenant, 1))],
    ["Lundi 9 h", neufHeures(nextMonday(maintenant))],
  ];
  return (
    <div className="space-y-2">
      <Input
        type="datetime-local"
        aria-label="Date et heure du rappel"
        value={valeur ? versLocal(valeur) : ""}
        onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
        className="tabular"
      />
      <div className="flex flex-wrap gap-1">
        {raccourcis.map(([l, d]) => (
          <Button key={l} variant="outline" size="sm" onClick={() => onChange(d.toISOString())}>
            {l}
          </Button>
        ))}
        {valeur ? (
          <Button variant="ghost" size="sm" onClick={() => onChange(null)}>
            Retirer
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Action({
  libelle,
  onClick,
  children,
  disabled,
}: {
  libelle: string;
  onClick?: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 hover:bg-black/5 dark:hover:bg-white/10"
          aria-label={libelle}
          onClick={onClick}
          disabled={disabled}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{libelle}</TooltipContent>
    </Tooltip>
  );
}

export function CartePostit({ postit: p, miseEnAvant }: { postit: Postit; miseEnAvant?: boolean }) {
  const { userId } = useAuth();
  const r = useReferentiels();
  const maj = useMajPostit();
  const supprimer = useSupprimerPostit();
  const creerTache = useCreerTache();
  const naviguer = useNavigate();
  const { peutEcrire, verifier } = useEcriture();
  const [edition, setEdition] = useState(false);
  const [texte, setTexte] = useState(p.contenu);
  const proprio = p.proprietaire === userId;
  const archive = Boolean(p.archived_at);
  const rappelPasse = p.rappel_at && new Date(p.rappel_at) < new Date();

  useEffect(() => {
    if (!edition) setTexte(p.contenu);
  }, [p.contenu, edition]);

  function enregistrer() {
    setEdition(false);
    const v = texte.trim();
    if (!v) return setTexte(p.contenu);
    if (v !== p.contenu) maj.mutate({ id: p.id, contenu: v });
  }

  async function convertir() {
    if (!verifier()) return;
    const [premiere, ...reste] = p.contenu.split("\n");
    const t = await creerTache.mutateAsync({
      titre: premiere.slice(0, 300) || "Tâche issue d'un post-it",
      notes: reste.join("\n").trim(),
      domaine_id: r.listeDomaines[0]?.id ?? null,
      assigne_a: userId,
    });
    maj.mutate({ id: p.id, archived_at: new Date().toISOString() });
    toast.success("Converti en tâche", { action: { label: "Ouvrir", onClick: () => naviguer(`/taches?t=${t.id}`) } });
  }

  return (
    <article
      className={cn(
        "group flex min-h-32 flex-col rounded-lg border border-black/5 p-3 dark:border-white/5",
        classeCouleur(p.couleur),
        archive && "opacity-70",
        miseEnAvant && "ring-2 ring-primary",
      )}
    >
      <div className="flex-1">
        {edition ? (
          <Textarea
            autoFocus
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            onBlur={enregistrer}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enregistrer();
              if (e.key === "Escape") {
                setTexte(p.contenu);
                setEdition(false);
              }
            }}
            className="min-h-24 resize-none border-black/10 bg-white/50 dark:bg-black/20"
            aria-label="Contenu du post-it"
          />
        ) : (
          <button
            type="button"
            onClick={() => peutEcrire && !archive && setEdition(true)}
            className="w-full whitespace-pre-wrap break-words rounded text-left leading-6"
            aria-label="Modifier le post-it"
          >
            {p.epingle ? (
              <Pin className="float-right ml-2 size-3.5 text-foreground/75" aria-label="Épinglé" />
            ) : null}
            {p.contenu}
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-foreground/75">
        {p.rappel_at ? (
          <span className={cn("inline-flex items-center gap-1", rappelPasse && !p.rappel_envoye && "text-retard")}>
            <Bell className="size-3" aria-hidden />
            {dateHeure(p.rappel_at)}
          </span>
        ) : null}
        {p.partage ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-3" aria-hidden />
            {proprio ? "Partagé" : r.nomMembre(p.proprietaire)}
          </span>
        ) : null}
      </div>

      <div className="-mb-1 mt-1 flex items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        {archive ? (
          <Action
            libelle="Désarchiver"
            onClick={() =>
              maj.mutate({ id: p.id, archived_at: null }, { onSuccess: () => toast.success("Désarchivé") })
            }
            disabled={!peutEcrire}
          >
            <ArchiveRestore />
          </Action>
        ) : (
          <>
            <Action
              libelle={p.epingle ? "Désépingler" : "Épingler"}
              onClick={() => maj.mutate({ id: p.id, epingle: !p.epingle })}
              disabled={!peutEcrire}
            >
              {p.epingle ? <PinOff /> : <Pin />}
            </Action>
            <Popover>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 hover:bg-black/5 dark:hover:bg-white/10"
                      aria-label="Rappel"
                      disabled={!peutEcrire}
                    >
                      {p.rappel_at ? <BellOff /> : <Bell />}
                    </Button>
                  </PopoverTrigger>
                </TooltipTrigger>
                <TooltipContent>Rappel</TooltipContent>
              </Tooltip>
              <PopoverContent className="w-72">
                <p className="mb-2 text-sm font-medium">Me le rappeler</p>
                <ChoixRappel
                  valeur={p.rappel_at}
                  onChange={(iso) =>
                    maj.mutate(
                      { id: p.id, rappel_at: iso },
                      { onSuccess: () => toast.success(iso ? "Rappel programmé" : "Rappel retiré") },
                    )
                  }
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 hover:bg-black/5 dark:hover:bg-white/10"
                  aria-label="Couleur"
                  disabled={!peutEcrire}
                >
                  <Palette />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="flex w-auto gap-1.5 p-2">
                {COULEURS.map((c) => (
                  <button
                    key={c.valeur}
                    type="button"
                    aria-label={c.libelle}
                    onClick={() => maj.mutate({ id: p.id, couleur: c.valeur })}
                    className={cn(
                      "size-7 rounded-md border",
                      c.classe,
                      p.couleur === c.valeur && "ring-2 ring-primary",
                    )}
                  />
                ))}
              </PopoverContent>
            </Popover>
            {proprio ? (
              <Action
                libelle={p.partage ? "Rendre privé" : "Partager avec l'équipe"}
                onClick={() =>
                  maj.mutate(
                    { id: p.id, partage: !p.partage },
                    { onSuccess: () => toast.success(p.partage ? "Rendu privé" : "Partagé") },
                  )
                }
                disabled={!peutEcrire}
              >
                <Users />
              </Action>
            ) : null}
            <Action libelle="Convertir en tâche" onClick={convertir} disabled={!peutEcrire}>
              <ListTodo />
            </Action>
            <Action
              libelle="Archiver"
              onClick={() =>
                maj.mutate(
                  { id: p.id, archived_at: new Date().toISOString() },
                  {
                    onSuccess: () =>
                      toast.success("Archivé", {
                        action: { label: "Annuler", onClick: () => maj.mutate({ id: p.id, archived_at: null }) },
                      }),
                  },
                )
              }
              disabled={!peutEcrire}
            >
              <Archive />
            </Action>
          </>
        )}
        <div className="flex-1" />
        {proprio && archive ? (
          <Action libelle="Supprimer définitivement" onClick={() => supprimer.mutate(p.id)} disabled={!peutEcrire}>
            <Trash2 />
          </Action>
        ) : null}
      </div>
    </article>
  );
}
