import type { JSONContent } from "@tiptap/core";

function marques(texte: string, m: JSONContent["marks"]): string {
  let t = texte;
  for (const mk of m ?? []) {
    if (mk.type === "bold") t = `**${t}**`;
    else if (mk.type === "italic") t = `*${t}*`;
    else if (mk.type === "code") t = `\`${t}\``;
    else if (mk.type === "strike") t = `~~${t}~~`;
    else if (mk.type === "link" && mk.attrs?.href) t = `[${t}](${mk.attrs.href})`;
  }
  return t;
}

function inline(n: JSONContent): string {
  if (n.type === "text") return marques(n.text ?? "", n.marks);
  if (n.type === "hardBreak") return "  \n";
  return (n.content ?? []).map(inline).join("");
}

function bloc(n: JSONContent, indent = ""): string {
  switch (n.type) {
    case "heading":
      return `${"#".repeat((n.attrs?.level as number) ?? 2)} ${inline(n)}`;
    case "paragraph":
      return indent + inline(n);
    case "bulletList":
    case "orderedList":
      return (n.content ?? [])
        .map((li, i) => {
          const puce = n.type === "orderedList" ? `${i + 1}.` : "-";
          const [premier, ...reste] = li.content ?? [];
          const tete = `${indent}${puce} ${premier ? inline(premier) : ""}`;
          const suite = reste.map((c) => bloc(c, indent + "   ")).join("\n");
          return suite ? `${tete}\n${suite}` : tete;
        })
        .join("\n");
    case "blockquote":
      return (n.content ?? []).map((c) => `> ${bloc(c)}`).join("\n");
    case "codeBlock":
      return "```\n" + inline(n) + "\n```";
    case "horizontalRule":
      return "---";
    default:
      return inline(n);
  }
}

/** Conversion TipTap JSON → Markdown (export et passation). */
export function versMarkdown(doc: JSONContent, entete?: { titre: string; meta?: string[] }): string {
  const corps = (doc.content ?? []).map((n) => bloc(n)).join("\n\n");
  if (!entete) return corps + "\n";
  const meta = entete.meta?.length ? "\n\n" + entete.meta.map((m) => `_${m}_`).join("  \n") : "";
  return `# ${entete.titre}${meta}\n\n${corps}\n`;
}
