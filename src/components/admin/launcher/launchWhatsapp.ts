/**
 * launchWhatsapp — Construcción del mensaje de difusión de WhatsApp y del
 * prompt de extracción con IA. Aislado de la UI para mantener el componente
 * del Lanzador enfocado en presentación.
 */
import { formatDate, normalizeStringForComparison } from "../../../utils/formatters";
import type { FormData, ScheduleEntry } from "./launchForm.types";

/** Prompt de extracción con IA a partir de material crudo del convenio/programa. */
export function buildAIExtractionPrompt(rawText: string): string {
  const sanitizedText = rawText.replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r");

  return `
Actúa como un experto en redacción de convocatorias universitarias y diseño UX.
Objetivo: Generar contenido para una tarjeta visualmente equilibrada y detectar información técnica, logística y de horarios con comisiones.

Instrucciones de Diseño y Extracción:
1. **Descripción Temática**: Genera una descripción profesional de 300-450 caracteres enfocada EXCLUSIVAMENTE en la propuesta técnica y el rol formativo.
   - PROHIBIDO incluir: dirección física, modalidad (presencial/virtual), duración, cantidad de cupos, horas acreditadas o fechas. Esta información ya aparece en otros campos.
   - ENFÓCATE EN: El propósito de la práctica, el enfoque institucional (ej: abordaje de consumos), la población atendida y lo que el estudiante aprenderá o aportará.
2. **Actividades Impactantes**: Genera MÁXIMO 4 items para la lista de actividades. Selecciona las más representativas. Si el texto original tiene muchas más, sintetízalas narrativamente en el campo de "Descripción Temática".
3. **Detección de Dirección**: Busca la dirección física o modalidad (ej: "Modalidad Virtual").
4. **Detección de Orientaciones**: Identifica todas las orientaciones mencionadas (Clínica, Jurídica, Educacional, Comunitaria, Laboral, etc).
5. **Comisiones y Horarios**: Sé extremadamente minucioso.
   - Si se mencionan "Comisiones" o "Grupos", incluye el nombre de la comisión en el texto del horario.
   - Formato esperado para texto: "Comisión [Nombre]: [Día y Horario]".
   - Si una comisión específica tiene una orientación asignada diferente a las demás, identifícala.

Información Cruda: ${sanitizedText}

Genera un objeto JSON con:
1. "descripcion": Texto narrativo.
2. "actividades": Array de strings (max 4).
3. "actividadesLabel": Título dinámico.
4. "orientaciones": Array de strings con las orientaciones detectadas.
5. "horarios": Array de objetos [{ "texto": "Nombre Comisión: Horario", "orientacion_vinculada": "Orientación si existe" }].
6. "direccion": Dirección detectada.
7. "requisitoObligatorio": Cualquier requisito excluyente.

Responde SOLO con el JSON válido.
`;
}

/** Limpia el bloque ```json``` que a veces devuelve el modelo. */
export function cleanGeminiJson(text: string): string {
  return text
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
}

interface BuildWhatsappArgs {
  formData: FormData;
  schedules: ScheduleEntry[];
  isMultiOrientation: boolean;
}

/** Arma el posteo de WhatsApp listo para pegar en los grupos. */
export function buildWhatsappMessage({
  formData,
  schedules,
  isMultiOrientation,
}: BuildWhatsappArgs): string {
  const safeOrientacion = Array.isArray(formData.orientacion) ? formData.orientacion : [];
  const validSchedules = schedules.filter((s) => s.time && s.time.trim());

  let message = `📢 *¡Nueva Convocatoria PPS: ${formData.nombrePPS || "Nueva Convocatoria"}!* 📢

✨ *Institución:* ${formData.nombrePPS || ""}
📍 *Lugar:* ${formData.direccion || "A confirmar"}

🎯 *Objetivo:* ${formData.descripcion || ""}

📅 *Horarios*:`;

  const formatScheduleLine = (s: ScheduleEntry) => {
    const time = s.time.trim();
    const orient = isMultiOrientation && s.orientacion ? ` [${s.orientacion}]` : "";
    return `${time}${orient}`;
  };

  if (validSchedules.length > 0) {
    message +=
      "\n" +
      validSchedules
        .map(
          (schedule) =>
            `• ${formatScheduleLine(schedule)}${
              schedule.obligatorio ? " — *obligatorio para todos*" : " — a elección"
            }`
        )
        .join("\n");
  } else {
    message += " A confirmar";
  }

  if (formData.fechaEncuentroInicial) {
    const encuentroDate = new Date(formData.fechaEncuentroInicial);
    const fechaStr = formatDate(formData.fechaEncuentroInicial);
    const hours = encuentroDate.getHours();
    const minutes = encuentroDate.getMinutes();
    const horaStr =
      hours || minutes
        ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} hs`
        : "";
    message += `

🤝 *Encuentro Inicial Obligatorio:* ${fechaStr}${horaStr ? ` a las ${horaStr}` : ""}
⚠️ Es obligatorio para todos los inscriptos`;
  }

  message += `

📋 *Período de Prácticas:* ${formatDate(formData.fechaInicio)}${formData.fechaFin ? ` al ${formatDate(formData.fechaFin)}` : ""} (aprox.)
📋 *Inscripción:* ${
    formData.fechaInicioInscripcion && formData.fechaFinInscripcion
      ? `Desde ${formatDate(formData.fechaInicioInscripcion)} hasta ${formatDate(formData.fechaFinInscripcion)}`
      : "Consultar en Campus"
  }

👥 *Cupos:* ${formData.cuposDisponibles}

⏱️ *Acredita:* ${formData.horasAcreditadas === 0 ? "Según recorrido" : `${formData.horasAcreditadas} horas`} de ${safeOrientacion.join(", ") || ""}`;

  if (formData.reqCertificadoTrabajo || formData.reqCv) {
    const reqList: string[] = [];
    if (formData.reqCertificadoTrabajo)
      reqList.push("Se va a priorizar a estudiantes que trabajen");
    if (formData.reqCv) reqList.push("Requisito cargar CV actualizado");
    message += "\n📎 *Requisitos:* " + reqList.join(" • ");
  }

  if (formData.requisitoObligatorio) {
    message += `\n📜 *Requisito:* ${formData.requisitoObligatorio}`;
  }

  message += `

💡 *Para inscribirte, completa el formulario en Mi Panel:*`;

  return message;
}

/** Mensaje corto de WhatsApp para el historial (re-difusión rápida). */
export function buildShortWhatsappMessage(launch: Record<string, unknown>): string {
  const get = (k: string) => launch[k];
  const nombre = get("nombre_pps") || get("Nombre PPS") || "PPS";
  // Note: keep simple, the rich message is the primary path.
  return `📢 *NUEVA CONVOCATORIA DE PRÁCTICAS*\n\n🏥 *PPS:* ${nombre}`;
}

/** Normaliza orientaciones detectadas por IA contra el catálogo estándar. */
export function normalizeDetectedOrientations(
  detected: unknown,
  catalog: readonly string[]
): string[] {
  if (!Array.isArray(detected)) return [];
  return [
    ...new Set(
      detected
        .map(
          (o: string) =>
            catalog.find(
              (std) => normalizeStringForComparison(std) === normalizeStringForComparison(o)
            ) || o
        )
        .filter((o: string) =>
          catalog.some(
            (std) => normalizeStringForComparison(std) === normalizeStringForComparison(o)
          )
        )
    ),
  ] as string[];
}
