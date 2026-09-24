import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EnteteePage, EtatVide, MessageErreur } from "@/components/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOnline } from "@/lib/online";
import { ilYa } from "@/lib/format";
import { useActualiserChine, useAnalyseChine } from "./api";
import { Historique } from "./Historique";
import { TableauOnglet } from "./TableauOnglet";
import { VueEnsemble } from "./VueEnsemble";

/** « Mis à jour il y a X min », rafraîchi chaque minute. */
function useMaintenant(intervalle = 60_000) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), intervalle);
    return () => window.clearInterval(id);
  }, [intervalle]);
}

export default function PageChine() {
  const a = useAnalyseChine();
  const actualiser = useActualiserChine();
  const online = useOnline();
  const [onglet, setOnglet] = useState("ensemble");
  useMaintenant();

  function lancer() {
    actualiser.mutate(undefined, {
      onSuccess: (r) => toast.success(r.change ? "Actualisé : nouvelle version du fichier" : "Actualisé : aucun changement"),
      onError: (e) => toast.error((e as Error).message),
    });
  }

  const source = a.source;
  const demo = source?.derniere_source === "mock";

  return (
    <div className="flex h-full flex-col">
      <EnteteePage
        titre="Suivi Chine"
        sousTitre={
          <span className="inline-flex items-center gap-2">
            Lecture seule du fichier d'Edwin · mis à jour {ilYa(source?.last_sync_at)}
            {demo ? (
              <Badge variant="outline" className="font-normal text-retard">
                Mode démo : fichier d'exemple
              </Badge>
            ) : null}
          </span>
        }
        actions={
          <Button variant="outline" onClick={lancer} disabled={actualiser.isPending || !online}>
            <RefreshCw aria-hidden className={actualiser.isPending ? "animate-spin" : undefined} />
            {actualiser.isPending ? "Actualisation…" : "Actualiser"}
          </Button>
        }
      />
      {source?.last_error || a.problemes.length ? (
        <div className="space-y-2 border-b bg-card px-6 py-3">
          {source?.last_error ? <MessageErreur>Dernière synchronisation échouée : {source.last_error}</MessageErreur> : null}
          {a.problemes.map((p) => (
            <MessageErreur key={p}>{p}</MessageErreur>
          ))}
        </div>
      ) : null}

      {!a.charge ? (
        <div className="space-y-3 p-6">
          <Skeleton className="h-9 w-96" />
          <Skeleton className="h-64" />
        </div>
      ) : !a.snapshot ? (
        <div className="p-6">
          <EtatVide
            titre="Aucune donnée synchronisée pour l'instant."
            action={
              <Button onClick={lancer} disabled={actualiser.isPending || !online}>
                <RefreshCw aria-hidden /> Lancer la première synchronisation
              </Button>
            }
          >
            La synchronisation automatique a lieu toutes les 15 minutes. Sans identifiants Azure, le fichier d'exemple est utilisé.
          </EtatVide>
        </div>
      ) : (
        <Tabs value={onglet} onValueChange={setOnglet} className="flex min-h-0 flex-1 flex-col">
          <div className="overflow-x-auto border-b bg-card px-6 scrollbar-thin">
            <TabsList className="h-11 gap-1 rounded-none bg-transparent p-0">
              <TabsTrigger value="ensemble" className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Vue d'ensemble
              </TabsTrigger>
              {a.donnees.onglets.map((o) => (
                <TabsTrigger key={o.nom} value={`o:${o.nom}`} className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                  {o.nom}
                </TabsTrigger>
              ))}
              <TabsTrigger value="historique" className="rounded-none border-b-2 border-transparent px-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none">
                Historique
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="ensemble" className="mt-0 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <VueEnsemble a={a} />
          </TabsContent>
          {a.donnees.onglets.map((o) => (
            <TabsContent key={o.nom} value={`o:${o.nom}`} className="mt-0 min-h-0 flex-1">
              <TableauOnglet onglet={o} />
            </TabsContent>
          ))}
          <TabsContent value="historique" className="mt-0 min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <Historique mapping={a.mapping} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
