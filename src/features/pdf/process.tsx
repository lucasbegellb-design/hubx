import type { JSONContent } from "@tiptap/core";
import { Document, Link, Page, Text, View, pdf } from "@react-pdf/renderer";
import { C, EntetePdf, PiedPdf, enregistrerPolices, s } from "./commun";
import { ContenuTiptap } from "./tiptap";

export interface ProcessExport {
  id: string;
  titre: string;
  domaine: string;
  statut: string;
  responsable: string | null;
  majLe: string;
  contenu: JSONContent;
}

function PageProcess({ p, ancre }: { p: ProcessExport; ancre?: boolean }) {
  return (
    <Page size="A4" style={s.page}>
      <EntetePdf gauche="Process" droite={p.domaine} />
      <View id={ancre ? `p-${p.id}` : undefined}>
        <Text style={s.h1}>{p.titre}</Text>
        <Text style={s.meta}>
          {p.domaine} · {p.statut}
          {p.responsable ? ` · Responsable : ${p.responsable}` : ""} · Mis à jour le {p.majLe}
        </Text>
      </View>
      <ContenuTiptap doc={p.contenu} />
      <PiedPdf texte={p.titre} />
    </Page>
  );
}

export async function pdfProcess(p: ProcessExport): Promise<Blob> {
  enregistrerPolices();
  return pdf(
    <Document title={p.titre} author="XTIM SAS" language="fr">
      <PageProcess p={p} />
    </Document>,
  ).toBlob();
}

/** Pack de passation : page de garde, sommaire cliquable, un process par page. */
export async function pdfPackPassation(liste: ProcessExport[], genereLe: string, par: string): Promise<Blob> {
  enregistrerPolices();
  const parDomaine = new Map<string, ProcessExport[]>();
  for (const p of liste) parDomaine.set(p.domaine, [...(parDomaine.get(p.domaine) ?? []), p]);
  return pdf(
    <Document title="Pack de passation — XTIM" author="XTIM SAS" language="fr">
      <Page size="A4" style={s.page}>
        <EntetePdf gauche="Pack de passation" droite={genereLe} />
        <View style={{ marginTop: 120 }}>
          <Text style={{ fontSize: 26, fontWeight: 600, lineHeight: 1.25 }}>Pack de passation</Text>
          <Text style={{ fontSize: 13, color: C.secondaire, marginTop: 6, lineHeight: 1.4 }}>
            XTIM SAS · Bionic Bird
          </Text>
          <Text style={{ marginTop: 28 }}>
            Ce document rassemble les {liste.length} process actifs de l'entreprise, classés par domaine. Chaque process
            suit le modèle XTIM : objectif, déclencheur, responsable, outils et fichiers, étapes, points d'attention,
            dernière révision.
          </Text>
          <Text style={{ marginTop: 12, color: C.secondaire }}>
            Généré le {genereLe} par {par} depuis Hub XTIM. La version à jour se trouve toujours dans l'application.
          </Text>
        </View>
        <PiedPdf texte="Pack de passation" />
      </Page>
      <Page size="A4" style={s.page}>
        <EntetePdf gauche="Pack de passation" droite="Sommaire" />
        <Text style={s.h1}>Sommaire</Text>
        {[...parDomaine.entries()].map(([domaine, ps]) => (
          <View key={domaine} style={{ marginTop: 10 }} wrap={false}>
            <Text style={s.h3}>{domaine}</Text>
            {ps.map((p) => (
              <Link key={p.id} src={`#p-${p.id}`} style={{ color: C.texte, textDecoration: "none", marginBottom: 3 }}>
                <Text>
                  {p.titre}
                  {p.responsable ? <Text style={{ color: C.secondaire }}> — {p.responsable}</Text> : null}
                </Text>
              </Link>
            ))}
          </View>
        ))}
        <PiedPdf texte="Pack de passation" />
      </Page>
      {[...parDomaine.values()].flat().map((p) => (
        <PageProcess key={p.id} p={p} ancre />
      ))}
    </Document>,
  ).toBlob();
}
