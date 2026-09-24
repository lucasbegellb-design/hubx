import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { diffSnapshots, type Cellule, type DiffChine, type MappingChine } from "@shared/chine.ts";
import { EtatVide } from "@/components/common";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { dateHeure, pluriel } from "@/lib/format";
import { useListeSnapshots, useSnapshot } from "./api";
import { afficherCellule } from "./TableauOnglet";

const PERIODES = [
  { jours: 1, libelle: "Dernières 24 h" },
  { jours: 7, libelle: "7 derniers jours" },
  { jours: 30, libelle: "30 derniers jours" },
  { jours: 90, libelle: "3 derniers mois" },
];

function resumeLigne(entetes: string[], l: Cellule[]): string {
  return entetes
    .map((h, i) => (l[i] === null ? null : `${h} : ${afficherCellule(l[i])}`))
    .filter(Boolean)
    .slice(0, 6)
    .join(" · ");
}

export function ResumeDiff({ diff }: { diff: DiffChine }) {
  return (
    <p className="text-sm">
      <span className="text-fait">{pluriel(diff.totaux.ajoutees, "ligne ajoutée", "lignes ajoutées")}</span> ·{" "}
      <span className="text-retard">{pluriel(diff.totaux.modifiees, "ligne modifiée", "lignes modifiées")}</span> ·{" "}
      <span className="text-urgent">{pluriel(diff.totaux.supprimees, "ligne supprimée", "lignes supprimées")}</span>
    </p>
  );
}

export function Historique({ mapping }: { mapping: MappingChine }) {
  const liste = useListeSnapshots(true);
  const [periode, setPeriode] = useState("7");
  const [de, setDe] = useState<string | null>(null);
  const [a, setA] = useState<string | null>(null);

  // Période prédéfinie → snapshot de référence = le plus récent pris avant le début de la période
  useEffect(() => {
    const s = liste.data;
    if (!s?.length || periode === "perso") return;
    const limite = Date.now() - Number(periode) * 86_400_000;
    const ref = s.find((x) => Date.parse(x.taken_at) <= limite) ?? s[s.length - 1];
    setA(s[0].id);
    setDe(ref.id);
  }, [liste.data, periode]);

  const snapDe = useSnapshot(de);
  const snapA = useSnapshot(a);
  const diff = useMemo(
    () => (snapDe.data && snapA.data ? diffSnapshots(snapDe.data.donnees, snapA.data.donnees, mapping) : null),
    [snapDe.data, snapA.data, mapping],
  );

  if (liste.isPending) return <Skeleton className="m-6 h-40" />;
  if ((liste.data?.length ?? 0) < 2)
    return (
      <div className="p-6">
        <EtatVide titre="Pas encore d'historique.">
          Un snapshot est enregistré à chaque modification du fichier (et au moins une fois par jour). Les évolutions apparaîtront ici.
        </EtatVide>
      </div>
    );

  const options = liste.data!.map((s) => (
    <SelectItem key={s.id} value={s.id}>
      {dateHeure(s.taken_at)}
      {s.source === "mock" ? " (démo)" : ""}
    </SelectItem>
  ));

  return (
    <div className="space-y-5 p-6">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Select value={periode} onValueChange={setPeriode}>
          <SelectTrigger className="h-9 w-48" aria-label="Période">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODES.map((p) => (
              <SelectItem key={p.jours} value={String(p.jours)}>
                {p.libelle}
              </SelectItem>
            ))}
            <SelectItem value="perso">Choisir deux versions</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-muted-foreground">du</span>
        <Select value={de ?? ""} onValueChange={(v) => (setPeriode("perso"), setDe(v))}>
          <SelectTrigger className="h-9 w-56" aria-label="Version de départ">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{options}</SelectContent>
        </Select>
        <span className="text-muted-foreground">au</span>
        <Select value={a ?? ""} onValueChange={(v) => (setPeriode("perso"), setA(v))}>
          <SelectTrigger className="h-9 w-56" aria-label="Version d'arrivée">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>{options}</SelectContent>
        </Select>
      </div>

      {!diff ? (
        <Skeleton className="h-32" />
      ) : diff.onglets.length === 0 ? (
        <EtatVide titre="Aucune différence entre ces deux versions." />
      ) : (
        <>
          <ResumeDiff diff={diff} />
          {diff.onglets.map((o) => (
            <section key={o.onglet} className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {o.onglet}
                {o.statut === "ajoute" ? " — nouvel onglet" : o.statut === "supprime" ? " — onglet supprimé" : ""}
              </h3>
              <ul className="divide-y rounded-lg border bg-card text-sm">
                {o.ajoutees.map((l, i) => (
                  <li key={`a${i}`} className="flex gap-2 px-3 py-2">
                    <Plus className="mt-0.5 size-4 shrink-0 text-fait" aria-label="Ajoutée" />
                    <span>{resumeLigne(o.entetes, l)}</span>
                  </li>
                ))}
                {o.modifiees.map((m, i) => (
                  <li key={`m${i}`} className="px-3 py-2">
                    <p className="font-medium">{o.colonneCle ? `${o.colonneCle} ${m.cle}` : resumeLigne(o.entetes, m.apres)}</p>
                    <ul className="mt-0.5 space-y-0.5">
                      {m.colonnes.map((c) => {
                        const i2 = o.entetes.indexOf(c);
                        return (
                          <li key={c} className="text-muted-foreground">
                            {c} : <span className="line-through">{afficherCellule(m.avant[i2]) || "vide"}</span> →{" "}
                            <span className="font-medium text-foreground">{afficherCellule(m.apres[i2]) || "vide"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
                {o.supprimees.map((l, i) => (
                  <li key={`s${i}`} className="flex gap-2 px-3 py-2 text-muted-foreground">
                    <Minus className="mt-0.5 size-4 shrink-0 text-urgent" aria-label="Supprimée" />
                    <span className="line-through">{resumeLigne(o.entetes, l)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  );
}
