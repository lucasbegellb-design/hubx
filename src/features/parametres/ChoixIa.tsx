import { FOURNISSEURS, fournisseur, urlApiValide, type IdFournisseur } from "@shared/ia";
import { ExternalLink } from "lucide-react";
import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ouvrirUrl } from "@/lib/tauri";

export interface ValeurIa {
  fournisseur: IdFournisseur;
  modele: string;
  url: string;
  cle: string;
}

export const valeurIaInitiale = (id: IdFournisseur = "mistral"): ValeurIa => ({
  fournisseur: id,
  modele: fournisseur(id).modeleDefaut,
  url: "",
  cle: "",
});

/** Problème bloquant dans le choix (null si tout est correct). La clé n'est pas exigée ici. */
export function problemeIa(v: ValeurIa): string | null {
  if (v.modele.trim().length < 3) return "Renseigne le nom du modèle.";
  if (v.fournisseur === "autre" && !urlApiValide(v.url.trim()))
    return "Renseigne l'adresse de l'API (https://…, par exemple https://openrouter.ai/api/v1).";
  return null;
}

/** Choix du fournisseur d'IA, du modèle, de l'adresse (service « autre ») et saisie de la clé API. */
export function ChoixIa({
  valeur,
  onChange,
  cleEnregistree = false,
  desactive = false,
}: {
  valeur: ValeurIa;
  onChange: (v: ValeurIa) => void;
  cleEnregistree?: boolean;
  desactive?: boolean;
}) {
  const id = useId();
  const f = fournisseur(valeur.fournisseur);
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${id}-fournisseur`}>Fournisseur</Label>
        <Select
          value={valeur.fournisseur}
          onValueChange={(v) => onChange({ ...valeurIaInitiale(v as IdFournisseur), cle: valeur.cle })}
          disabled={desactive}
        >
          <SelectTrigger id={`${id}-fournisseur`} className="max-w-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FOURNISSEURS.map((x) => (
              <SelectItem key={x.id} value={x.id}>
                {x.nom}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {f.description}{" "}
          {f.lienCle ? (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              onClick={() => ouvrirUrl(f.lienCle!)}
            >
              Créer une clé <ExternalLink className="size-3.5" aria-hidden />
            </button>
          ) : null}
        </p>
      </div>

      {f.id === "autre" ? (
        <div className="space-y-1.5">
          <Label htmlFor={`${id}-url`}>Adresse de l'API</Label>
          <Input
            id={`${id}-url`}
            value={valeur.url}
            onChange={(e) => onChange({ ...valeur, url: e.target.value })}
            placeholder="https://openrouter.ai/api/v1"
            className="font-mono text-sm"
            disabled={desactive}
          />
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-modele`}>Modèle</Label>
        <Input
          id={`${id}-modele`}
          value={valeur.modele}
          onChange={(e) => onChange({ ...valeur, modele: e.target.value })}
          placeholder={f.modeleDefaut || "nom-du-modele"}
          className="max-w-sm font-mono text-sm"
          list={f.modeles.length ? `${id}-modeles` : undefined}
          disabled={desactive}
        />
        {f.modeles.length ? (
          <>
            <datalist id={`${id}-modeles`}>
              {f.modeles.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.libelle}
                </option>
              ))}
            </datalist>
            <ul className="text-sm text-muted-foreground">
              {f.modeles.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    className="font-mono hover:text-foreground disabled:cursor-default"
                    disabled={desactive}
                    onClick={() => onChange({ ...valeur, modele: m.id })}
                  >
                    {m.id}
                  </button>{" "}
                  — {m.libelle}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${id}-cle`}>Clé API {f.id === "autre" ? "" : f.nom}</Label>
        <Input
          id={`${id}-cle`}
          type="password"
          value={valeur.cle}
          onChange={(e) => onChange({ ...valeur, cle: e.target.value })}
          placeholder={cleEnregistree ? "Nouvelle clé (remplace l'actuelle)" : "Colle ta clé API"}
          className="font-mono text-sm"
          autoComplete="off"
          disabled={desactive}
        />
      </div>
    </div>
  );
}
