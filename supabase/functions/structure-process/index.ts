import { json, servir } from "../_shared/http.ts";

servir(async () => json({ erreur: "Fonction pas encore implémentée." }, 501));
