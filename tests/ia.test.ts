import { describe, expect, it } from "vitest";
import {
  conformer,
  construireCorps,
  exempleSchema,
  extraireJson,
  fournisseur,
  FOURNISSEURS,
  lireReponse,
  messageErreurIa,
  refusModeJson,
  urlApiValide,
  urlCompletions,
  type Schema,
} from "@shared/ia";

const ANALYSE: Schema = {
  type: "object",
  additionalProperties: false,
  required: ["categorie", "resume", "infos_cles", "taches_suggerees", "domaine_suggere"],
  properties: {
    categorie: { type: "string", enum: ["Facture", "Devis", "Autre"] },
    resume: { type: "string" },
    infos_cles: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["libelle", "valeur"],
        properties: { libelle: { type: "string" }, valeur: { type: "string" } },
      },
    },
    taches_suggerees: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titre", "echeance"],
        properties: {
          titre: { type: "string" },
          echeance: { anyOf: [{ type: "string", format: "date" }, { type: "null" }] },
        },
      },
    },
    domaine_suggere: { anyOf: [{ type: "string", enum: ["Commercial", "Compta"] }, { type: "null" }] },
  },
};

describe("fournisseurs", () => {
  it("propose Mistral par défaut et retombe dessus pour un identifiant inconnu", () => {
    expect(FOURNISSEURS[0].id).toBe("mistral");
    expect(fournisseur("inconnu").id).toBe("mistral");
    expect(fournisseur("deepseek").nom).toBe("DeepSeek");
    for (const f of FOURNISSEURS.filter((x) => x.id !== "autre")) {
      expect(urlApiValide(f.url)).toBe(true);
      expect(f.modeles.map((m) => m.id)).toContain(f.modeleDefaut);
    }
  });

  it("valide les adresses d'API", () => {
    expect(urlApiValide("https://openrouter.ai/api/v1")).toBe(true);
    expect(urlApiValide("http://localhost:11434/v1")).toBe(true);
    expect(urlApiValide("http://exemple.com/v1")).toBe(false);
    expect(urlApiValide("ftp://exemple.com")).toBe(false);
    expect(urlApiValide("https://")).toBe(false);
    expect(urlCompletions("https://api.mistral.ai/v1/")).toBe("https://api.mistral.ai/v1/chat/completions");
    expect(urlCompletions("https://x.io/v1/chat/completions")).toBe("https://x.io/v1/chat/completions");
  });
});

describe("requête", () => {
  const base = {
    modele: "m",
    system: "Consigne",
    schema: ANALYSE,
    maxTokens: 50_000,
    fournisseur: fournisseur("deepseek"),
    modeJson: true,
  };

  it("envoie le texte seul en chaîne, le schéma dans la consigne et plafonne la sortie", () => {
    const c = construireCorps({
      ...base,
      contenu: [
        { type: "texte", texte: "A" },
        { type: "texte", texte: "B" },
      ],
    });
    const messages = c.messages as { role: string; content: unknown }[];
    expect(messages[1].content).toBe("A\n\nB");
    expect(String(messages[0].content)).toContain('"categorie"');
    expect(String(messages[0].content)).toContain("JSON");
    expect(c.max_tokens).toBe(8_000);
    expect(c.response_format).toEqual({ type: "json_object" });
    expect(construireCorps({ ...base, contenu: "x", modeJson: false }).response_format).toBeUndefined();
  });

  it("envoie images et PDF en morceaux multimodaux", () => {
    const c = construireCorps({
      ...base,
      fournisseur: fournisseur("mistral"),
      contenu: [
        { type: "pdf", base64: "UERG" },
        { type: "image", mime: "image/png", base64: "SU1H" },
        { type: "texte", texte: "Analyse" },
      ],
    });
    expect((c.messages as { content: unknown }[])[1].content).toEqual([
      { type: "document_url", document_url: "data:application/pdf;base64,UERG" },
      { type: "image_url", image_url: { url: "data:image/png;base64,SU1H" } },
      { type: "text", text: "Analyse" },
    ]);
  });

  it("ajoute la réponse fautive et les défauts lors d'une relance", () => {
    const c = construireCorps({ ...base, contenu: "x", relance: { reponse: "{oups", erreurs: ["réponse illisible"] } });
    const messages = c.messages as { role: string; content: string }[];
    expect(messages.map((m) => m.role)).toEqual(["system", "user", "assistant", "user"]);
    expect(messages[3].content).toContain("réponse illisible");
  });

  it("produit un exemple de forme depuis le schéma", () => {
    expect(exempleSchema(ANALYSE)).toEqual({
      categorie: "Facture",
      resume: "…",
      infos_cles: [{ libelle: "…", valeur: "…" }],
      taches_suggerees: [{ titre: "…", echeance: "2026-01-31" }],
      domaine_suggere: "Commercial",
    });
  });
});

describe("réponse", () => {
  it("lit le texte et la raison d'arrêt", () => {
    expect(lireReponse({ choices: [{ message: { content: "{}" }, finish_reason: "stop" }] })).toEqual({
      texte: "{}",
      fin: "stop",
    });
    expect(lireReponse({ choices: [{ message: { content: [{ type: "text", text: "a" }, "b"] } }] }).texte).toBe("ab");
    expect(lireReponse(null)).toEqual({ texte: "", fin: null });
  });

  it("extrait le JSON malgré le raisonnement, les blocs de code ou le texte autour", () => {
    expect(extraireJson('{"a":1}')).toEqual({ a: 1 });
    expect(extraireJson('<think>je réfléchis {x}</think>\n{"a":2}')).toEqual({ a: 2 });
    expect(extraireJson('Voici :\n```json\n{"a":3}\n```')).toEqual({ a: 3 });
    expect(extraireJson('Résultat : {"a":{"b":4}} fin')).toEqual({ a: { b: 4 } });
    expect(() => extraireJson("pas de json")).toThrow();
  });
});

describe("mise en conformité", () => {
  it("corrige ce qui est sans risque", () => {
    const r = conformer(
      {
        categorie: "facture",
        resume: "Facture Ningbo",
        infos_cles: [{ libelle: "Montant", valeur: 4800, en_trop: true }, "invalide", { libelle: "Seul" }],
        taches_suggerees: [
          { titre: "Payer", echeance: "15/10/2026" },
          { titre: "Archiver", echeance: "" },
          { titre: "Relancer", echeance: "bientôt" },
        ],
        domaine_suggere: "compta",
        bavardage: "…",
      },
      ANALYSE,
    );
    expect(r.erreurs).toEqual([]);
    expect(r.valeur).toEqual({
      categorie: "Facture",
      resume: "Facture Ningbo",
      infos_cles: [{ libelle: "Montant", valeur: "4800" }],
      taches_suggerees: [
        { titre: "Payer", echeance: "2026-10-15" },
        { titre: "Archiver", echeance: null },
        { titre: "Relancer", echeance: null },
      ],
      domaine_suggere: "Compta",
    });
  });

  it("complète les champs absents quand c'est sûr et ramène une catégorie inconnue à « Autre »", () => {
    const r = conformer({ categorie: "Bon de livraison", resume: "R", infos_cles: null }, ANALYSE);
    expect(r.erreurs).toEqual([]);
    expect(r.valeur).toMatchObject({ categorie: "Autre", infos_cles: [], taches_suggerees: [], domaine_suggere: null });
  });

  it("déballe une réponse enveloppée", () => {
    const r = conformer(
      { resultat: { categorie: "Devis", resume: "R", infos_cles: [], taches_suggerees: [] } },
      ANALYSE,
    );
    expect(r.erreurs).toEqual([]);
    expect(r.valeur).toMatchObject({ categorie: "Devis", domaine_suggere: null });
  });

  it("signale une réponse hors sujet (déclenche une nouvelle tentative)", () => {
    expect(conformer({ texte: "Je ne peux pas" }, ANALYSE).erreurs.length).toBeGreaterThan(0);
    expect(conformer([], ANALYSE).erreurs).toEqual(["réponse doit être un objet"]);
    const synthese: Schema = { type: "object", required: ["synthese"], properties: { synthese: { type: "string" } } };
    expect(conformer({}, synthese).erreurs.length).toBe(1);
    expect(conformer({ synthese: "Semaine calme." }, synthese)).toEqual({
      valeur: { synthese: "Semaine calme." },
      erreurs: [],
    });
  });
});

describe("erreurs du fournisseur", () => {
  const f = { nom: "Mistral AI", modele: "mistral-small-latest" };
  it("traduit les codes HTTP en messages lisibles", () => {
    expect(messageErreurIa(401, "", f)).toContain("Clé API refusée par Mistral AI");
    expect(messageErreurIa(402, "", f)).toContain("Crédit");
    expect(messageErreurIa(429, "", f)).toContain("Limite d'utilisation");
    expect(messageErreurIa(404, "", f)).toContain("introuvable");
    expect(messageErreurIa(400, '{"message":"Invalid model: mistral-xl"}', f)).toContain("introuvable");
    expect(messageErreurIa(400, "image_url is not supported", f)).toContain("ne lit pas ce type de fichier");
    expect(messageErreurIa(503, "", f)).toContain("indisponible");
  });

  it("repère un service qui refuse le mode JSON", () => {
    expect(refusModeJson(400, "response_format is not supported")).toBe(true);
    expect(refusModeJson(400, "bad request")).toBe(false);
    expect(refusModeJson(500, "response_format")).toBe(false);
  });
});
