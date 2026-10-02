import { extraireMentions, mentionEnCours, segmenterMentions, type Personne } from "@shared/mentions";
import { useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { ilYa } from "@/lib/format";
import type { Commentaire } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useCommentaires, useEcrireCommentaire } from "./apiDetail";

const prenom = (nom: string) => nom.split(/\s+/)[0];

/** Zone de saisie avec autocomplétion des @mentions (flèches, Entrée ou Tab pour choisir). */
function SaisieCommentaire({
  personnes,
  valeurInitiale = "",
  libelle,
  onEnvoyer,
  onAnnuler,
}: {
  personnes: Personne[];
  valeurInitiale?: string;
  libelle: string;
  onEnvoyer: (texte: string) => void;
  onAnnuler?: () => void;
}) {
  const { peutEcrire } = useEcriture();
  const [texte, setTexte] = useState(valeurInitiale);
  const [curseur, setCurseur] = useState(0);
  const [choix, setChoix] = useState(0);
  const zone = useRef<HTMLTextAreaElement>(null);

  const enCours = mentionEnCours(texte, curseur);
  const suggestions = enCours
    ? personnes.filter((p) =>
        prenom(p.nom)
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .toLowerCase()
          .startsWith(enCours.recherche.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()),
      )
    : [];

  function inserer(p: Personne) {
    if (!enCours) return;
    const avant = texte.slice(0, enCours.debut) + `@${prenom(p.nom)} `;
    const suite = avant + texte.slice(curseur);
    setTexte(suite);
    setCurseur(avant.length);
    requestAnimationFrame(() => {
      zone.current?.focus();
      zone.current?.setSelectionRange(avant.length, avant.length);
    });
  }

  function envoyer() {
    if (!texte.trim()) return;
    onEnvoyer(texte.trim());
    setTexte("");
  }

  function touche(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (suggestions.length) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setChoix((c) => (c + (e.key === "ArrowDown" ? 1 : -1) + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        inserer(suggestions[Math.min(choix, suggestions.length - 1)]);
        return;
      }
    }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      envoyer();
    }
    if (e.key === "Escape" && onAnnuler) {
      e.stopPropagation();
      onAnnuler();
    }
  }

  return (
    <div className="relative space-y-1.5">
      <Textarea
        ref={zone}
        value={texte}
        onChange={(e) => {
          setTexte(e.target.value);
          setCurseur(e.target.selectionStart);
          setChoix(0);
        }}
        onSelect={(e) => setCurseur((e.target as HTMLTextAreaElement).selectionStart)}
        onKeyDown={touche}
        rows={2}
        placeholder="Écrire un commentaire… (@ pour mentionner)"
        aria-label={libelle}
        disabled={!peutEcrire}
      />
      {suggestions.length ? (
        <ul
          role="listbox"
          aria-label="Membres à mentionner"
          className="absolute left-2 top-full z-10 mt-1 w-48 rounded-md border bg-popover p-1 text-sm"
        >
          {suggestions.map((p, i) => (
            <li
              key={p.user_id}
              role="option"
              aria-selected={i === choix}
              className={cn("cursor-pointer rounded px-2 py-1", i === choix && "bg-accent")}
              onMouseDown={(e) => {
                e.preventDefault();
                inserer(p);
              }}
            >
              {p.nom}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex justify-end gap-2">
        {onAnnuler ? (
          <Button variant="ghost" size="sm" onClick={onAnnuler}>
            Annuler
          </Button>
        ) : null}
        <Button size="sm" variant="outline" onClick={envoyer} disabled={!texte.trim() || !peutEcrire}>
          {onAnnuler ? "Enregistrer" : "Commenter"}
        </Button>
      </div>
    </div>
  );
}

function Message({ c, personnes }: { c: Commentaire; personnes: Personne[] }) {
  const { userId } = useAuth();
  const r = useReferentiels();
  const ecrire = useEcrireCommentaire();
  const [edition, setEdition] = useState(false);
  const moi = c.auteur === userId;

  return (
    <li className="space-y-1">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{r.nomMembre(c.auteur)}</span> · {ilYa(c.created_at)}
        {c.modifie_at ? " · modifié" : ""}
      </p>
      {edition ? (
        <SaisieCommentaire
          personnes={personnes}
          valeurInitiale={c.contenu}
          libelle="Modifier le commentaire"
          onAnnuler={() => setEdition(false)}
          onEnvoyer={(texte) => {
            ecrire.mutate({
              type: "modifier",
              id: c.id,
              contenu: texte,
              mentions: extraireMentions(texte, personnes).filter((id) => id !== userId),
            });
            setEdition(false);
          }}
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-sm">
          {segmenterMentions(c.contenu, personnes).map((s, i) =>
            s.userId ? (
              <span key={i} className="font-medium text-primary">
                {s.texte}
              </span>
            ) : (
              <span key={i}>{s.texte}</span>
            ),
          )}
        </p>
      )}
      {moi && !edition ? (
        <div className="flex gap-3 text-xs text-muted-foreground">
          <button type="button" className="hover:text-foreground" onClick={() => setEdition(true)}>
            Modifier
          </button>
          <button
            type="button"
            className="hover:text-foreground"
            onClick={() => ecrire.mutate({ type: "supprimer", id: c.id })}
          >
            Supprimer
          </button>
        </div>
      ) : null}
    </li>
  );
}

/** Fil de discussion d'une tâche ; une @mention prévient la personne citée. */
export function Commentaires({ tacheId }: { tacheId: string }) {
  const { userId } = useAuth();
  const r = useReferentiels();
  const { parTache } = useCommentaires();
  const ecrire = useEcrireCommentaire();
  const liste = parTache.get(tacheId) ?? [];
  const personnes: Personne[] = r.listeMembres.map((m) => ({ user_id: m.user_id, nom: m.nom }));

  return (
    <div className="space-y-2">
      <Label>Commentaires{liste.length ? ` (${liste.length})` : ""}</Label>
      {liste.length ? (
        <ul className="space-y-3">
          {liste.map((c) => (
            <Message key={c.id} c={c} personnes={personnes} />
          ))}
        </ul>
      ) : null}
      <SaisieCommentaire
        personnes={personnes.filter((p) => p.user_id !== userId)}
        libelle="Nouveau commentaire"
        onEnvoyer={(texte) =>
          ecrire.mutate({
            type: "creer",
            tache_id: tacheId,
            contenu: texte,
            mentions: extraireMentions(texte, personnes).filter((id) => id !== userId),
          })
        }
      />
    </div>
  );
}
