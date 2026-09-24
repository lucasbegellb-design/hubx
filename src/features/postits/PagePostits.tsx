import { Bell } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { EnteteePage, EtatVide, Kbd } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/features/auth/AuthProvider";
import { useEcriture } from "@/hooks/useEcriture";
import { useRaccourci } from "@/hooks/useRaccourci";
import { dateHeure } from "@/lib/format";
import type { CouleurPostit } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useBrouillon } from "@/stores/ui";
import { useCreerPostit, usePostits } from "./api";
import { COULEURS, CartePostit, ChoixRappel, classeCouleur } from "./CartePostit";

type Vue = "tous" | "miens" | "partages" | "archives";

function NouveauPostit() {
  const { userId } = useAuth();
  const creer = useCreerPostit();
  const { peutEcrire } = useEcriture();
  const [contenu, setContenu] = useBrouillon("nouveau-postit");
  const [couleur, setCouleur] = useState<CouleurPostit>("sable");
  const [partage, setPartage] = useState(false);
  const [rappel, setRappel] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  useRaccourci("n", () => ref.current?.focus());

  async function ajouter() {
    if (!contenu.trim()) return;
    await creer.mutateAsync({ contenu: contenu.trim(), couleur, partage, rappel_at: rappel, proprietaire: userId });
    setContenu("");
    setRappel(null);
    toast.success("Post-it ajouté");
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border border-black/5 p-3 dark:border-white/5",
        classeCouleur(couleur),
      )}
    >
      <Textarea
        ref={ref}
        value={contenu}
        onChange={(e) => setContenu(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && ajouter()}
        placeholder="Nouveau post-it…"
        aria-label="Nouveau post-it"
        className="min-h-20 resize-none border-black/10 bg-white/50 dark:bg-black/20"
      />
      <div className="flex items-center gap-1.5">
        {COULEURS.map((c) => (
          <button
            key={c.valeur}
            type="button"
            aria-label={`Couleur ${c.libelle}`}
            aria-pressed={couleur === c.valeur}
            onClick={() => setCouleur(c.valeur)}
            className={cn(
              "size-5 rounded border border-black/10",
              c.classe,
              couleur === c.valeur && "ring-2 ring-primary ring-offset-1",
            )}
          />
        ))}
        <div className="flex-1" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-black/5">
              <Bell aria-hidden />
              {rappel ? dateHeure(rappel) : "Rappel"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72">
            <ChoixRappel valeur={rappel} onChange={setRappel} />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex items-center gap-2">
        <Switch id="partage" checked={partage} onCheckedChange={setPartage} />
        <Label htmlFor="partage" className="text-sm font-normal">
          Partager
        </Label>
        <div className="flex-1" />
        <Button size="sm" onClick={ajouter} disabled={!contenu.trim() || !peutEcrire || creer.isPending}>
          Ajouter <Kbd className="ml-1 border-white/30 bg-white/10 text-inherit">Ctrl ↵</Kbd>
        </Button>
      </div>
    </div>
  );
}

export default function PagePostits() {
  const { userId } = useAuth();
  const [vue, setVue] = useState<Vue>("tous");
  const [params] = useSearchParams();
  const miseEnAvant = params.get("p");
  const q = usePostits();

  const liste = useMemo(() => {
    const l = (q.data ?? []).filter((p) => {
      if (vue === "archives") return Boolean(p.archived_at);
      if (p.archived_at) return false;
      if (vue === "miens") return p.proprietaire === userId;
      if (vue === "partages") return p.partage;
      return true;
    });
    return [...l].sort((a, b) => Number(b.epingle) - Number(a.epingle));
  }, [q.data, vue, userId]);

  return (
    <div className="flex h-full flex-col">
      <EnteteePage
        titre="Post-its"
        actions={
          <ToggleGroup
            type="single"
            value={vue}
            onValueChange={(v) => v && setVue(v as Vue)}
            className="rounded-md border p-0.5"
          >
            {(
              [
                ["tous", "Tous"],
                ["miens", "Les miens"],
                ["partages", "Partagés"],
                ["archives", "Archivés"],
              ] as const
            ).map(([v, l]) => (
              <ToggleGroupItem key={v} value={v} className="h-7 px-2.5 text-sm data-[state=on]:bg-accent">
                {l}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      />
      <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
        {q.isPending ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] items-start gap-3">
            {vue !== "archives" ? <NouveauPostit /> : null}
            {liste.map((p) => (
              <CartePostit key={p.id} postit={p} miseEnAvant={p.id === miseEnAvant} />
            ))}
            {liste.length === 0 && vue === "archives" ? (
              <EtatVide titre="Aucun post-it archivé." className="col-span-full">
                Les post-its archivés restent consultables ici pendant 90 jours.
              </EtatVide>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
