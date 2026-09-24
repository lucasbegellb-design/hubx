import type { JSONContent } from "@tiptap/core";
import { X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useReferentiels } from "@/features/referentiels/api";
import { useRaccourci } from "@/hooks/useRaccourci";
import { dateHeure } from "@/lib/format";
import type { ProcessVersion } from "@/lib/types";
import { useVersions } from "./api";
import { ApercuContenu } from "./Editeur";

export function PanneauVersions({
  processId,
  onFermer,
  onRestaurer,
}: {
  processId: string;
  onFermer: () => void;
  onRestaurer: (v: ProcessVersion) => void;
}) {
  const r = useReferentiels();
  const versions = useVersions(processId, true);
  const [apercu, setApercu] = useState<ProcessVersion | null>(null);
  useRaccourci("Escape", onFermer, { actif: !apercu });

  return (
    <aside aria-label="Historique des versions" className="flex w-80 shrink-0 animate-slide-in-right flex-col border-l bg-card">
      <div className="flex h-12 items-center border-b px-3">
        <p className="flex-1 text-sm font-medium">Historique</p>
        <Button variant="ghost" size="icon" aria-label="Fermer l'historique" onClick={onFermer}>
          <X />
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
        {versions.isPending ? (
          <div className="space-y-2 p-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <ul className="space-y-0.5">
            {versions.data?.map((v, i) => (
              <li key={v.id}>
                <button type="button" onClick={() => setApercu(v)} className="w-full rounded-md px-2 py-2 text-left hover:bg-accent/60">
                  <p className="text-sm">
                    {dateHeure(v.created_at)}
                    {i === 0 ? <span className="ml-1.5 text-xs text-fait">actuelle</span> : null}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.nomMembre(v.auteur) || "Système"} · {v.titre}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <Dialog open={Boolean(apercu)} onOpenChange={(o) => !o && setApercu(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{apercu?.titre}</DialogTitle>
            <DialogDescription>
              Version du {dateHeure(apercu?.created_at)} par {r.nomMembre(apercu?.auteur) || "Système"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto rounded-md border px-4 py-2 scrollbar-thin">
            {apercu ? <ApercuContenu contenu={apercu.contenu as JSONContent} /> : null}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApercu(null)}>
              Fermer
            </Button>
            <Button
              onClick={() => {
                if (apercu) onRestaurer(apercu);
                setApercu(null);
              }}
            >
              Restaurer cette version
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
