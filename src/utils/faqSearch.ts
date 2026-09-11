import { Children, isValidElement, type ReactNode } from "react";

// Index only the approved text, including answers written with JSX.
export function faqText(node: ReactNode): string {
  return Children.toArray(node)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") return String(child);
      return isValidElement<{ children?: ReactNode }>(child) ? faqText(child.props.children) : "";
    })
    .join(" ");
}

const stopWords = new Set(
  "a al algo ante como con cual cuando de del donde el ella en es esta este estoy fue hacer hay la las le lo los me mi mis no o para pero por porque puedo que quien se si sin solo soy su sus tengo tiene un una uno unos y ya pps practica practicas quiero necesito saber".split(
    " "
  )
);

const concepts = [
  ["contrasena", "clave", "password"],
  ["recuperar", "recupero", "olvide", "olvidada", "olvide", "restablecer"],
  [
    "inscripcion",
    "inscribirme",
    "inscribo",
    "inscribirte",
    "inscribi",
    "anotarme",
    "anotarse",
    "anote",
    "anotado",
    "postularme",
  ],
  ["baja", "abandonar", "renunciar", "cancelar", "dejar", "retirarme"],
  ["informal", "negro"],
  ["laboral", "trabajo", "trabajar", "empleo"],
  ["correo", "mail", "email"],
  ["informe", "informes", "reporte"],
  ["planilla", "planillas", "asistencia"],
  ["certificado", "constancia", "comprobante"],
  ["entregar", "entrega", "entrego", "subir", "adjuntar"],
  ["correccion", "corregido", "corregir", "corrigen", "corrigieron", "corregida"],
  ["acreditacion", "acreditar", "acreditada", "acreditan"],
  ["hora", "horas", "hs"],
  ["orientacion", "orientaciones", "area", "areas"],
  ["rotacion", "rotar", "rotando"],
  ["falta", "faltan", "faltantes", "restan", "quedan"],
  ["finalizar", "finalizacion", "terminar", "termine", "terminado", "finalizado"],
  ["prorroga", "extension", "extender", "extenderme"],
  ["seleccionado", "seleccionada", "convocado", "convocada"],
  ["consentimiento", "compromiso", "confirmar", "confirmacion", "firmar"],
];
const aliases = new Map(
  concepts.flatMap((group) => group.map((word) => [word, group[0]] as const))
);

export function normalizeFaqText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(value: string): string[] {
  return [
    ...new Set(
      normalizeFaqText(value)
        .split(" ")
        .filter((word) => word && !stopWords.has(word))
    ),
  ];
}

// One insertion, deletion, substitution or adjacent transposition. Short words
// and numbers must match exactly to avoid confusing 70, 80 and 250 hours.
function isSmallTypo(a: string, b: string): boolean {
  if (a.length < 4 || b.length < 4 || /\d/.test(a + b) || Math.abs(a.length - b.length) > 1)
    return false;
  if (a.length === b.length) {
    const differences = [...a]
      .map((char, index) => (char === b[index] ? -1 : index))
      .filter((index) => index >= 0);
    return (
      differences.length === 1 ||
      (differences.length === 2 &&
        differences[1] === differences[0] + 1 &&
        a[differences[0]] === b[differences[1]] &&
        a[differences[1]] === b[differences[0]])
    );
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let index = 0;
  while (index < short.length && short[index] === long[index]) index++;
  return short.slice(index) === long.slice(index + 1);
}

function similarity(query: string, word: string): number {
  if (query === word) return 1;
  if ((aliases.get(query) ?? query) === (aliases.get(word) ?? word)) return 0.85;
  if (query.length >= 4 && word.startsWith(query) && !/\d/.test(query)) return 0.7;
  return isSmallTypo(query, word) ? 0.6 : 0;
}

export function createFaqSearchIndex<T extends { q: string; a: ReactNode }>(items: T[]) {
  return items.map((item) => ({ item, title: tokens(item.q), answer: tokens(faqText(item.a)) }));
}

export function searchFaq<T extends { q: string; a: ReactNode }>(
  index: ReturnType<typeof createFaqSearchIndex<T>>,
  query: string
): T[] {
  const queryTokens = tokens(query);
  const remainingHours =
    queryTokens.some((word) => /^(faltan|restan|quedan)$/.test(word)) &&
    queryTokens.some((word) => (aliases.get(word) ?? word) === "hora");
  const terms = queryTokens.filter((word) => !remainingHours || !/^\d+$/.test(word)).slice(0, 20);
  if (!terms.length) return [];
  return index
    .map((entry, position) => {
      let matched = 0;
      let score = 0;
      let missingNumber = false;
      for (const term of terms) {
        const title = Math.max(0, ...entry.title.map((word) => similarity(term, word)));
        const answer = Math.max(0, ...entry.answer.map((word) => similarity(term, word)));
        if (title || answer) matched++;
        else if (/^\d+$/.test(term)) missingNumber = true;
        score += title * 5 + answer;
      }
      const relevant = !missingNumber && matched / terms.length >= 0.6;
      return { item: entry.item, position, score: relevant ? (score * matched) / terms.length : 0 };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.position - b.position)
    .map((entry) => entry.item);
}
