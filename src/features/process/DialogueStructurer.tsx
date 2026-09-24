import type { JSONContent } from "@tiptap/core";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useBrouillon } from "@/stores/ui";
import { structurerBrouillon } from "./api";
import { ApercuContenu } from "./Editeur";
import { docDepuisSections, type SectionsStructurees } from "./modele";

/** « Structurer un brouillon » : texte en vrac → modèle XTIM, validé avant enregistrement. */
export function DialogueStructurer({
  ouvert,
  onOuvert,
  processId,
  revision,
  onValider,
}: {
  ouvert: boolean;
  onOuvert: (v: boolean) => void;
  processId: string;
  revision: string;
  onValider: (doc: JSONContent, titreSuggere: string) => void;
}) {
  const [texte, setTexte] = useBrouillon(`structurer-${processId}`);
  const [resultat, setResultat] = useState<SectionsStructurees | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);

  async function lancer() {
    setErreur(null);
    setEnCours(true);
    try {
      setResultat(await structurerBrouillon(texte));
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  function fermer(v: boolean) {
    onOuvert(v);
    if (!v) {
      setResultat(null);
      setErreur(null);
    }
  }

  return (
    <Dialog open={ouvert} onOpenChange={fermer}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Structurer un brouillon</DialogTitle>
          <DialogDescription>
            Colle des notes en vrac (e-mail, liste, mémo). L'IA les range dans le modèle XTIM sans rien inventer ; tu
            valides avant de remplacer le contenu.
          </DialogDescription>
        </DialogHeader>
        {!resultat ? (
          <Textarea
            value={texte}
            onChange={(e) => setTexte(e.target.value)}
            rows={14}
            placeholder="Ex. : quand on reçoit la proforma, vérifier le montant, puis faire le virement SWIFT depuis la banque…"
            aria-label="Texte à structurer"
            autoFocus
          />
        ) : (
          <div className="max-h-[55vh] overflow-y-auto rounded-md border px-4 py-2 scrollbar-thin">
            {resultat.titre_suggere ? <p className="mb-2 text-lg font-semibold">{resultat.titre_suggere}</p> : null}
            <ApercuContenu contenu={docDepuisSections(resultat, revision)} />
          </div>
        )}
        {erreur ? <MessageErreur>{erreur}</MessageErreur> : null}
        <DialogFooter>
          {!resultat ? (
            <>
              <Button variant="outline" onClick={() => fermer(false)}>
                Annuler
              </Button>
              <Button onClick={lancer} disabled={texte.trim().length < 20 || enCours}>
                <Sparkles aria-hidden />
                {enCours ? "Structuration…" : "Structurer"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setResultat(null)}>
                Modifier le texte
              </Button>
              <Button
                onClick={() => {
                  onValider(docDepuisSections(resultat, revision), resultat.titre_suggere);
                  setTexte("");
                  fermer(false);
                }}
              >
                Remplacer le contenu
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
