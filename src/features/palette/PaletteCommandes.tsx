import { BookOpen, CheckCheck, FileText, ListTodo, Moon, Plus, Settings, StickyNote, Zap } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { aujourdhuiParis } from "@shared/dates.ts";
import { analyserSaisie, normaliser } from "@shared/saisie.ts";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { NAVIGATION } from "@/app/BarreLaterale";
import { useAuth } from "@/features/auth/AuthProvider";
import { useDocuments } from "@/features/documents/api";
import { usePostits, useCreerPostit } from "@/features/postits/api";
import { useProcessListe } from "@/features/process/api";
import { useReferentiels } from "@/features/referentiels/api";
import { useCreerTache, useTaches } from "@/features/taches/api";
import { useRaccourci } from "@/hooks/useRaccourci";
import { estTauri } from "@/lib/tauri";
import { useUi } from "@/stores/ui";

/** Filtre par mots entiers (sans accents) : plus prévisible que la recherche floue par défaut. */
function filtrer(value: string, search: string, keywords?: string[]): number {
  if (value.startsWith("__creer")) return 1;
  const cible = normaliser(keywords?.length ? keywords.join(" ") : value);
  const mots = normaliser(search).split(/\s+/).filter(Boolean);
  return mots.every((m) => cible.includes(m)) ? 1 : 0;
}

export function PaletteCommandes() {
  const ouverte = useUi((s) => s.paletteOuverte);
  const setOuverte = useUi((s) => s.setPaletteOuverte);
  const theme = useUi((s) => s.theme);
  const setTheme = useUi((s) => s.setTheme);
  const [q, setQ] = useState("");
  const naviguer = useNavigate();
  const { userId } = useAuth();
  const r = useReferentiels();
  const taches = useTaches();
  const postits = usePostits();
  const process = useProcessListe();
  const documents = useDocuments();
  const creerTache = useCreerTache();
  const creerPostit = useCreerPostit();

  useRaccourci("mod+k", () => setOuverte(!ouverte));

  function fermer() {
    setOuverte(false);
    setQ("");
  }
  const aller = (to: string) => () => {
    naviguer(to);
    fermer();
  };

  const saisie = analyserSaisie(q, { domaines: r.listeDomaines, projets: r.projetsActifs, aujourdhui: aujourdhuiParis() });
  const texte = saisie.titre.trim();

  async function creer(type: "tache" | "fait" | "postit") {
    fermer();
    try {
      if (type === "postit") {
        await creerPostit.mutateAsync({ contenu: q.replace(/^p:\s*/i, "").trim(), proprietaire: userId });
        toast.success("Post-it ajouté");
      } else {
        await creerTache.mutateAsync({
          titre: texte,
          domaine_id: saisie.domaineId ?? r.listeDomaines[0]?.id ?? null,
          projet_id: saisie.projetId,
          echeance: type === "tache" ? saisie.echeance : null,
          priorite: saisie.urgente ? "urgente" : "normale",
          statut: type === "fait" ? "fait" : "a_faire",
          assigne_a: userId,
        });
        toast.success(type === "fait" ? "Enregistré comme fait" : "Tâche ajoutée");
      }
    } catch {
      /* message affiché globalement */
    }
  }

  const tachesActives = (taches.data ?? []).filter((t) => !t.deleted_at);
  const postitsActifs = (postits.data ?? []).filter((p) => !p.archived_at);

  return (
    <CommandDialog open={ouverte} onOpenChange={(o) => (o ? setOuverte(true) : fermer())} filter={filtrer}>
      <CommandInput value={q} onValueChange={setQ} placeholder="Chercher, aller à, créer…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>Aucun résultat. Saisis un titre pour créer une tâche.</CommandEmpty>
        {texte ? (
          <CommandGroup heading="Créer" forceMount>
            <CommandItem forceMount value={`__creer_tache ${q}`} onSelect={() => creer("tache")}>
              <Plus aria-hidden />
              Créer la tâche « {texte} »
            </CommandItem>
            <CommandItem forceMount value={`__creer_fait ${q}`} onSelect={() => creer("fait")}>
              <CheckCheck aria-hidden />
              Enregistrer comme fait « {texte} »
            </CommandItem>
            <CommandItem forceMount value={`__creer_postit ${q}`} onSelect={() => creer("postit")}>
              <StickyNote aria-hidden />
              Créer un post-it
            </CommandItem>
          </CommandGroup>
        ) : null}
        <CommandGroup heading="Aller à">
          {NAVIGATION.map((n, i) => (
            <CommandItem key={n.to} value={`aller ${n.libelle}`} onSelect={aller(n.to)}>
              <n.icone aria-hidden />
              {n.libelle}
              <CommandShortcut>Ctrl {i + 1}</CommandShortcut>
            </CommandItem>
          ))}
          <CommandItem value="aller Paramètres" onSelect={aller("/parametres")}>
            <Settings aria-hidden />
            Paramètres
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Actions">
          <CommandItem value="nouveau process" onSelect={aller("/process?nouveau=1")}>
            <BookOpen aria-hidden />
            Nouveau process
          </CommandItem>
          <CommandItem value="nouveau rapport générer" onSelect={aller("/rapports?nouveau=1")}>
            <FileText aria-hidden />
            Générer un rapport
          </CommandItem>
          {estTauri() ? (
            <CommandItem
              value="capture rapide fenêtre"
              onSelect={async () => {
                fermer();
                const { invoke } = await import("@tauri-apps/api/core");
                invoke("ouvrir_capture");
              }}
            >
              <Zap aria-hidden />
              Capture rapide
              <CommandShortcut>Ctrl Maj Espace</CommandShortcut>
            </CommandItem>
          ) : null}
          <CommandItem
            value="thème sombre clair basculer"
            onSelect={() => {
              setTheme(theme === "sombre" ? "clair" : "sombre");
              fermer();
            }}
          >
            <Moon aria-hidden />
            Basculer le thème clair / sombre
          </CommandItem>
        </CommandGroup>
        {q.trim().length >= 2 ? (
          <>
            <CommandSeparator />
            <ResultatGroupe
              titre="Tâches"
              items={tachesActives.map((t) => ({ id: t.id, libelle: t.titre, detail: t.statut === "fait" ? "faite" : "" }))}
              icone={<ListTodo aria-hidden />}
              onSelect={(id) => aller(`/taches?t=${id}`)()}
            />
            <ResultatGroupe
              titre="Process"
              items={(process.data ?? []).map((p) => ({ id: p.id, libelle: p.titre, detail: p.statut }))}
              icone={<BookOpen aria-hidden />}
              onSelect={(id) => aller(`/process/${id}`)()}
            />
            <ResultatGroupe
              titre="Documents"
              items={(documents.data ?? []).map((d) => ({ id: d.id, libelle: d.nom, detail: d.categorie ?? "" }))}
              icone={<FileText aria-hidden />}
              onSelect={(id) => aller(`/documents?d=${id}`)()}
            />
            <ResultatGroupe
              titre="Post-its"
              items={postitsActifs.map((p) => ({ id: p.id, libelle: p.contenu.slice(0, 90), detail: "" }))}
              icone={<StickyNote aria-hidden />}
              onSelect={(id) => aller(`/postits?p=${id}`)()}
            />
          </>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}

function ResultatGroupe({
  titre,
  items,
  icone,
  onSelect,
}: {
  titre: string;
  items: { id: string; libelle: string; detail: string }[];
  icone: React.ReactNode;
  onSelect: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <CommandGroup heading={titre}>
      {items.slice(0, 400).map((it) => (
        <CommandItem key={it.id} value={it.id} keywords={[it.libelle]} onSelect={() => onSelect(it.id)}>
          {icone}
          <span className="truncate">{it.libelle}</span>
          {it.detail ? <span className="ml-auto shrink-0 text-xs text-muted-foreground">{it.detail}</span> : null}
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

