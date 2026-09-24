import { Document, Page, Text, View, pdf } from "@react-pdf/renderer";
import { dateFr, montantFr, TITRES_RAPPORT, type DonneesRapport, type TacheResumee } from "@shared/rapport.ts";
import { C, EntetePdf, PiedPdf, enregistrerPolices, s } from "./commun";

const st = {
  ligne: { flexDirection: "row" as const, borderBottomWidth: 0.5, borderBottomColor: C.bordure, paddingVertical: 3 },
  cellule: { flex: 1 },
  droite: { width: 110, textAlign: "right" as const, color: C.secondaire },
  vide: { color: C.secondaire, fontStyle: "italic" as const, marginBottom: 4 },
  compteurs: { flexDirection: "row" as const, marginVertical: 8 },
  compteur: { flex: 1, borderWidth: 0.5, borderColor: C.bordure, borderRadius: 4, padding: 6, marginRight: 6 },
};

function Taches({ items, vide, droite }: { items: TacheResumee[]; vide: string; droite: (t: TacheResumee) => string }) {
  if (!items.length) return <Text style={st.vide}>{vide}</Text>;
  return (
    <View style={{ marginBottom: 6 }}>
      {items.map((t, i) => (
        <View key={i} style={st.ligne} wrap={false}>
          <Text style={st.cellule}>
            {t.urgente ? <Text style={{ color: C.urgent, fontWeight: 600 }}>Urgent — </Text> : null}
            {t.titre}
            <Text style={{ color: C.secondaire }}>
              {t.projet ? ` · ${t.projet}` : ""} · {t.domaine}
              {t.qui ? ` · ${t.qui}` : ""}
            </Text>
          </Text>
          <Text style={st.droite}>{droite(t)}</Text>
        </View>
      ))}
    </View>
  );
}

export async function pdfRapport(d: DonneesRapport, synthese: string | null, par: string): Promise<Blob> {
  enregistrerPolices();
  const titre = TITRES_RAPPORT[d.type];
  const periode = `Du ${dateFr(d.periode.debut)} au ${dateFr(d.periode.fin)}`;
  const c = d.compteurs;
  return pdf(
    <Document title={`${titre} — ${periode}`} author="XTIM SAS" language="fr">
      <Page size="A4" style={s.page}>
        <EntetePdf gauche={titre} droite={periode} />
        <Text style={s.h1}>{titre}</Text>
        <Text style={s.meta}>
          {periode} · généré le {dateFr(d.genere_le)} {par ? `par ${par}` : "automatiquement"}
          {d.filtres.domaines.length || d.filtres.projets.length ? ` · filtres : ${[...d.filtres.domaines, ...d.filtres.projets].join(", ")}` : ""}
        </Text>

        <Text style={s.h2}>Synthèse</Text>
        <Text style={synthese ? s.p : st.vide}>{synthese ?? "Synthèse rédigée indisponible (IA non configurée). Les chiffres ci-dessous sont complets."}</Text>
        <View style={st.compteurs}>
          {(
            [
              [c.realisees, "réalisées", C.fait],
              [c.creees, "créées", C.texte],
              [c.en_cours, "en cours", C.texte],
              [c.en_attente, "en attente", C.texte],
              [c.en_retard, "en retard", c.en_retard ? C.retard : C.texte],
            ] as const
          ).map(([n, l, couleur]) => (
            <View key={l} style={st.compteur}>
              <Text style={{ fontSize: 16, fontWeight: 600, color: couleur, lineHeight: 1.3 }}>{n}</Text>
              <Text style={{ color: C.secondaire, fontSize: 8.5 }}>{l}</Text>
            </View>
          ))}
        </View>

        <Text style={s.h2}>Réalisé par domaine</Text>
        {d.realise_par_domaine.length ? (
          d.realise_par_domaine.map((g) => (
            <View key={g.domaine}>
              <Text style={s.h3}>
                {g.domaine} ({g.taches.length})
              </Text>
              <Taches items={g.taches} vide="" droite={(t) => dateFr(t.done_le)} />
            </View>
          ))
        ) : (
          <Text style={st.vide}>Aucune tâche terminée sur la période.</Text>
        )}

        <Text style={s.h2}>En cours et en attente</Text>
        <Taches items={d.en_cours} vide="Rien en cours." droite={(t) => (t.echeance ? `échéance ${dateFr(t.echeance)}` : "")} />
        <Taches items={d.en_attente} vide="Rien en attente." droite={(t) => (t.en_attente_de ? `attend : ${t.en_attente_de}` : "en attente")} />

        <Text style={s.h2}>En retard</Text>
        <Taches items={d.en_retard} vide="Aucune tâche en retard." droite={(t) => `${dateFr(t.echeance)} · ${t.jours_retard} j`} />

        <Text style={s.h2}>Chine</Text>
        {!d.chine.disponible ? (
          <Text style={st.vide}>{d.chine.message}</Text>
        ) : (
          <View>
            <Text style={s.p}>
              {d.chine.evolutions
                ? `Évolutions du fichier : ${d.chine.evolutions.ajoutees} ligne(s) ajoutée(s), ${d.chine.evolutions.modifiees} modifiée(s), ${d.chine.evolutions.supprimees} supprimée(s).`
                : "Pas de version antérieure pour mesurer les évolutions."}
            </Text>
            {d.chine.evolutions?.details.map((o) => (
              <Text key={o.onglet} style={{ color: C.secondaire, marginBottom: 2 }}>
                {o.onglet} : {o.exemples.join(" ; ")}
              </Text>
            ))}
            {d.chine.message ? <Text style={st.vide}>{d.chine.message}</Text> : null}
            {d.chine.kpi.map((k) => (
              <Text key={k.devise} style={{ marginTop: 2 }}>
                {k.devise} : engagé {montantFr(k.engage, k.devise)} · payé {montantFr(k.paye, k.devise)} · reste {montantFr(k.reste, k.devise)}
              </Text>
            ))}
            {d.chine.echeances.length ? (
              <View style={{ marginTop: 6 }}>
                <Text style={s.h3}>Échéances de paiement (30 jours)</Text>
                {d.chine.echeances.map((e, i) => (
                  <View key={i} style={st.ligne} wrap={false}>
                    <Text style={{ width: 90, color: e.en_retard ? C.retard : C.texte }}>{dateFr(e.date)}</Text>
                    <Text style={st.cellule}>
                      {e.fournisseur ?? "?"} {e.po ?? ""}
                    </Text>
                    <Text style={{ width: 110, textAlign: "right" }}>{montantFr(e.montant, e.devise)}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {d.chine.livraisons_en_retard.length ? (
              <Text style={{ color: C.retard, marginTop: 4 }}>
                Livraisons en retard : {d.chine.livraisons_en_retard.map((l) => `${l.po ?? "?"} (${l.jours} j)`).join(", ")}
              </Text>
            ) : null}
          </View>
        )}

        <Text style={s.h2}>Process créés ou modifiés</Text>
        {d.process.length ? (
          d.process.map((p, i) => (
            <View key={i} style={st.ligne} wrap={false}>
              <Text style={st.cellule}>{p.titre}</Text>
              <Text style={st.droite}>
                {p.domaine} · {p.action}
              </Text>
            </View>
          ))
        ) : (
          <Text style={st.vide}>Aucun.</Text>
        )}

        <Text style={s.h2}>Documents ajoutés</Text>
        {d.documents.length ? (
          d.documents.map((x, i) => (
            <View key={i} style={st.ligne} wrap={false}>
              <Text style={st.cellule}>
                {x.nom}
                {x.categorie ? <Text style={{ color: C.secondaire }}> · {x.categorie}</Text> : null}
              </Text>
              <Text style={st.droite}>{dateFr(x.ajoute_le)}</Text>
            </View>
          ))
        ) : (
          <Text style={st.vide}>Aucun.</Text>
        )}

        <Text style={s.h2}>À venir</Text>
        <Text style={s.h3}>7 prochains jours</Text>
        <Taches items={d.a_venir.j7} vide="Rien de prévu." droite={(t) => dateFr(t.echeance)} />
        <Text style={s.h3}>Jusqu'à 30 jours</Text>
        <Taches items={d.a_venir.j30} vide="Rien de prévu." droite={(t) => dateFr(t.echeance)} />

        <PiedPdf texte={`${titre} · ${periode}`} />
      </Page>
    </Document>,
  ).toBlob();
}
