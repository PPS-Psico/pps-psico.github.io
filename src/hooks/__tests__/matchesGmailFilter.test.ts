import { describe, expect, it } from "@jest/globals";
import { matchesGmailFilter, type GmailHilo } from "../useGmailHilos";

const makeHilo = (over: Partial<GmailHilo>): GmailHilo =>
  ({
    thread_id: "t1",
    asunto: null,
    estado: "leido",
    clasificacion: null,
    institucion_id: null,
    participantes: null,
    primer_mensaje_at: null,
    ultimo_mensaje_at: null,
    ultimo_mensaje_de: null,
    ...over,
  }) as GmailHilo;

const daysAgo = (n: number) => new Date(Date.now() - n * 86400 * 1000).toISOString();

describe("matchesGmailFilter", () => {
  it("excluye hilos archivados o en papelera en cualquier filtro", () => {
    expect(matchesGmailFilter(makeHilo({ estado: "archivado" }), "todos")).toBe(false);
    expect(matchesGmailFilter(makeHilo({ estado: "trash" }), "todos")).toBe(false);
    expect(matchesGmailFilter(makeHilo({ estado: "archivado" }), "esperando")).toBe(false);
  });

  it("'todos' acepta cualquier hilo no archivado", () => {
    expect(matchesGmailFilter(makeHilo({ estado: "leido" }), "todos")).toBe(true);
    expect(matchesGmailFilter(makeHilo({ estado: "esperando_respuesta" }), "todos")).toBe(true);
  });

  it("'esperando' solo acepta los que esperan respuesta", () => {
    expect(matchesGmailFilter(makeHilo({ estado: "esperando_respuesta" }), "esperando")).toBe(true);
    expect(matchesGmailFilter(makeHilo({ estado: "leido" }), "esperando")).toBe(false);
  });

  describe("'esperando5d'", () => {
    it("acepta respondidos por nosotros hace más de 5 días", () => {
      const h = makeHilo({ estado: "respondido_por_nos", ultimo_mensaje_at: daysAgo(6) });
      expect(matchesGmailFilter(h, "esperando5d")).toBe(true);
    });

    it("rechaza respondidos por nosotros hace menos de 5 días", () => {
      const h = makeHilo({ estado: "respondido_por_nos", ultimo_mensaje_at: daysAgo(2) });
      expect(matchesGmailFilter(h, "esperando5d")).toBe(false);
    });

    it("rechaza si el estado no es 'respondido_por_nos'", () => {
      const h = makeHilo({ estado: "esperando_respuesta", ultimo_mensaje_at: daysAgo(10) });
      expect(matchesGmailFilter(h, "esperando5d")).toBe(false);
    });

    it("rechaza si no hay fecha de último mensaje", () => {
      const h = makeHilo({ estado: "respondido_por_nos", ultimo_mensaje_at: null });
      expect(matchesGmailFilter(h, "esperando5d")).toBe(false);
    });
  });
});
