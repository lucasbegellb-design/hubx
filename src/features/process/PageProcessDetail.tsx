import type { JSONContent } from "@tiptap/core";
import { ArrowLeft, FileDown, FileText, History, MoreHorizontal, Save, Sparkles, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { EtatVide, MessageErreur } from "@/components/common";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/AuthProvider";
import { useReferentiels } from "@/features/referentiels/api";
import { useEcriture } from "@/hooks/useEcriture";
import { useRaccourci } from "@/hooks/useRaccourci";
import { ilYa } from "@/lib/format";
import { LIBELLE_STATUT_PROCESS, type Process, type ProcessVersion, type StatutProcess } from "@/lib/types";
import { useEnregistrerProcess, useProcess } from "./api";
import { DialogueStructurer } from "./DialogueStructurer";
import { BarreOutils, EditorContent, useEditeurProcess } from "./Editeur";
import { exporterMarkdown, exporterPdf } from "./exports";
import { avecRevision } from "./modele";
import { PanneauVersions } from "./PanneauVersions";

const AUCUN = "__aucun__";
const cleBrouillon = (id: string) => `hubx-process-${id}`;

function lireBrouillon(id: string): JSONContent | null {
  try {
    const b = localStorage.getItem(cleBrouillon(id));
    return b ? (JSON.parse(b) as JSONContent) : null;
  } catch {
    return null;
  }
}

function Editeur({ process: p }: { process: Process }) {
  const { membre } = useAuth();
  const r = useReferentiels();
  const naviguer = useNavigate();
  const enregistrer = useEnregistrerProcess();
  const { peutEcrire } = useEcriture();
  const [titre, setTitre] = useState(p.titre);
  const [responsable, setResponsable] = useState(p.responsable ?? "");
  const [modifie, setModifie] = useState(false);
  const [brouillonRestaure, setBrouillonRestaure] = useState(false);
  const [historique, setHistorique] = useState(false);
  const [structurer, setStructurer] = useState(false);
  const minuteur = useRef<number>();

  const brouillon = useRef(lireBrouillon(p.id));
  const initial = brouillon.current && JSON.stringify(brouillon.current) !== JSON.stringify(p.contenu) ? brouillon.current : (p.contenu as JSONContent);

  const editor = useEditeurProcess(
    initial,
    (doc) => {
      setModifie(true);
      window.clearTimeout(minuteur.current);
      minuteur.current = window.setTimeout(() => {
        try {
          localStorage.setItem(cleBrouillon(p.id), JSON.stringify(doc));
        } catch {
          /* stockage plein ou indisponible */
        }
      }, 400);
    },
    peutEcrire,
  );

  useEffect(() => {
    if (initial !== p.contenu) {
      setModifie(true);
      setBrouillonRestaure(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modifications distantes (Edwin) : on suit le serveur tant qu'on n'édite pas localement.
  useEffect(() => {
    if (!modifie && editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(p.contenu)) {
      editor.commands.setContent(p.contenu as JSONContent, { emitUpdate: false });
    }
    setTitre((t) => (document.activeElement?.id === "titre-process" ? t : p.titre));
    setResponsable((v) => (document.activeElement?.id === "responsable" ? v : (p.responsable ?? "")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.updated_at]);

  const revision = () => `${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })} — ${membre?.nom ?? ""}`;

  async function sauver() {
    if (!editor || !peutEcrire) return;
    const doc = avecRevision(editor.getJSON(), revision());
    editor.commands.setContent(doc, { emitUpdate: false });
    try {
      await enregistrer.mutateAsync({ id: p.id, contenu: doc, titre: titre.trim() || p.titre });
      localStorage.removeItem(cleBrouillon(p.id));
      setModifie(false);
      setBrouillonRestaure(false);
      toast.success("Enregistré");
    } catch {
      /* message global ; le brouillon local reste */
    }
  }

  function abandonnerBrouillon() {
    localStorage.removeItem(cleBrouillon(p.id));
    editor?.commands.setContent(p.contenu as JSONContent, { emitUpdate: false });
    setModifie(false);
    setBrouillonRestaure(false);
  }

  function champ(maj: Partial<Omit<Process, "contenu">>, message?: string) {
    enregistrer.mutate({ id: p.id, ...maj }, { onSuccess: () => message && toast.success(message) });
  }

  useRaccourci("mod+s", () => sauver(), { dansChamps: true });

  const contenuCourant = () => editor?.getJSON() ?? (p.contenu as JSONContent);

  return (
    <div className="flex h-full">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-14 items-center gap-2 border-b bg-card px-4 py-2">
          <Button variant="ghost" size="icon" asChild aria-label="Retour aux process">
            <Link to="/process">
              <ArrowLeft />
            </Link>
          </Button>
          <Input
            id="titre-process"
            value={titre}
            onChange={(e) => setTitre(e.target.value)}
            onBlur={() => titre.trim() && titre.trim() !== p.titre && champ({ titre: titre.trim() })}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Titre du process"
            disabled={!peutEcrire}
            className="h-9 flex-1 border-transparent bg-transparent px-2 text-xl font-semibold hover:border-input focus-visible:border-input"
          />
          <Button variant="outline" onClick={() => setStructurer(true)} disabled={!peutEcrire}>
            <Sparkles aria-hidden />
            Structurer un brouillon
          </Button>
          <Button variant="outline" onClick={() => setHistorique((h) => !h)} aria-pressed={historique}>
            <History aria-hidden />
            Historique
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Plus d'actions">
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => exporterPdf(p, r.domaines, contenuCourant()).catch((e) => toast.error(e.message))}>
                <FileDown aria-hidden /> Exporter en PDF
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => exporterMarkdown(p, r.domaines, contenuCourant()).catch((e) => toast.error(e.message))}>
                <FileText aria-hidden /> Exporter en Markdown
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                disabled={!peutEcrire}
                className="text-urgent focus:text-urgent"
                onSelect={() =>
                  enregistrer.mutate(
                    { id: p.id, deleted_at: new Date().toISOString() },
                    {
                      onSuccess: () => {
                        toast.success("Supprimé", {
                          action: { label: "Annuler", onClick: () => enregistrer.mutate({ id: p.id, deleted_at: null }) },
                        });
                        naviguer("/process");
                      },
                    },
                  )
                }
              >
                <Trash2 aria-hidden /> Supprimer le process
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={sauver} disabled={!modifie || !peutEcrire || enregistrer.isPending}>
            <Save aria-hidden />
            {enregistrer.isPending ? "Enregistrement…" : modifie ? "Enregistrer" : "Enregistré"}
          </Button>
        </header>

        <div className="flex flex-wrap items-center gap-3 border-b bg-card px-6 py-2">
          <Select value={p.statut} onValueChange={(v) => champ({ statut: v }, `Statut : ${LIBELLE_STATUT_PROCESS[v as StatutProcess]}`)} disabled={!peutEcrire}>
            <SelectTrigger className="h-8 w-36" aria-label="Statut">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(LIBELLE_STATUT_PROCESS) as StatutProcess[]).map((s) => (
                <SelectItem key={s} value={s}>
                  {LIBELLE_STATUT_PROCESS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={p.domaine_id ?? AUCUN} onValueChange={(v) => champ({ domaine_id: v === AUCUN ? null : v })} disabled={!peutEcrire}>
            <SelectTrigger className="h-8 w-40" aria-label="Domaine">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUN}>Sans domaine</SelectItem>
              {r.listeDomaines.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            id="responsable"
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
            onBlur={() => responsable.trim() !== (p.responsable ?? "") && champ({ responsable: responsable.trim() || null })}
            placeholder="Responsable"
            aria-label="Responsable"
            disabled={!peutEcrire}
            className="h-8 w-48"
          />
          <span className="text-sm text-muted-foreground">
            Modifié {ilYa(p.updated_at)} par {r.nomMembre(p.modifie_par) || "—"}
          </span>
          <div className="flex-1" />
          {editor ? <BarreOutils editor={editor} /> : null}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-3xl px-8 py-6">
            {brouillonRestaure ? (
              <div className="mb-4">
                <MessageErreur
                  action={
                    <Button size="sm" variant="outline" onClick={abandonnerBrouillon}>
                      Abandonner le brouillon
                    </Button>
                  }
                >
                  Brouillon local restauré : ces modifications n'ont pas encore été enregistrées.
                </MessageErreur>
              </div>
            ) : null}
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>
      {historique ? (
        <PanneauVersions
          processId={p.id}
          onFermer={() => setHistorique(false)}
          onRestaurer={(v: ProcessVersion) => {
            editor?.commands.setContent(v.contenu as JSONContent);
            setModifie(true);
            toast.success("Version restaurée : enregistre pour la conserver");
          }}
        />
      ) : null}
      <DialogueStructurer
        ouvert={structurer}
        onOuvert={setStructurer}
        processId={p.id}
        revision={revision()}
        onValider={(doc, titreSuggere) => {
          editor?.commands.setContent(doc);
          setModifie(true);
          if (titreSuggere && /^nouveau process$/i.test(titre.trim())) setTitre(titreSuggere);
          toast.success("Contenu remplacé : relis puis enregistre");
        }}
      />
    </div>
  );
}

export default function PageProcessDetail() {
  const { id } = useParams();
  const q = useProcess(id);
  if (q.isPending)
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-80" />
        <Skeleton className="h-64 w-full max-w-3xl" />
      </div>
    );
  if (q.error) return <div className="p-6"><MessageErreur>Impossible de charger ce process. Vérifie ta connexion.</MessageErreur></div>;
  if (!q.data || q.data.deleted_at)
    return (
      <div className="p-6">
        <EtatVide titre="Ce process n'existe plus." action={<Button asChild variant="outline"><Link to="/process">Retour aux process</Link></Button>} />
      </div>
    );
  return <Editeur key={q.data.id} process={q.data} />;
}
