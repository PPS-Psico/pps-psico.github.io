const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const WIDTH = 1080;
const HEIGHT = 1350;
const OUT = path.resolve("output", "balance-pps-enero-julio-2026");

fs.mkdirSync(OUT, { recursive: true });

const palette = {
  ink: "#17213A",
  paper: "#F5F2EA",
  white: "#FFFDF8",
  blue: "#5673E8",
  mint: "#5FC6B7",
  coral: "#F07E62",
  violet: "#9A7AD8",
  yellow: "#EDC95E",
  muted: "#687087",
  rule: "#DAD7CE",
};

// Fuente de verdad: src/styles/orientation-colors.css
const orientationColors = {
  clinica: "#3CB88D",
  laboral: "#C23B3F",
  educacional: "#203B73",
  comunitaria: "#7A3F9E",
};

const esc = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const text = (x, y, value, size, weight = 500, fill = palette.ink, anchor = "start", extra = "") =>
  `<text x="${x}" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}" ${extra}>${esc(value)}</text>`;

const line = (x1, y1, x2, y2, stroke = palette.rule, width = 2, dash = "") =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}" ${dash ? `stroke-dasharray="${dash}"` : ""}/>`;

const rect = (x, y, w, h, fill, radius = 0, stroke = "none", strokeWidth = 0) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${radius}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

const circle = (cx, cy, r, fill) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

const base = (number, kicker, body) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  ${rect(0, 0, WIDTH, HEIGHT, palette.paper)}
  ${circle(1000, 62, 122, "#E9E5DA")}
  ${text(72, 82, "MI PANEL ACADÉMICO  ·  PPS", 22, 700, palette.blue, "start", 'letter-spacing="2.4"')}
  ${text(1008, 82, String(number).padStart(2, "0"), 28, 800, palette.ink, "end")}
  ${line(72, 110, 1008, 110, palette.ink, 2)}
  ${text(72, 154, kicker.toUpperCase(), 18, 700, palette.muted, "start", 'letter-spacing="2.8"')}
  ${body}
  ${line(72, 1270, 1008, 1270, palette.rule, 2)}
  ${text(72, 1312, "UFLO  ·  LIC. EN PSICOLOGÍA", 17, 700, palette.muted, "start", 'letter-spacing="1.4"')}
  ${text(1008, 1312, "BALANCE 2026", 17, 700, palette.muted, "end", 'letter-spacing="1.4"')}
</svg>`;

const card1 = base(
  1,
  "Enero — julio de 2026",
  `
  ${text(72, 238, "Más oportunidades,", 68, 760)}
  ${text(72, 312, "en distintos formatos", 68, 760)}
  ${rect(72, 372, 936, 278, palette.ink, 32)}
  ${text(126, 510, "42", 126, 800, palette.white)}
  ${text(126, 561, "CONVOCATORIAS", 22, 800, palette.mint, "start", 'letter-spacing="2.1"')}
  ${line(438, 416, 438, 606, "#3A4664", 2)}
  ${text(496, 510, "500", 126, 800, palette.white)}
  ${text(496, 561, "REGISTROS EN TOTAL", 22, 800, "#D9FFF9", "start", 'letter-spacing="2.1"')}
  ${text(496, 603, "entre cupos y participaciones", 22, 500, "#D8DEEE")}
  ${rect(72, 694, 936, 390, palette.white, 28, palette.rule, 2)}
  ${text(108, 754, "DOS FORMATOS DE PROPUESTA", 18, 800, palette.muted, "start", 'letter-spacing="2.4"')}
  ${rect(108, 792, 410, 210, "#E7EAF8", 24)}
  ${text(142, 878, "251", 72, 800, palette.blue)}
  ${text(142, 922, "CUPOS CON LÍMITE", 20, 800, palette.ink, "start", 'letter-spacing="1.4"')}
  ${text(142, 962, "en 37 convocatorias", 21, 600, palette.muted)}
  ${rect(542, 792, 430, 210, "#E5F5F1", 24)}
  ${text(576, 878, "249", 72, 800, orientationColors.clinica)}
  ${text(576, 922, "PARTICIPACIONES", 20, 800, palette.ink, "start", 'letter-spacing="1.4"')}
  ${text(576, 962, "en 5 PPS sin cupo", 21, 600, palette.muted)}
  ${rect(72, 1110, 936, 86, palette.blue, 22)}
  ${text(104, 1165, "7 meses consecutivos con nuevas oportunidades", 27, 750, palette.white)}
  `
);

const months = [
  ["ENE", 3, 12],
  ["FEB", 8, 127],
  ["MAR", 6, 89],
  ["ABR", 8, 152],
  ["MAY", 5, 28],
  ["JUN", 7, 48],
  ["JUL", 5, 44],
];

const limitedCapacityMonths = [
  ["ENE", 12],
  ["FEB", 26],
  ["MAR", 20],
  ["ABR", 73],
  ["MAY", 28],
  ["JUN", 48],
  ["JUL", 44],
];

const maxLimitedCapacity = 73;
const bars = limitedCapacityMonths
  .map(([month, places], index) => {
    const y = 428 + index * 72;
    const width = Math.max(18, Math.round((places / maxLimitedCapacity) * 620));
    return `
      ${text(72, y + 27, month, 22, 800, palette.ink)}
      ${rect(162, y, 620, 38, "#E3E0D7", 19)}
      ${rect(162, y, width, 40, palette.blue, 20)}
      ${text(820, y + 28, places, 24, 800, palette.ink)}
      ${text(866, y + 27, "cupos", 19, 600, palette.muted)}
    `;
  })
  .join("");

const card2 = base(
  2,
  "Capacidad mensual comparable",
  `
  ${text(72, 238, "Cupos disponibles", 68, 760)}
  ${text(72, 312, "mes a mes", 68, 760)}
  ${rect(72, 348, 936, 58, palette.white, 18)}
  ${text(100, 386, "PPS CON CUPO PREFIJADO", 19, 800, palette.blue, "start", 'letter-spacing="2.2"')}
  ${text(980, 386, "251 CUPOS EN TOTAL", 19, 800, palette.ink, "end", 'letter-spacing="1.3"')}
  ${bars}
  ${rect(72, 952, 936, 258, palette.ink, 28)}
  ${text(108, 1006, "ADEMÁS: 5 PPS SIN CUPO PREFIJADO", 18, 800, palette.mint, "start", 'letter-spacing="2.1"')}
  ${text(108, 1050, "249 participaciones registradas", 28, 750, palette.white)}
  ${line(108, 1080, 972, 1080, "#3A4664", 2)}
  ${text(170, 1124, "FEB", 17, 800, "#D8DEEE", "middle", 'letter-spacing="1.6"')}
  ${text(170, 1164, "2 PPS · 101", 23, 800, palette.white, "middle")}
  ${line(354, 1104, 354, 1176, "#3A4664", 2)}
  ${text(540, 1124, "MAR", 17, 800, "#D8DEEE", "middle", 'letter-spacing="1.6"')}
  ${text(540, 1164, "1 PPS · 69", 23, 800, palette.white, "middle")}
  ${line(726, 1104, 726, 1176, "#3A4664", 2)}
  ${text(910, 1124, "ABR", 17, 800, "#D8DEEE", "middle", 'letter-spacing="1.6"')}
  ${text(910, 1164, "2 PPS · 79", 23, 800, palette.white, "middle")}
  `
);

const institutions = [
  {
    n: "01",
    name: ["Ministerio de Juventud,", "Deportes y Cultura"],
    orientation: "EDUCACIONAL",
    offers: "3 OFERTAS",
    places: "50 LUGARES",
    color: orientationColors.educacional,
  },
  {
    n: "02",
    name: ["Refugio Gabriel Brochero"],
    orientation: "CLÍNICA",
    offers: "1 OFERTA",
    places: "6 LUGARES",
    color: orientationColors.clinica,
  },
  {
    n: "03",
    name: ["Subsecretaría de Emergencias", "y Gestión de Riesgos"],
    orientation: "COMUNITARIA",
    offers: "1 OFERTA",
    places: "6 LUGARES",
    color: orientationColors.comunitaria,
  },
  {
    n: "04",
    name: ["Human Res"],
    orientation: "LABORAL",
    offers: "1 OFERTA",
    places: "2 LUGARES",
    color: orientationColors.laboral,
  },
];

const institutionCards = institutions
  .map((item, index) => {
    const y = 408 + index * 182;
    return `
      ${rect(72, y, 936, 154, palette.white, 24, palette.rule, 2)}
      ${rect(72, y, 14, 154, item.color, 7)}
      ${text(116, y + 52, item.n, 25, 800, item.color)}
      ${text(180, y + 50, item.name[0], 27, 750)}
      ${item.name[1] ? text(180, y + 82, item.name[1], 27, 750) : ""}
      ${text(180, y + 119, item.orientation, 17, 800, palette.muted, "start", 'letter-spacing="1.9"')}
      ${text(964, y + 55, item.offers, 18, 800, palette.ink, "end")}
      ${text(964, y + 98, item.places, 24, 800, item.color, "end")}
    `;
  })
  .join("");

const card3 = base(
  3,
  "Convenios incorporados en 2026",
  `
  ${text(72, 238, "4 instituciones nuevas", 68, 760)}
  ${text(72, 312, "se sumaron a las PPS", 68, 760)}
  ${rect(72, 344, 936, 44, palette.ink, 14)}
  ${text(100, 374, "6 OFERTAS  ·  64 LUGARES REGISTRADOS", 20, 800, palette.white, "start", 'letter-spacing="1.5"')}
  ${institutionCards}
  `
);

const orientations = [
  ["CLÍNICA", 21, orientationColors.clinica],
  ["LABORAL", 8, orientationColors.laboral],
  ["EDUCACIONAL", 8, orientationColors.educacional],
  ["COMUNITARIA", 5, orientationColors.comunitaria],
];

const orientationBars = orientations
  .map(([label, value, color], index) => {
    const y = 376 + index * 78;
    const width = Math.round((value / 21) * 510);
    return `
      ${text(72, y + 25, label, 19, 800, palette.ink)}
      ${rect(268, y, 510, 34, "#E3E0D7", 17)}
      ${rect(268, y, width, 34, color, 17)}
      ${text(826, y + 26, value, 25, 800, palette.ink)}
      ${text(858, y + 25, value === 1 ? "oferta" : "ofertas", 19, 600, palette.muted)}
    `;
  })
  .join("");

const card4 = base(
  4,
  "Orientaciones y novedades",
  `
  ${text(72, 238, "Distintas formas", 68, 760)}
  ${text(72, 312, "de construir experiencia", 68, 760)}
  ${orientationBars}
  ${rect(72, 724, 936, 428, palette.ink, 34)}
  ${rect(112, 772, 104, 104, palette.blue, 26)}
  ${text(164, 840, "↗", 54, 700, palette.white, "middle")}
  ${text(248, 798, "NUEVO DISEÑO", 18, 800, palette.mint, "start", 'letter-spacing="2.5"')}
  ${text(248, 852, "Campus PPS", 48, 800, palette.white)}
  ${text(112, 942, "Una experiencia más clara, visual y ordenada", 30, 650, palette.white)}
  ${text(112, 982, "para acompañarte en cada etapa de tu práctica.", 30, 650, palette.white)}
  ${line(112, 1032, 968, 1032, "#3A4664", 2)}
  ${text(112, 1090, "Ingresá al campus y conocé el nuevo diseño.", 24, 650, "#D8DEEE")}
  `
);

const cards = [
  ["01-balance-general.png", card1],
  ["02-evolucion-mensual.png", card2],
  ["03-nuevos-convenios.png", card3],
  ["04-orientaciones-campus.png", card4],
];

async function main() {
  for (const [filename, svg] of cards) {
    const svgPath = path.join(OUT, filename.replace(".png", ".svg"));
    fs.writeFileSync(svgPath, svg, "utf8");
    await sharp(Buffer.from(svg)).png({ quality: 100, compressionLevel: 9 }).toFile(path.join(OUT, filename));
  }

  const manifest = {
    title: "Balance PPS · Enero a julio de 2026",
    format: "WhatsApp portrait image series",
    dimensions: { width: WIDTH, height: HEIGHT, unit: "px", aspectRatio: "4:5" },
    exports: cards.map(([filename]) => filename),
    sourceMetrics: {
      period: "Enero–julio de 2026",
      offers: 42,
      registeredPlacesAndParticipations: 500,
      monthly: months.map(([month, offers, records]) => ({ month, offers, records })),
      limitedCapacityMonthly: limitedCapacityMonths.map(([month, places]) => ({
        month,
        places,
      })),
      unlimitedParticipation: [
        { month: "FEB", offers: 2, participants: 101 },
        { month: "MAR", offers: 1, participants: 69 },
        { month: "ABR", offers: 2, participants: 79 },
      ],
      orientations: orientations.map(([orientation, offers]) => ({ orientation, offers })),
      newAgreements: institutions.map(({ name, orientation, offers, places }) => ({
        institution: name.join(" "),
        orientation,
        offers,
        places,
      })),
    },
    provenance:
      "Contenido suministrado por el usuario. Composición SVG determinista y exportación PNG mediante Sharp; no se utilizó IA generativa para cifras ni textos.",
    note:
      "El total de 500 combina lugares registrados y participaciones en propuestas sin cupo prefijado, según el detalle fuente.",
  };
  fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
