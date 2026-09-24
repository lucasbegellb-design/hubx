import { CheckCircle2, Plus, RefreshCw, Trash2, Wand2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { aujourdhuiParis } from "@shared/dates.ts";
import {
  appliquerMapping,
  calculerKpi,
  devinerColonnes,
  LIBELLES_ROLES,
  ROLES,
  validerMapping,
  type MappingChine,
  type MappingOnglet,
  type Role,
} from "@shared/chine.ts";
import { MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/features/auth/AuthProvider";
import { dateHeure, ilYa, pluriel } from "@/lib/format";
import { messageErreur } from "@/lib/supabase";
import { testerConnexionChine, useActualiserChine, useAnalyseChine, useMajSourceChine } from "./api";

const AUCUNE = "__aucune__";

function CarteOnglet({
  mo,
  onglets,
  onChange,
  onRetirer,
}: {
  mo: MappingOnglet;
  onglets: { nom: string; entetes: string[] }[];
  onChange: (m: MappingOnglet) => void;
  onRetirer: () => void;
}) {
  const onglet = onglets.find((o) => o.nom === mo.onglet);
  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-end gap-2">
        <div className="flex-1 space-y-1.5">
          <Label>Onglet</Label>
          <Select value={mo.onglet} onValueChange={(v) => onChange({ onglet: v, colonnes: devinerColonnes(onglets.find((o) => o.nom === v)?.entetes ?? []) })}>
            <SelectTrigger aria-label="Onglet du classeur">
              <SelectValue placeholder="Choisir un onglet" />
            </SelectTrigger>
            <SelectContent>
              {!onglet && mo.onglet ? <SelectItem value={mo.onglet}>{mo.onglet} (introuvable)</SelectItem> : null}
              {onglets.map((o) => (
                <SelectItem key={o.nom} value={o.nom}>
                  {o.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={() => onglet && onChange({ ...mo, colonnes: devinerColonnes(onglet.entetes) })} disabled={!onglet}>
          <Wand2 aria-hidden /> Détecter
        </Button>
        <Button variant="ghost" size="icon" aria-label="Retirer cet onglet du mapping" onClick={onRetirer}>
          <Trash2 />
        </Button>
      </div>
      {onglet ? (
        <div className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-3">
          {ROLES.map((r: Role) => (
            <div key={r} className="space-y-1">
              <Label className="text-sm font-normal text-muted-foreground">{LIBELLES_ROLES[r]}</Label>
              <Select
                value={mo.colonnes[r] ?? AUCUNE}
                onValueChange={(v) => onChange({ ...mo, colonnes: { ...mo.colonnes, [r]: v === AUCUNE ? undefined : v } })}
              >
                <SelectTrigger className="h-8" aria-label={LIBELLES_ROLES[r]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUCUNE}>Non utilisée</SelectItem>
                  {mo.colonnes[r] && !onglet.entetes.includes(mo.colonnes[r]!) ? (
                    <SelectItem value={mo.colonnes[r]!}>{mo.colonnes[r]} (introuvable)</SelectItem>
                  ) : null}
                  {onglet.entetes.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Paramètres › Suivi Chine : lien de partage, test de connexion, mapping des colonnes. */
export function ParametresChine() {
  const { estAdmin } = useAuth();
  const a = useAnalyseChine();
  const majSource = useMajSourceChine();
  const actualiser = useActualiserChine();
  const [lien, setLien] = useState("");
  const [mapping, setMapping] = useState<MappingChine>({ onglets: [] });
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  const [testEnCours, setTestEnCours] = useState(false);

  useEffect(() => setLien(a.source?.share_url ?? ""), [a.source?.share_url]);
  useEffect(() => setMapping(a.mapping), [a.mapping]);

  const onglets = a.donnees.onglets;
  const apercu = useMemo(() => {
    const lignes = appliquerMapping(a.donnees, mapping);
    return { lignes: lignes.length, devises: calculerKpi(lignes, aujourdhuiParis()).parDevise.length, problemes: validerMapping(a.donnees, mapping).problemes };
  }, [a.donnees, mapping]);

  async function tester() {
    setTestEnCours(true);
    setTest(null);
    try {
      const r = await testerConnexionChine();
      setTest({ ok: true, message: `Connexion réussie : « ${r.nom} »${r.modifie_le ? `, modifié le ${dateHeure(r.modifie_le)}` : ""}.` });
    } catch (e) {
      setTest({ ok: false, message: (e as Error).message });
    } finally {
      setTestEnCours(false);
    }
  }

  async function enregistrerLien() {
    const v = lien.trim();
    if (v && !/^https:\/\//i.test(v)) return toast.error("Le lien doit commencer par https:// (copie « Copier le lien » dans OneDrive).");
    try {
      await majSource.mutateAsync({ share_url: v || null });
      toast.success("Lien enregistré");
    } catch (e) {
      toast.error(messageErreur(e));
    }
  }

  async function enregistrerMapping() {
    const propre: MappingChine = {
      onglets: mapping.onglets
        .filter((o) => o.onglet)
        .map((o) => ({ onglet: o.onglet, colonnes: Object.fromEntries(Object.entries(o.colonnes).filter(([, v]) => v)) })),
    };
    try {
      await majSource.mutateAsync({ mapping: propre });
      toast.success("Mapping enregistré");
    } catch (e) {
      toast.error(messageErreur(e));
    }
  }

  if (!estAdmin) {
    return <p className="text-sm text-muted-foreground">La source et le mapping du Suivi Chine sont réservés à l'administrateur.</p>;
  }

  const ongletsLibres = onglets.filter((o) => !mapping.onglets.some((m) => m.onglet === o.nom));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="lien">Lien de partage du fichier Excel (OneDrive d'Edwin)</Label>
        <div className="flex gap-2">
          <Input id="lien" value={lien} onChange={(e) => setLien(e.target.value)} placeholder="https://xtim-my.sharepoint.com/:x:/g/personal/…" className="flex-1" />
          <Button onClick={enregistrerLien} disabled={lien.trim() === (a.source?.share_url ?? "") || majSource.isPending}>
            Enregistrer
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Le fichier est lu, jamais modifié. Source actuelle : {a.source?.derniere_source === "onedrive" ? "OneDrive" : "mode démo (identifiants Azure absents)"} ·
          dernière synchro {ilYa(a.source?.last_sync_at)}.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={tester} disabled={testEnCours}>
            <CheckCircle2 aria-hidden /> {testEnCours ? "Test…" : "Tester la connexion"}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              actualiser.mutate(undefined, {
                onSuccess: () => toast.success("Actualisé"),
                onError: (e) => toast.error((e as Error).message),
              })
            }
            disabled={actualiser.isPending}
          >
            <RefreshCw aria-hidden className={actualiser.isPending ? "animate-spin" : undefined} /> Actualiser maintenant
          </Button>
        </div>
        {test ? (
          test.ok ? (
            <p className="text-sm text-fait">{test.message}</p>
          ) : (
            <MessageErreur>{test.message}</MessageErreur>
          )
        ) : null}
        {a.source?.last_error ? <MessageErreur>Dernière synchronisation échouée : {a.source.last_error}</MessageErreur> : null}
      </div>

      <div className="space-y-3 border-t pt-5">
        <div>
          <p className="font-medium">Mapping des colonnes (optionnel)</p>
          <p className="text-sm text-muted-foreground">
            Associe les colonnes du fichier à des rôles pour débloquer les montants (engagé, payé, reste à payer), les prochaines
            échéances et les alertes. Si Edwin renomme une colonne, un message clair s'affiche au lieu d'une erreur.
          </p>
        </div>
        {!onglets.length ? (
          <p className="text-sm text-muted-foreground">Lance d'abord une synchronisation pour connaître les onglets du fichier.</p>
        ) : (
          <>
            {mapping.onglets.map((mo, i) => (
              <CarteOnglet
                key={i}
                mo={mo}
                onglets={onglets}
                onChange={(m) => setMapping((x) => ({ onglets: x.onglets.map((y, j) => (j === i ? m : y)) }))}
                onRetirer={() => setMapping((x) => ({ onglets: x.onglets.filter((_, j) => j !== i) }))}
              />
            ))}
            {ongletsLibres.length ? (
              <Button
                variant="outline"
                onClick={() =>
                  setMapping((x) => ({ onglets: [...x.onglets, { onglet: ongletsLibres[0].nom, colonnes: devinerColonnes(ongletsLibres[0].entetes) }] }))
                }
              >
                <Plus aria-hidden /> Ajouter un onglet
              </Button>
            ) : null}
            <div className="flex items-center gap-3">
              <Button onClick={enregistrerMapping} disabled={majSource.isPending}>
                Enregistrer le mapping
              </Button>
              <p className="text-sm text-muted-foreground">
                Aperçu : {pluriel(apercu.lignes, "ligne reconnue", "lignes reconnues")}, {pluriel(apercu.devises, "devise")}.
              </p>
            </div>
            {apercu.problemes.map((p) => (
              <MessageErreur key={p}>{p}</MessageErreur>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
