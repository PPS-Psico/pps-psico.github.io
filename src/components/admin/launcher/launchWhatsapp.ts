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
2. **Actividades Impactantes**: Genera MÁXIMO 4 items generales para la lista de actividades. Si hay varias áreas o dispositivos, conserva además las actividades particulares dentro de cada dispositivo.
3. **Detección de Dirección**: Busca la dirección física o modalidad (ej: "Modalidad Virtual").
4. **Detección de Orientaciones**: Identifica todas las orientaciones mencionadas (Clínica, Jurídica, Educacional, Comunitaria, Laboral, etc).
5. **Dispositivos, Franjas y Cupos**: Sé extremadamente minucioso.
   - Si el material reúne varias áreas, sedes, comisiones o dispositivos, generá un elemento separado para cada combinación con orientación o actividades propias.
   - Cada franja debe contener su cupo. No inventes una división si el documento informa un cupo compartido entre horarios alternativos: en ese caso escribí las alternativas juntas en una única franja.
   - La suma de las franjas de un dispositivo debe coincidir con sus vacantes informadas.
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
8. "dispositivos": Array de objetos [{
     "nombre": "Área o dispositivo",
     "orientacion": "Orientación",
     "ubicacion": "Lugar específico",
     "actividades": ["Actividad"],
     "requisitos": ["Requisito"],
     "franjas": [{ "horario": "Frecuencia, día y franja", "cupos": 2 }]
   }]. Si no hay dispositivos diferenciados, devolvé un array vacío.

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
  institutionName?: string;
}

const asText = (value: unknown): string => (typeof value === "string" ? value.trim() : "");

/** Arma el posteo de WhatsApp listo para pegar en los grupos. */
export function buildWhatsappMessage({
  formData,
  schedules,
  isMultiOrientation,
  institutionName,
}: BuildWhatsappArgs): string {
  const safeOrientacion = Array.isArray(formData.orientacion)
    ? formData.orientacion.map(asText).filter(Boolean)
    : [];
  const safeSchedules = Array.isArray(schedules) ? schedules : [];
  const validSchedules = safeSchedules.filter((schedule) => asText(schedule?.time));
  const validOptions = (Array.isArray(formData.opciones) ? formData.opciones : []).filter(
    (option) =>
      asText(option.nombre) &&
      asText(option.orientacion) &&
      option.horarios.some((schedule) => asText(schedule.horario) && Number(schedule.cupos) > 0)
  );
  const nombrePps = asText(formData.nombrePPS) || "Nueva convocatoria";
  const institucion = asText(institutionName) || nombrePps;
  const direccion = asText(formData.direccion) || "A confirmar";
  const descripcion = asText(formData.descripcion) || "Consultá los detalles en Mi Panel.";

  let message = `📢 *¡Nueva Convocatoria PPS: ${nombrePps}!* 📢

✨ *Institución:* ${institucion}
📍 *Lugar:* ${direccion}

🎯 *Objetivo:* ${descripcion}`;

  const formatScheduleLine = (schedule: ScheduleEntry) => {
    const time = asText(schedule?.time);
    const orientation = asText(schedule?.orientacion);
    const orientationLabel = isMultiOrientation && orientation ? ` [${orientation}]` : "";
    return `${time}${orientationLabel}`;
  };

  if (validOptions.length > 0) {
    message += `

🧩 *Dispositivos disponibles:*`;
    message +=
      "\n" +
      validOptions
        .map((option) => {
          const schedules = option.horarios
            .filter((schedule) => asText(schedule.horario) && Number(schedule.cupos) > 0)
            .map(
              (schedule) =>
                `  • ${asText(schedule.horario)} — ${Number(schedule.cupos)} ${
                  Number(schedule.cupos) === 1 ? "cupo" : "cupos"
                }`
            )
            .join("\n");
          const total = option.horarios.reduce(
            (sum, schedule) => sum + Math.max(0, Number(schedule.cupos) || 0),
            0
          );
          return `• *${asText(option.nombre)}* [${asText(option.orientacion)}] — ${total} ${
            total === 1 ? "cupo total" : "cupos totales"
          }${schedules ? `\n${schedules}` : ""}`;
        })
        .join("\n");
  } else {
    message += `

📅 *Horarios:*`;
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
  }

  const fechaEncuentro = asText(formData.fechaEncuentroInicial);
  if (fechaEncuentro) {
    const encuentroDate = new Date(fechaEncuentro);
    const fechaStr = formatDate(fechaEncuentro);
    const hasValidDate = !Number.isNaN(encuentroDate.getTime());
    const hours = hasValidDate ? encuentroDate.getHours() : 0;
    const minutes = hasValidDate ? encuentroDate.getMinutes() : 0;
    const horaStr =
      hours || minutes
        ? `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")} hs`
        : "";
    message += `

🤝 *Encuentro inicial obligatorio:* ${fechaStr}${horaStr ? ` a las ${horaStr}` : ""}
⚠️ Es obligatorio para todos los inscriptos`;
  }

  const fechaInicio = asText(formData.fechaInicio);
  const fechaFin = asText(formData.fechaFin);
  const fechaInicioInscripcion = asText(formData.fechaInicioInscripcion);
  const fechaFinInscripcion = asText(formData.fechaFinInscripcion);
  const cupos = formData.cuposDisponibles || "A confirmar";
  const horas = Number(formData.horasAcreditadas);
  const acreditacion = Number.isFinite(horas) && horas > 0 ? `${horas} horas` : "Según recorrido";

  message += `

📋 *Período de prácticas:* ${fechaInicio ? formatDate(fechaInicio) : "A confirmar"}${
    formData.finalizacionPorHoras
      ? ` · finalización individual al completar ${acreditacion}`
      : fechaFin
        ? ` al ${formatDate(fechaFin)} (aprox.)`
        : ""
  }
📋 *Inscripción:* ${
    fechaInicioInscripcion && fechaFinInscripcion
      ? `Desde ${formatDate(fechaInicioInscripcion)} hasta ${formatDate(fechaFinInscripcion)}`
      : "Consultar en Campus"
  }

👥 *Cupos:* ${cupos}

⏱️ *Acredita:* ${acreditacion} de ${safeOrientacion.join(", ") || "la orientación correspondiente"}`;

  if (formData.reqCertificadoTrabajo || formData.reqCv) {
    const reqList: string[] = [];
    if (formData.reqCertificadoTrabajo) reqList.push("Se priorizará a estudiantes que trabajen");
    if (formData.reqCv) reqList.push("Requisito: cargar CV actualizado");
    message += "\n📎 *Requisitos:* " + reqList.join(" • ");
  }

  const requisito = asText(formData.requisitoObligatorio);
  if (requisito) message += `\n📜 *Requisito:* ${requisito}`;

  message += `

💡 *Para inscribirte, completá el formulario en Mi Panel:*`;

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
