import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import type { Cellule, Onglet } from "@shared/chine.ts";
import { normaliser } from "@shared/saisie.ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateCourte } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE = 300;
const RE_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function afficherCellule(v: Cellule): string {
  if (v === null) return "";
  if (typeof v === "number") return v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (RE_DATE.test(v)) return dateCourte(v);
  return v;
}

function comparer(a: Cellule, b: Cellule): number {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "fr", { numeric: true });
}

/** Onglet du classeur rendu en tableau filtrable et triable (aucune configuration). */
export function TableauOnglet({ onglet }: { onglet: Onglet }) {
  const [filtre, setFiltre] = useState("");
  const [tri, setTri] = useState<{ col: number; sens: 1 | -1 } | null>(null);
  const [limite, setLimite] = useState(PAGE);

  const numeriques = useMemo(
    () => onglet.entetes.map((_, i) => onglet.lignes.some((l) => typeof l[i] === "number") && onglet.lignes.every((l) => l[i] === null || typeof l[i] === "number")),
    [onglet],
  );

  const lignes = useMemo(() => {
    const q = normaliser(filtre);
    let l = q ? onglet.lignes.filter((r) => normaliser(r.map(afficherCellule).join(" ")).includes(q)) : onglet.lignes;
    if (tri) l = [...l].sort((a, b) => comparer(a[tri.col], b[tri.col]) * tri.sens);
    return l;
  }, [onglet, filtre, tri]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-3">
        <div className="relative w-72">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" aria-hidden />
          <Input value={filtre} onChange={(e) => setFiltre(e.target.value)} placeholder={`Filtrer « ${onglet.nom} »`} aria-label="Filtrer le tableau" className="h-9 pl-8" />
        </div>
        <p className="text-sm text-muted-foreground tabular">
          {lignes.length} ligne{lignes.length > 1 ? "s" : ""}
          {filtre ? ` sur ${onglet.lignes.length}` : ""}
        </p>
      </div>
      <div className="min-h-0 flex-1 overflow-auto border-t scrollbar-thin">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-card">
            <tr>
              {onglet.entetes.map((h, i) => (
                <th key={i} scope="col" aria-sort={tri?.col === i ? (tri.sens === 1 ? "ascending" : "descending") : "none"} className="border-b px-0 text-left font-medium">
                  <button
                    type="button"
                    onClick={() => setTri((t) => (t?.col === i ? (t.sens === 1 ? { col: i, sens: -1 } : null) : { col: i, sens: 1 }))}
                    className={cn("flex w-full items-center gap-1 whitespace-nowrap px-3 py-2 hover:bg-accent/60", numeriques[i] && "justify-end")}
                  >
                    {h}
                    {tri?.col === i ? tri.sens === 1 ? <ArrowUp className="size-3.5" aria-hidden /> : <ArrowDown className="size-3.5" aria-hidden /> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lignes.slice(0, limite).map((l, r) => (
              <tr key={r} className="border-b last:border-b-0 hover:bg-accent/40">
                {l.map((c, i) => (
                  <td key={i} className={cn("max-w-80 truncate whitespace-nowrap px-3 py-1.5", numeriques[i] && "text-right tabular", typeof c === "string" && RE_DATE.test(c) && "tabular")} title={c === null ? undefined : String(c)}>
                    {afficherCellule(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {lignes.length > limite ? (
          <div className="p-3">
            <Button variant="outline" size="sm" onClick={() => setLimite((x) => x + PAGE)}>
              Afficher {Math.min(PAGE, lignes.length - limite)} lignes de plus
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
