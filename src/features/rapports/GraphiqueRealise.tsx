import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { DonneesRapport } from "@shared/rapport.ts";

/**
 * Tâches réalisées par domaine : une seule série, donc une seule teinte (accent).
 * Barres fines à extrémité arrondie, valeur en bout de barre en couleur de texte, infobulle au survol.
 */
export function GraphiqueRealise({ d }: { d: DonneesRapport }) {
  const donnees = d.realise_par_domaine.map((g) => ({ domaine: g.domaine, n: g.taches.length }));
  if (donnees.length < 2) return null; // un seul domaine : le chiffre suffit
  const hauteur = donnees.length * 30 + 8;
  return (
    <figure className="max-w-xl" aria-label="Tâches réalisées par domaine">
      <div style={{ height: hauteur }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={donnees}
            layout="vertical"
            margin={{ top: 4, right: 36, bottom: 4, left: 0 }}
            barCategoryGap={8}
          >
            <XAxis type="number" hide allowDecimals={false} domain={[0, "dataMax"]} />
            <YAxis
              type="category"
              dataKey="domaine"
              width={110}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 13 }}
            />
            <Tooltip
              cursor={{ fill: "hsl(var(--accent))" }}
              formatter={(v) => [`${v} tâche${Number(v) > 1 ? "s" : ""}`, "Réalisées"]}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 6,
                fontSize: 13,
                color: "hsl(var(--popover-foreground))",
              }}
              labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
            />
            <Bar dataKey="n" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={16} isAnimationActive={false}>
              <LabelList
                dataKey="n"
                position="right"
                style={{ fill: "hsl(var(--foreground))", fontSize: 13, fontVariantNumeric: "tabular-nums" }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
