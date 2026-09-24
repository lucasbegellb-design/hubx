import type { JSONContent } from "@tiptap/core";
import { Text, View } from "@react-pdf/renderer";
import type { ReactNode } from "react";
import { s } from "./commun";

function styleMarques(marks: JSONContent["marks"]) {
  const st: Record<string, string | number> = {};
  for (const m of marks ?? []) {
    if (m.type === "bold") st.fontWeight = 600;
    if (m.type === "italic") st.fontStyle = "italic";
    if (m.type === "strike") st.textDecoration = "line-through";
    if (m.type === "code") st.fontFamily = "Courier";
    if (m.type === "link") st.color = "#2F5D7C";
  }
  return st;
}

function enLigne(n: JSONContent, i: number): ReactNode {
  if (n.type === "text") {
    return (
      <Text key={i} style={styleMarques(n.marks)}>
        {n.text}
      </Text>
    );
  }
  if (n.type === "hardBreak") return <Text key={i}>{"\n"}</Text>;
  return <Text key={i}>{(n.content ?? []).map(enLigne)}</Text>;
}

function Bloc({ n, niveau = 0 }: { n: JSONContent; niveau?: number }): ReactNode {
  switch (n.type) {
    case "heading": {
      const st = (n.attrs?.level as number) <= 2 ? s.h2 : s.h3;
      return <Text style={st} minPresenceAhead={40}>{(n.content ?? []).map(enLigne)}</Text>;
    }
    case "paragraph":
      return n.content?.length ? <Text style={s.p}>{n.content.map(enLigne)}</Text> : null;
    case "bulletList":
    case "orderedList":
      return (
        <View style={{ marginBottom: 4, marginLeft: niveau * 12 }}>
          {(n.content ?? []).map((li, i) => (
            <View key={i} style={s.li} wrap={false}>
              <Text style={s.puce}>{n.type === "orderedList" ? `${i + 1}.` : "•"}</Text>
              <View style={s.liTexte}>
                {(li.content ?? []).map((c, j) =>
                  c.type === "paragraph" ? (
                    <Text key={j}>{(c.content ?? []).map(enLigne)}</Text>
                  ) : (
                    <Bloc key={j} n={c} niveau={niveau + 1} />
                  ),
                )}
              </View>
            </View>
          ))}
        </View>
      );
    case "blockquote":
      return (
        <View style={s.citation}>
          {(n.content ?? []).map((c, i) => (
            <Bloc key={i} n={c} />
          ))}
        </View>
      );
    case "codeBlock":
      return <Text style={s.code}>{(n.content ?? []).map((c) => c.text).join("")}</Text>;
    case "horizontalRule":
      return <View style={s.hr} />;
    default:
      return n.content ? <Text style={s.p}>{n.content.map(enLigne)}</Text> : null;
  }
}

/** Rendu PDF d'un document TipTap. */
export function ContenuTiptap({ doc }: { doc: JSONContent }) {
  return (
    <>
      {(doc.content ?? []).map((n, i) => (
        <Bloc key={i} n={n} />
      ))}
    </>
  );
}
