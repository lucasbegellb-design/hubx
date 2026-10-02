import { describe, expect, it } from "vitest";
import { extraireMentions, mentionEnCours, segmenterMentions } from "@shared/mentions";

const P = [
  { user_id: "l", nom: "Lucas" },
  { user_id: "e", nom: "Édwin Martin" },
];

describe("mentions", () => {
  it("reconnaît prénom et début de nom, sans accents ni casse", () => {
    expect(extraireMentions("@edwin peux-tu relancer ? cc @LUCAS et @edwin", P)).toEqual(["e", "l"]);
    expect(extraireMentions("Voir avec @EdwinM", P)).toEqual(["e"]);
    expect(extraireMentions("mail à contact@xtim.fr et @inconnu", P)).toEqual([]);
  });

  it("segmente pour l'affichage", () => {
    expect(segmenterMentions("Merci @lucas !", P)).toEqual([
      { texte: "Merci " },
      { texte: "@lucas", userId: "l" },
      { texte: " !" },
    ]);
  });

  it("détecte la mention en cours de frappe", () => {
    expect(mentionEnCours("Vu avec @ed", 11)).toEqual({ debut: 8, recherche: "ed" });
    expect(mentionEnCours("@", 1)).toEqual({ debut: 0, recherche: "" });
    expect(mentionEnCours("contact@xt", 10)).toBeNull();
  });
});
