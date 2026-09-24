// Éléments communs des exports PDF (chargés à la demande : @react-pdf est volumineux).
import { Font, StyleSheet, Text, View } from "@react-pdf/renderer";
import regulier from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff?url";
import italique from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff?url";
import gras from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff?url";
import grasItalique from "@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-italic.woff?url";

let polices = false;
export function enregistrerPolices() {
  if (polices) return;
  polices = true;
  Font.register({
    family: "Plex",
    fonts: [
      { src: regulier, fontWeight: 400 },
      { src: italique, fontWeight: 400, fontStyle: "italic" },
      { src: gras, fontWeight: 600 },
      { src: grasItalique, fontWeight: 600, fontStyle: "italic" },
    ],
  });
  // Pas de césure automatique (mots français coupés de façon incorrecte sinon)
  Font.registerHyphenationCallback((mot) => [mot]);
}

export const C = {
  texte: "#1D2733",
  secondaire: "#5E6B78",
  bordure: "#E3E7EB",
  accent: "#2F5D7C",
  urgent: "#B42318",
  retard: "#B54708",
  fait: "#2E7D4F",
  fond: "#F7F8F9",
};

export const s = StyleSheet.create({
  page: {
    fontFamily: "Plex",
    fontSize: 10,
    color: C.texte,
    paddingTop: 56,
    paddingBottom: 48,
    paddingHorizontal: 48,
    lineHeight: 1.45,
  },
  entete: {
    position: "absolute",
    top: 22,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.secondaire,
    borderBottomWidth: 0.5,
    borderBottomColor: C.bordure,
    paddingBottom: 6,
  },
  pied: {
    position: "absolute",
    bottom: 22,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.secondaire,
  },
  h1: { fontSize: 18, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 },
  h2: { fontSize: 12.5, fontWeight: 600, marginTop: 12, marginBottom: 4, color: C.accent, lineHeight: 1.35 },
  h3: { fontSize: 11, fontWeight: 600, marginTop: 8, marginBottom: 3, lineHeight: 1.4 },
  p: { marginBottom: 4 },
  meta: { fontSize: 9, color: C.secondaire, marginBottom: 12 },
  li: { flexDirection: "row", marginBottom: 2 },
  puce: { width: 16, color: C.secondaire },
  liTexte: { flex: 1 },
  citation: { borderLeftWidth: 2, borderLeftColor: C.bordure, paddingLeft: 8, color: C.secondaire, marginBottom: 4 },
  code: { fontFamily: "Courier", fontSize: 9, backgroundColor: C.fond, padding: 6, marginBottom: 4 },
  hr: { borderBottomWidth: 0.5, borderBottomColor: C.bordure, marginVertical: 8 },
});

export function EntetePdf({ gauche, droite }: { gauche: string; droite?: string }) {
  return (
    <View style={s.entete} fixed>
      <Text>XTIM SAS · {gauche}</Text>
      <Text>{droite ?? ""}</Text>
    </View>
  );
}

export function PiedPdf({ texte }: { texte: string }) {
  return (
    <View style={s.pied} fixed>
      <Text>{texte}</Text>
      <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
    </View>
  );
}
