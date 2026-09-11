import React from "react";
import { createFaqSearchIndex, faqText, searchFaq } from "../faqSearch";

const index = createFaqSearchIndex([
  { q: "¿Cómo recupero mi contraseña?", a: "Elegí ¿Olvidaste tu contraseña? e ingresá tu legajo." },
  {
    q: "¿Qué presento si trabajo de manera informal?",
    a: "Podés presentar una declaración jurada.",
  },
  { q: "¿Cómo doy de baja una PPS?", a: "Solicitá la baja y avisá a la institución." },
  {
    q: "Me faltan pocas horas: ¿puedo hacer parte de una PPS?",
    a: "Completá el recorrido aunque superes las 250 horas.",
  },
  {
    q: "¿Cuántas horas de especialidad necesito?",
    a: (
      <>
        Al menos <strong>70 horas</strong> en tu orientación.
      </>
    ),
  },
  {
    q: "¿Cómo entrego el informe?",
    a: (
      <>
        Subí el informe junto con la <strong>planilla firmada</strong>.
      </>
    ),
  },
]);

describe("FAQ search", () => {
  it.each([
    ["OLVIDÉ mi CLAVE", "¿Cómo recupero mi contraseña?"],
    ["trabajo en negro", "¿Qué presento si trabajo de manera informal?"],
    ["quiero abandonar la practica", "¿Cómo doy de baja una PPS?"],
    ["contrsaena", "¿Cómo recupero mi contraseña?"],
    ["me faltan 6 hs", "Me faltan pocas horas: ¿puedo hacer parte de una PPS?"],
    ["planilla firmada", "¿Cómo entrego el informe?"],
    ["70 horas", "¿Cuántas horas de especialidad necesito?"],
  ])("finds the relevant answer for %s", (query, expected) => {
    expect(searchFaq(index, query)[0]?.q).toBe(expected);
  });

  it.each(["", "   ", "¿?!", "como puedo", "astronautas galaxias", "80 horas"])(
    "does not fabricate matches for %s",
    (query) => {
      expect(searchFaq(index, query)).toEqual([]);
    }
  );

  it("extracts nested JSX and numeric text without HTML or object strings", () => {
    expect(
      faqText(
        <>
          Son <strong>{30} días</strong>
          <span> corridos.</span>
        </>
      )
    ).toBe("Son  30  días  corridos.");
  });

  it("ranks title matches above incidental mentions in answers", () => {
    const entries = createFaqSearchIndex([
      { q: "¿Cómo consulto?", a: "Podés preguntar por la planilla." },
      { q: "¿Dónde entrego la planilla?", a: "Junto con tu informe." },
    ]);
    expect(searchFaq(entries, "planilla")[0].q).toBe(entries[1].item.q);
  });
});
