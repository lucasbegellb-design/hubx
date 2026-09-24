import type { JSONContent } from "@tiptap/core";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function extensions(placeholder = "Commence à écrire…") {
  return [
    StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
    Placeholder.configure({ placeholder }),
  ];
}

export function useEditeurProcess(
  contenu: JSONContent | null,
  onChange: (doc: JSONContent) => void,
  editable: boolean,
) {
  const editor = useEditor({
    extensions: extensions(),
    content: contenu ?? undefined,
    editable,
    editorProps: {
      attributes: { class: "tiptap prose-xtim", "aria-label": "Contenu du process", spellcheck: "true", lang: "fr" },
    },
    onUpdate: ({ editor: e }) => onChange(e.getJSON()),
  });
  useEffect(() => {
    editor?.setEditable(editable);
  }, [editor, editable]);
  return editor;
}

/** Aperçu en lecture seule d'un contenu TipTap (versions, structuration IA). */
export function ApercuContenu({ contenu, className }: { contenu: JSONContent; className?: string }) {
  const editor = useEditor({
    extensions: extensions(""),
    content: contenu,
    editable: false,
    editorProps: { attributes: { class: "tiptap prose-xtim !min-h-0" } },
  });
  useEffect(() => {
    if (editor && JSON.stringify(editor.getJSON()) !== JSON.stringify(contenu)) editor.commands.setContent(contenu);
  }, [editor, contenu]);
  return <EditorContent editor={editor} className={className} />;
}

function Bouton({
  icone: Icone,
  libelle,
  actif,
  onClick,
  desactive,
}: {
  icone: LucideIcon;
  libelle: string;
  actif?: boolean;
  onClick: () => void;
  desactive?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          aria-label={libelle}
          aria-pressed={actif}
          disabled={desactive}
          className={cn(
            "flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40",
            actif && "bg-accent text-foreground",
          )}
        >
          <Icone className="size-4" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent>{libelle}</TooltipContent>
    </Tooltip>
  );
}

export function BarreOutils({ editor }: { editor: Editor }) {
  const etat = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      gras: e.isActive("bold"),
      italique: e.isActive("italic"),
      puces: e.isActive("bulletList"),
      numeros: e.isActive("orderedList"),
      citation: e.isActive("blockquote"),
      annuler: e.can().undo(),
      retablir: e.can().redo(),
      editable: e.isEditable,
    }),
  });
  const c = () => editor.chain().focus();
  const off = !etat.editable;
  return (
    <div role="toolbar" aria-label="Mise en forme" className="flex items-center gap-0.5">
      <Bouton
        icone={Heading2}
        libelle="Titre de section"
        actif={etat.h2}
        onClick={() => c().toggleHeading({ level: 2 }).run()}
        desactive={off}
      />
      <Bouton
        icone={Heading3}
        libelle="Sous-titre"
        actif={etat.h3}
        onClick={() => c().toggleHeading({ level: 3 }).run()}
        desactive={off}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <Bouton
        icone={Bold}
        libelle="Gras (Ctrl+B)"
        actif={etat.gras}
        onClick={() => c().toggleBold().run()}
        desactive={off}
      />
      <Bouton
        icone={Italic}
        libelle="Italique (Ctrl+I)"
        actif={etat.italique}
        onClick={() => c().toggleItalic().run()}
        desactive={off}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <Bouton
        icone={List}
        libelle="Liste à puces"
        actif={etat.puces}
        onClick={() => c().toggleBulletList().run()}
        desactive={off}
      />
      <Bouton
        icone={ListOrdered}
        libelle="Liste numérotée"
        actif={etat.numeros}
        onClick={() => c().toggleOrderedList().run()}
        desactive={off}
      />
      <Bouton
        icone={Quote}
        libelle="Encadré"
        actif={etat.citation}
        onClick={() => c().toggleBlockquote().run()}
        desactive={off}
      />
      <span className="mx-1 h-5 w-px bg-border" />
      <Bouton
        icone={Undo2}
        libelle="Annuler (Ctrl+Z)"
        onClick={() => c().undo().run()}
        desactive={off || !etat.annuler}
      />
      <Bouton
        icone={Redo2}
        libelle="Rétablir (Ctrl+Y)"
        onClick={() => c().redo().run()}
        desactive={off || !etat.retablir}
      />
    </div>
  );
}

export { EditorContent };
