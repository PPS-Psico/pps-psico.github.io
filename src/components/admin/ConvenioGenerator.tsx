import JSZip from "jszip";
import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { generateWithGemini, ModelDiagnostic, testGeminiModel } from "../../services/geminiService";
import Toast from "../ui/Toast";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { logger } from "../../utils/logger";

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────
const CONV_CSS = `
.conv {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  --ai:#5A2D86; --ai-s:#5A2D8612;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .conv {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
  --ai:#C9A4F2; --ai-s:#C9A4F21A;
}
.conv .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.conv .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
.conv .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.conv-head{ display:flex; align-items:flex-start; gap:12px; margin-bottom:22px; }
.conv-head h2{ font-family:'Instrument Serif', serif; font-size:26px; font-weight:700; letter-spacing:-0.025em; margin:5px 0 0; }
.conv-head p{ font-size:13.5px; color:var(--ink-3); margin:5px 0 0; max-width:560px; }
.conv-chip-ai{ display:inline-flex; align-items:center; gap:5px; font-size:10px; font-weight:600; letter-spacing:.02em; padding:3px 9px; border-radius:999px; background:var(--ai-s); color:var(--ai); }
.conv-chip-ai .material-icons{ font-size:12px; }

.conv-panel{ border:1px solid var(--rule-2); border-radius:16px; background:var(--paper); padding:24px; }
.conv-grid{ display:grid; grid-template-columns:1.6fr 1fr; gap:24px; }
@media (max-width:840px){ .conv-grid{ grid-template-columns:1fr; } }

.conv-drop{ position:relative; overflow:hidden; border:1.5px dashed var(--rule-3); border-radius:12px; padding:30px 20px; text-align:center; transition:border-color .15s, background .15s; }
.conv-drop[data-has="1"]{ border-color:var(--accent); border-style:solid; background:var(--accent-s); }
.conv-drop:hover{ border-color:var(--accent); background:var(--paper-2); }
.conv-drop input{ position:absolute; inset:0; z-index:10; cursor:pointer; opacity:0; }
.conv-drop-ico{ width:52px; height:52px; margin:0 auto 12px; border-radius:50%; display:flex; align-items:center; justify-content:center; background:var(--paper-3); color:var(--ink-3); }
.conv-drop[data-has="1"] .conv-drop-ico{ background:var(--accent); color:#fff; }
.conv-drop-ico .material-icons{ font-size:24px; }
.conv-drop-name{ font-size:13.5px; font-weight:600; color:var(--ink); }
.conv-drop-meta{ font-size:12px; color:var(--ink-3); margin-top:3px; }

.conv-type-opt{ width:100%; display:flex; align-items:center; justify-content:space-between; padding:11px 14px; border-radius:10px; font-size:13.5px; font-weight:500; cursor:pointer; font-family:inherit; border:1px solid var(--rule-3); background:var(--paper-2); color:var(--ink-2); transition: color .12s, background-color .12s, border-color .12s, box-shadow .12s, transform .12s, opacity .12s, filter .12s; text-transform:capitalize; }
.conv-type-opt + .conv-type-opt{ margin-top:8px; }
.conv-type-opt:hover{ background:var(--paper-3); }
.conv-type-opt[data-on="1"]{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.conv-type-opt .material-icons{ font-size:16px; }

.conv-btn{ display:inline-flex; align-items:center; justify-content:center; gap:8px; font-size:13.5px; font-weight:500; padding:11px 18px; border-radius:10px; border:1px solid var(--rule-3); background:transparent; color:var(--ink); cursor:pointer; font-family:inherit; transition:background .12s; }
.conv-btn:hover{ background:var(--paper-2); }
.conv-btn:disabled{ opacity:.5; cursor:not-allowed; }
.conv-btn-primary{ background:var(--ink); color:var(--paper); border-color:var(--ink); width:100%; }
.conv-btn-primary:hover{ opacity:.9; background:var(--ink); }
.conv-link{ background:none; border:none; cursor:pointer; font-family:inherit; font-size:11px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:var(--ink-4); display:inline-flex; align-items:center; gap:5px; }
.conv-link:hover{ color:var(--accent); }
.conv-link .material-icons{ font-size:13px; }

.conv-diag{ border:1px solid var(--rule-2); border-radius:12px; background:var(--paper-2); padding:16px; margin-top:16px; }
.conv-diag-grid{ display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:8px; }
.conv-diag-cell{ display:flex; flex-direction:column; gap:3px; padding:9px 10px; border:1px solid var(--rule-2); border-radius:8px; background:var(--paper); }
.conv-diag-dot{ width:7px; height:7px; border-radius:999px; }

.conv-idle{ display:flex; align-items:center; justify-content:center; gap:8px; padding:22px; margin-top:16px; border:1px dashed var(--rule-3); border-radius:12px; color:var(--ink-3); font-size:12.5px; }
.conv-idle .material-icons{ font-size:16px; color:var(--accent); }

.conv-result-bar{ display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; flex-wrap:wrap; }
.conv-tabs{ display:inline-flex; gap:3px; padding:4px; border:1px solid var(--rule-2); border-radius:10px; background:var(--paper-2); }
.conv-tab{ padding:7px 13px; border-radius:7px; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; border:none; background:transparent; color:var(--ink-3); transition: color .12s, background-color .12s, border-color .12s, box-shadow .12s, transform .12s, opacity .12s, filter .12s; }
.conv-tab[data-on="1"]{ background:var(--paper); color:var(--accent); box-shadow:0 1px 2px rgba(20,19,16,0.06); }
.conv-tab.raw[data-on="1"]{ color:var(--warn); }

.conv-result-head{ display:flex; align-items:center; justify-content:space-between; margin-bottom:14px; }
.conv-result-head h3{ font-family:'Instrument Serif', serif; font-size:20px; font-weight:700; letter-spacing:-0.02em; }
.conv-icon-btn{ width:36px; height:36px; border-radius:9px; border:1px solid var(--rule-3); background:transparent; color:var(--ink-2); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .12s; }
.conv-icon-btn:hover{ background:var(--paper-2); }
.conv-icon-btn.dl{ background:var(--ink); color:var(--paper); border-color:var(--ink); }
.conv-icon-btn.dl:hover{ opacity:.9; }
.conv-icon-btn .material-icons{ font-size:18px; }

.conv-doc{ background:var(--paper); border:1px solid var(--rule-2); border-radius:14px; padding:40px 44px; min-height:480px; max-height:680px; overflow-y:auto; font-family:'Instrument Serif', Georgia, serif; font-size:14.5px; line-height:1.7; color:var(--ink-2); }
.conv-doc-title{ font-size:18px; font-weight:700; text-align:center; color:var(--ink); margin:18px 0 22px; letter-spacing:-0.01em; }
.conv-doc strong{ font-weight:700; color:var(--ink); }
@keyframes conv-spin{ to{ transform:rotate(360deg); } }
.conv-spin{ width:18px; height:18px; border:2px solid var(--rule-3); border-top-color:var(--accent); border-radius:999px; animation:conv-spin .8s linear infinite; }
`;
injectScopedStyles("conv-styles", CONV_CSS);
injectPremiumMotion();

interface ConvenioGeneratorProps {
  isTestingMode?: boolean;
}

/**
 * Helper to extract text from .docx files (XML based)
 */
async function extractTextFromDocx(file: File): Promise<string> {
  try {
    const zip = await JSZip.loadAsync(file);
    const docXml = await zip.file("word/document.xml")?.async("text");
    if (!docXml) return "";

    // Simple XML tag stripping (suitable for Gemini context)
    const text = docXml
      .replace(/<w:p[^>]*>/g, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/\n\s*\n/g, "\n")
      .trim();

    return text;
  } catch (err) {
    logger.error("Error extracting text from docx:", err);
    return "";
  }
}

const ConvenioGenerator: React.FC<ConvenioGeneratorProps> = ({ isTestingMode = false }) => {
  const [file, setFile] = useState<File | null>(null);
  const [agreementType, setAgreementType] = useState<"marco" | "especifico" | "ambos">(
    "especifico"
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [institutionName, setInstitutionName] = useState("");
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const [diagnostics, setDiagnostics] = useState<ModelDiagnostic[]>([]);
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  // States for results and navigation
  const [generatedMarco, setGeneratedMarco] = useState("");
  const [generatedEspecifico, setGeneratedEspecifico] = useState("");
  const [viewStep, setViewStep] = useState<"config" | "marco" | "especifico" | "raw">("config");
  const [rawResponse, setRawResponse] = useState("");

  // Get current date
  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.toLocaleString("es-ES", { month: "long" });
  const capitalizedMonth = currentMonth.charAt(0).toUpperCase() + currentMonth.slice(1);
  const currentYear = today.getFullYear();
  const nextYear = currentYear + 1;
  const todayString = `${currentDay} de ${capitalizedMonth} de ${currentYear}`;

  // EXACT templates with Simplified [TITULO] tag
  const baseTexts = {
    marco: `[TITULO]CONVENIO MARCO DE COOPERACIÓN ENTRE LA UNIVERSIDAD DE FLORES Y [NOMBRE_INSTITUCION][/TITULO]

En la Ciudad Autónoma de Buenos Aires, a los ${currentDay} días del mes de ${capitalizedMonth} de ${currentYear}, entre la **UNIVERSIDAD DE FLORES**, representada en este acto por su Rectora **Arq. Ruth G. Fische** DNI Nº 13.881.555, y por el Vicerrector Regional **Lic. Gonzalo De la Sierra**, DNI Nº 33.618.546, ambos con domicilio en Pedernera 275, C.A.B.A., en adelante denominada **"LA UNIVERSIDAD"** por una parte, y por la otra **[NOMBRE_INSTITUCION]**, con domicilio en [DOMICILIO], representada en este acto por **[REPRESENTANTE]**, con D.N.I. **[DNI]**, en adelante denominada **"[ALIAS_INSTITUCION]"**, acuerdan celebrar el presente Convenio Marco de Cooperación Mutua, sujeto a las cláusulas que se detallan a continuación:

**PRIMERA:** Las partes acuerdan suscribir el presente Convenio Marco, para implementar según estimen conveniente, acciones tendientes a desarrollar en forma conjunta; a) proyectos de carácter académico, científico, y cultural para beneficio de la comunidad de ambas instituciones intervinientes. b) emprendimientos que favorezcan el avance y aplicación de los conocimientos.

**SEGUNDA:** Las acciones dirigidas a los distintos campos de cooperación, así como los términos, condiciones, procedimientos y resultados a obtener en cada uno de los proyectos o actividades que se implementen, serán fijados mediante Convenios Específicos entre ambas partes. Con tal motivo se suscribirán para cada caso, anexos al presente Convenio Marco, donde se describirán los objetivos, las tareas, los aportes de las partes, resultados esperados, el cronograma de acciones previsto y toda otra especificación que sea necesaria para definición y cumplimiento de lo acordado.

**TERCERA:** El presente Convenio Marco no obliga a las partes a proveer fondos ni otros recursos propios o ajenos, a menos que así se establezca por escrito en Convenios Específicos, ni impide la firma de convenios similares con otras instituciones, nacionales o internacionales. Tanto LA UNIVERSIDAD como **"[ALIAS_INSTITUCION]"**, podrán solicitar apoyo financiero de terceras partes de manera conjunta o individual, con el fin de llevar adelante los proyectos y actividades de cooperación.

**CUARTA:** Los Convenios Específicos que se deriven del presente acuerdo deberán definir claramente los derechos de propiedad intelectual o modalidades de promoción y distribución de resultados para atender los gastos, en caso que los hubiere.

**QUINTA:** La realización de toda actividad inherente a la promoción y publicidad de cualquiera de las acciones previas en la cláusula PRIMERA será programada en forma conjunta por las partes. Sin perjuicio de ello queda aclarado que las partes podrán promocionar dichas actividades a través de herramientas de comunicación propias de cada Institución que administrarán ambas de manera independiente para lograr su difusión y promoción dentro de su zona de influencia, previa notificación y aprobación por escrito de la otra parte.

**SEXTA:** A efectos de facilitar la labor conjunta, cada una de las partes designará un Coordinador, que entre otras tareas, prepararán oportunamente los anexos al presente convenio y de ser necesario, serán asistidos por especialistas de las partes en la materia específica de cada proyecto involucrado.

**SÉPTIMA:** El presente Convenio entrará en vigor en la fecha de su firma y tendrá vigencia por el término de dos (2) años, término que se prorrogará en forma automática a su vencimiento, por iguales períodos, salvo decisión en contrario de alguna de las partes. El presente Convenio puede ser rescindido mediante notificación escrita de alguna de las partes, con una anticipación no menor de tres (3) meses antes de expirar la vigencia del Convenio. Los proyectos o actividades que se hubiesen iniciado bajo el amparo del Convenio, y que no hubiesen concluido a su vencimiento o rescisión, no se verán afectados, debiendo permitirse su respectiva culminación.

**OCTAVA:** Ninguna adición, variación o alteración de este Convenio será válida, si no es refrendada por ambas partes, e incorporada por escrito al mismo.

**NOVENA:** En caso de presentarse dudas o controversias en la aplicación, ejecución o interpretación del presente Convenio, las mismas serán solventadas de común acuerdo entre ambas Instituciones, aceptando las partes someterse subsidiariamente a los Tribunales Ordinarios de Capital Federal, renunciando a cualquier otra jurisdicción que eventualmente pudiera corresponderles.

EN PRUEBA DE CONFORMIDAD se suscriben dos ejemplares de un mismo tenor y a un solo efecto en el lugar y fecha arriba indicados.

[ESPACIO_FIRMA]

[SECCION_FIRMAS]
Firma1: [REPRESENTANTE] | [CARGO_REP] | [NOMBRE_INSTITUCION]
Firma2: Arq. Ruth G. Fische | Rectora | UNIVERSIDAD DE FLORES
Firma3: Lic. Gonzalo De la Sierra | Vicerrector Regional | UNIVERSIDAD DE FLORES
[FIN_FIRMAS]`,
    especifico: `[TITULO]CONVENIO ESPECÍFICO ENTRE LA UNIVERSIDAD DE FLORES Y [NOMBRE_INSTITUCION][/TITULO]

En la ciudad de Cipolletti, a los ${currentDay} días del mes de ${capitalizedMonth} del año ${currentYear} entre la **UNIVERSIDAD de FLORES**, representada en este acto por su Rectora **Arq. Ruth G. Fische** DNI Nº 13.881.555 y por el Vicerrector Regional **Lic. Gonzalo De la Sierra**, DNI Nº 33.618.546 ambos con domicilio en Pedernera 275, C.A.B.A, en adelante denominada **LA UNIVERSIDAD** por una parte y por la otra **[NOMBRE_INSTITUCION]**, representada en este acto por **[REPRESENTANTE]** DNI Nº **[DNI]**, con domicilio en [DOMICILIO], en adelante denominada **"[ALIAS_INSTITUCION]"**, acuerdan celebrar el presente convenio:

**PRIMERA:** En el contexto del Convenio Marco de Cooperación que suscribieran con fecha [TEXTO_CONVENIO_MARCO_REF] las partes acuerdan suscribir el presente CONVENIO ESPECÍFICO:

[TITULO]PROYECTO DE PRÁCTICA PROFESIONAL SUPERVISADA (PPS) Y TALLER DE PRÁCTICA PROFESIONAL DE ALUMNOS DE LA LICENCIATURA EN PSICOLOGÍA[/TITULO]

**Lugar de la PPS:** [LUGAR_PPS]
**Destinatarios:** Alumnos de la Carrera de Licenciatura en Psicología.
**Vacantes:** [CANTIDAD] estudiantes.
**Duración de la PPS:** [DURACION]
**Frecuencia:** [FRECUENCIA]
**Cantidad de horas totales:** [TOTAL_HORAS] horas reloj.
**Modalidad:** Actividad de formación teórico-práctica.
**Requisitos de aprobación:**
[REQUISITOS_APROBACION]
**Dirección o sede:** [DIRECCION_SEDE]
**Profesionales tutores de la institución receptora:** [NOMBRE_TUTOR_INST].
**Profesionales tutores por UFLO:** [NOMBRE_TUTOR_UFLO].

**SEGUNDA: PROGRAMA**
**Objetivo General:**
[OBJETIVO_GRAL_PRO]
**Objetivos Específicos:**
- [OBJETIVO_ESP_1]
- [OBJETIVO_ESP_2]
- [OBJETIVO_ESP_3]
- [OBJETIVO_ESP_4]

**TERCERA: VIGENCIA** El presente acuerdo tendrá vigencia durante el desarrollo de la práctica descripta dentro del ciclo lectivo ${currentYear} y ${nextYear}, caducando el 31 de diciembre de ${nextYear}, pudiendo ser renovado por acuerdo escrito entre las partes para futuros períodos.

En prueba de conformidad se suscriben dos ejemplares de un mismo tenor y a un solo efecto en el lugar y fecha arriba indicados.

[ESPACIO_FIRMA]

[SECCION_FIRMAS]
Firma1: [REPRESENTANTE] | [CARGO_REP] | [NOMBRE_INSTITUCION]
Firma2: Arq. Ruth G. Fische | Rectora | UNIVERSIDAD DE FLORES
Firma3: Lic. Gonzalo De la Sierra | Vicerrector Regional | UNIVERSIDAD DE FLORES
[FIN_FIRMAS]`,
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleGenerate = async () => {
    if (!file) {
      setToastInfo({ message: "Por favor, sube un archivo.", type: "error" });
      return;
    }

    setIsGenerating(true);
    setGeneratedMarco("");
    setGeneratedEspecifico("");

    try {
      let fileContent = "";
      const isDocx = file.name.endsWith(".docx");

      if (isDocx) {
        fileContent = await extractTextFromDocx(file);
      } else {
        fileContent = await file.text();
      }

      const prompt = `
        SOS UN EXPERTO LEGAL Y ACADÉMICO EN CONVENIOS DE PPS (Prácticas Profesionales Supervisadas).

        INSTRUCCIÓN SUPREMA:
        - Debes devolver el documento COMPLETAMENTE.
        - NO resumas ni omitas nada. NUNCA TE DETENGAS A MITAD DEL TEXTO.
        - Es OBLIGATORIO incluir todas las cláusulas (PRIMERA, SEGUNDA, TERCERA, etc.) hasta el final.
        - ES VITAL incluir el bloque de firmas: [SECCION_FIRMAS] hasta [FIN_FIRMAS]. Si falta esto, el documento no sirve.

        REQUISITOS DE ASIGNACIÓN DE TUTORES UFLO (Obligatorio asignar según área):
        - Si el Área es Clínica: Lic. Selva Estrella
        - Si el Área es Educacional: Lic. Franco Pedraza
        - Si el Área es Laboral o Comunitaria: Lic. Cynthia Rossi

        REGLA DE FECHA PARA EL MARCO (En Cláusula PRIMERA del Específico):
        - Si el tipo de generación es "AMBOS" (Convenio Marco + Específico), completa la fecha con la de HOY: "${todayString}".
        - Si SOLO estás generando el "ESPECÍFICO", deja los espacios en blanco exactamente así: "…….. de …………… de …….".

        INDICADORES DE CONTENIDO:
        - Determina el Área según la INFO adjunta.
        - Completa los procesos (Objetivos, Actividades, etc.) con tono académico.
        - Completa todos los datos de [] con la INFO.

        FORMATO:
        - Usa [TITULO]Texto[/TITULO] para el encabezado.
        - Usa [NEGRILLA]Texto[/NEGRILLA] para resaltar. NO USES MARKDOWN.

        ESTRUCTURAS A LLENAR:
        ${agreementType === "marco" || agreementType === "ambos" ? `--- MARCO STARTS ---\n${baseTexts.marco}\n--- MARCO ENDS ---` : ""}
        ${agreementType === "especifico" || agreementType === "ambos" ? `--- ESPECIFICO STARTS ---\n${baseTexts.especifico}\n--- ESPECIFICO ENDS ---` : ""}

        TIPO DE GENERACIÓN ACTUAL: ${agreementType.toUpperCase()}
        Empieza con: INSTITUCION: [Nombre]

        INFO: "${fileContent.substring(0, 5000)}"
      `;

      const response = await generateWithGemini(prompt);
      logger.info("DEBUG - AI RESPONSE LENGTH:", response.length);

      // Clean response while preserving our tags
      const sanitizedResponse = response
        .replace(/```.*?```/gs, "")
        .replace(/#{1,6}\s?/g, "")
        .trim();

      let name = "Institución";
      const instMatch = sanitizedResponse.match(/INSTITUCION:\s*(.*?)(\n|$)/i);

      if (instMatch) {
        name = instMatch[1].trim();
      } else {
        // Try to extract from first title (usually "CONVENIO... Y NOMBRE")
        const titleMatch = sanitizedResponse.match(/\[TITULO\].*? Y (.*?)\[\/TITULO\]/i);
        if (titleMatch) name = titleMatch[1].trim();
      }

      setInstitutionName(name);

      const finalContent = sanitizedResponse.replace(/.*INSTITUCION:.*\n?/i, "").trim();

      setRawResponse(sanitizedResponse);

      if (agreementType === "ambos") {
        // 1. Try explicit markers
        const marcoMatch = sanitizedResponse.match(/--- MARCO STARTS ---(.*?)--- MARCO ENDS ---/is);
        const especMatch = sanitizedResponse.match(
          /--- ESPECIFICO STARTS ---(.*?)--- ESPECIFICO ENDS ---/is
        );

        let marco = marcoMatch ? marcoMatch[1].trim() : "";
        let especifico = especMatch ? especMatch[1].trim() : "";

        // 2. Fallback based on text position - BE SMART: Look for TITULO of the second doc
        if (!marco || !especifico) {
          const lower = sanitizedResponse.toLowerCase();

          // SEARCH FOR THE ACTUAL STARTING HEADER, not just the words in a paragraph
          let especIndex = lower.indexOf("\n[titulo]convenio específico");
          if (especIndex === -1) especIndex = lower.indexOf("\n[titulo]convenio especifico");

          // If TITULO tag is missing but its a clear new header (start of line)
          if (especIndex === -1) {
            especIndex = lower.lastIndexOf("\nconvenio específico");
            if (especIndex === -1) especIndex = lower.lastIndexOf("\nconvenio especifico");
          }

          if (especIndex !== -1) {
            marco = marco || sanitizedResponse.substring(0, especIndex).trim();
            especifico = especifico || sanitizedResponse.substring(especIndex).trim();
          } else {
            // Last resort: if we can't find a clear split, put everything in Marco and let user choose Raw
            marco = marco || sanitizedResponse;
          }
        }

        setGeneratedMarco(marco);
        setGeneratedEspecifico(especifico);
        setViewStep(marco && marco.length > 50 ? "marco" : especifico ? "especifico" : "raw");
      } else if (agreementType === "marco") {
        setGeneratedMarco(
          finalContent
            .replace(
              /--- MARCO STARTS ---|--- MARCO ENDS ---|--- ESPECIFICO STARTS ---|--- ESPECIFICO ENDS ---/gi,
              ""
            )
            .trim()
        );
        setViewStep("marco");
      } else {
        setGeneratedEspecifico(
          finalContent
            .replace(
              /--- MARCO STARTS ---|--- MARCO ENDS ---|--- ESPECIFICO STARTS ---|--- ESPECIFICO ENDS ---/gi,
              ""
            )
            .trim()
        );
        setViewStep("especifico");
      }
      setToastInfo({ message: "Convenio generado correctamente.", type: "success" });
    } catch (error) {
      logger.error("Generation error:", error);
      if (error instanceof Error && error.message.includes("quota")) {
        setToastInfo({ message: "Límite de IA alcanzado. Espera 1 minuto.", type: "error" });
      } else {
        setToastInfo({ message: "Error en la generación.", type: "error" });
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboardAsHtml = (text: string) => {
    // 1. Separate Signature Block from Body
    let bodyText = text.replace(/\[ESPACIO_FIRMA\]/g, "<br/><br/><br/><br/><br/><br/>");
    let signatureHtml = "";

    const sigMatch = bodyText.match(/\[SECCION_FIRMAS\](.*?)\[FIN_FIRMAS\]/s);
    if (sigMatch) {
      bodyText = bodyText.replace(/\[SECCION_FIRMAS\].*?\[FIN_FIRMAS\]/s, "");
      const sigData = sigMatch[1].trim().split("\n");

      // Create a 3-column professional table for Word
      signatureHtml = `
        <table width="100%" style="margin-top: 20px; border-collapse: collapse; font-family: 'Times New Roman'; font-size: 11pt;">
          <tr>
            <td align="center" width="33%" style="padding-bottom: 15px;">_______________________</td>
            <td align="center" width="33%" style="padding-bottom: 15px;">_______________________</td>
            <td align="center" width="33%" style="padding-bottom: 15px;">_______________________</td>
          </tr>
          <tr>
            ${sigData
              .map((line) => {
                const parts =
                  line
                    .split(":")[1]
                    ?.split("|")
                    .map((p) => p.trim()) || [];
                return `
                <td align="center">
                  <b>${parts[0] || ""}</b><br/>
                  ${parts[1] || ""}<br/>
                  <b>${parts[2] || ""}</b>
                </td>
              `;
              })
              .join("")}
          </tr>
        </table>
      `;
    }

    // 2. Format Body
    const htmlBody = bodyText
      .replace(
        /\[TITULO\](.*?)\[\/TITULO\]/gs,
        '<div style="text-align: center;"><b><u><i>$1</i></u></b></div>'
      )
      .replace(/\[CENTRAR\](.*?)\[\/CENTRAR\]/gs, '<div style="text-align: center;">$1</div>')
      .replace(/\[NEGRILLA\](.*?)\[\/NEGRILLA\]/gs, "<b>$1</b>")
      .replace(/\[SUBRAYADO\](.*?)\[\/SUBRAYADO\]/gs, "<u>$1</u>")
      .replace(/\[CURSIVA\](.*?)\[\/CURSIVA\]/gs, "<i>$1</i>")
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br/>");

    const fullHtml = `<html><body><div style="font-family:'Times New Roman';font-size:12pt;text-align:justify;">${htmlBody}${signatureHtml}</div></body></html>`;

    const plainText = text.replace(/\[.*?\]/g, "").replace(/\*\*(.*?)\*\*/g, "$1");

    try {
      const data = [
        new ClipboardItem({
          "text/html": new Blob([fullHtml], { type: "text/html" }),
          "text/plain": new Blob([plainText], { type: "text/plain" }),
        }),
      ];
      navigator.clipboard.write(data);
      setToastInfo({ message: "Copiado con formato impecable.", type: "success" });
    } catch (e) {
      navigator.clipboard.writeText(plainText);
      setToastInfo({ message: "Copiado (Texto plano).", type: "success" });
    }
  };

  const handleDownload = async (type: string, _content: string) => {
    try {
      setToastInfo({ message: "Descargando plantilla...", type: "success" });

      // Download the base template
      const fileName = "membretado_base.docx";
      const { data, error } = await supabase.storage
        .from("documentos_convenios")
        .download(fileName);
      if (error) throw error;

      // Create a descriptive name
      let cleanInstName = institutionName.replace(/[^a-z0-9\s]/gi, "").replace(/\s+/g, "_");
      if (cleanInstName.length < 2) cleanInstName = "Empresa";

      const customName = `Convenio_${type.toUpperCase()}_UFLO_${cleanInstName}.docx`;

      // Trigger standard browser download
      const url = window.URL.createObjectURL(data);
      const link = document.createElement("a");
      link.href = url;
      link.download = customName;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setToastInfo({
        message: "Plantilla descargada. ¡No olvides pegar el texto!",
        type: "success",
      });
    } catch (error) {
      logger.error("Download error:", error);
      setToastInfo({ message: "Error al descargar la plantilla.", type: "error" });
    }
  };

  return (
    <div className="conv">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div className="conv-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <span className="eyebrow">Documentos · convenios</span>
          <h2 className="serif">Generador de convenios</h2>
          <p>
            Subí la información de la institución y la IA redacta el borrador legal completo, listo
            para revisar y exportar.
          </p>
        </div>
        <span className="conv-chip-ai" style={{ marginTop: 6 }}>
          <span className="material-icons">auto_awesome</span>
          Hermes asiste
        </span>
      </div>

      <div>
        {viewStep === "config" ? (
          <div>
            <div className="conv-panel">
              <div className="conv-grid">
                {/* File Upload Section */}
                <div>
                  <span className="eyebrow" style={{ display: "block", marginBottom: 10 }}>
                    Información de la institución
                  </span>
                  <label style={{ display: "block", cursor: "pointer" }}>
                    <div className="conv-drop" data-has={file ? "1" : "0"}>
                      <input type="file" onChange={handleFileChange} accept=".docx,.doc,.txt" />
                      <div className="conv-drop-ico">
                        <span className="material-icons">{file ? "task" : "upload_file"}</span>
                      </div>
                      <div className="conv-drop-name">
                        {file ? file.name : "Subí el Word o TXT de la empresa"}
                      </div>
                      <div className="conv-drop-meta">
                        {file
                          ? `${(file.size / 1024).toFixed(1)} KB`
                          : "Arrastrá el archivo o hacé clic para buscar"}
                      </div>
                    </div>
                  </label>
                </div>

                {/* Options Section */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: 20,
                  }}
                >
                  <div>
                    <span className="eyebrow" style={{ display: "block", marginBottom: 10 }}>
                      Tipo de documento
                    </span>
                    <div>
                      {(["marco", "especifico", "ambos"] as const).map((t) => (
                        <button
                          key={t}
                          onClick={() => setAgreementType(t)}
                          className="conv-type-opt"
                          data-on={agreementType === t ? "1" : "0"}
                        >
                          <span>{t}</span>
                          {agreementType === t && (
                            <span className="material-icons">check_circle</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    <button
                      onClick={async () => {
                        setIsDiagnosing(true);
                        const modelsToTest = [
                          "gemini-3-flash",
                          "gemini-3-flash-preview",
                          "gemini-3.0-flash",
                          "gemini-2.5-flash",
                          "gemini-2.5-flash-lite",
                          "gemini-2-flash",
                          "gemini-2-flash-lite",
                          "gemini-3-flash-lite",
                          "gemini-2.0-flash",
                          "gemini-2.0-flash-exp",
                        ];
                        const results: ModelDiagnostic[] = [];
                        for (const m of modelsToTest) {
                          const res = await testGeminiModel(m);
                          results.push(res);
                          setDiagnostics([...results]);
                        }
                        setIsDiagnosing(false);
                      }}
                      disabled={isDiagnosing}
                      className="conv-link"
                      style={{ alignSelf: "center", marginBottom: 4 }}
                    >
                      <span className="material-icons">biotech</span>
                      {isDiagnosing ? "Escaneando modelos…" : "Diagnosticar modelos"}
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className="conv-btn conv-btn-primary"
                      style={{ height: 48 }}
                    >
                      {isGenerating ? (
                        <span className="conv-spin" style={{ borderTopColor: "var(--paper)" }} />
                      ) : (
                        <span className="material-icons" style={{ fontSize: 17 }}>
                          auto_awesome
                        </span>
                      )}
                      {isGenerating ? "Generando…" : "Generar convenios"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Diagnostic Results */}
            {diagnostics.length > 0 && (
              <div className="conv-diag">
                <h4
                  className="eyebrow"
                  style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}
                >
                  <span className="material-icons" style={{ fontSize: 12 }}>
                    analytics
                  </span>
                  Diagnóstico de modelos
                </h4>
                <div className="conv-diag-grid">
                  {diagnostics.map((d, idx) => (
                    <div key={idx} className="conv-diag-cell">
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <span
                          className="mono"
                          style={{
                            fontSize: 10,
                            color: "var(--ink-4)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: 110,
                          }}
                          title={d.model}
                        >
                          {d.model}
                        </span>
                        <span
                          className="conv-diag-dot"
                          style={{
                            background:
                              d.status === "success"
                                ? "var(--ok)"
                                : d.status === "quota_exceeded"
                                  ? "var(--warn)"
                                  : "#C0392B",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          textTransform: "uppercase",
                          letterSpacing: ".04em",
                          color:
                            d.status === "success"
                              ? "var(--ok)"
                              : d.status === "quota_exceeded"
                                ? "var(--warn)"
                                : "#C0392B",
                        }}
                      >
                        {d.message}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setDiagnostics([])}
                  className="conv-link"
                  style={{ marginTop: 14 }}
                >
                  Cerrar diagnóstico
                </button>
              </div>
            )}
            {!isGenerating && !generatedMarco && !generatedEspecifico && (
              <div className="conv-idle">
                <span className="material-icons">info</span>
                Listo para procesar con IA
              </div>
            )}
            {isGenerating && (
              <div
                style={{
                  padding: "48px 0",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 14,
                }}
              >
                <span className="conv-spin" />
                <p style={{ fontSize: 13.5, color: "var(--ink-3)" }}>Redactando borrador legal…</p>
              </div>
            )}
          </div>
        ) : (
          <div>
            <div className="conv-result-bar">
              <button onClick={() => setViewStep("config")} className="conv-link">
                <span className="material-icons">arrow_back</span>
                Atrás
              </button>

              <div className="conv-tabs">
                {agreementType === "ambos" && (
                  <>
                    <button
                      onClick={() => setViewStep("marco")}
                      className="conv-tab"
                      data-on={viewStep === "marco" ? "1" : "0"}
                    >
                      Borrador marco
                    </button>
                    <button
                      onClick={() => setViewStep("especifico")}
                      className="conv-tab"
                      data-on={viewStep === "especifico" ? "1" : "0"}
                    >
                      Borrador específico
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewStep("raw")}
                  className="conv-tab raw"
                  data-on={viewStep === "raw" ? "1" : "0"}
                >
                  Respuesta cruda
                </button>
              </div>
            </div>

            {viewStep === "marco" && (
              <ResultSection
                title="CONVENIO MARCO"
                text={
                  generatedMarco ||
                  "No se pudo extraer el texto del Convenio Marco. Prueba en 'Ver Respuesta Cruda'."
                }
                onCopy={() => copyToClipboardAsHtml(generatedMarco)}
                onDownload={() => handleDownload("marco", generatedMarco)}
              />
            )}

            {viewStep === "especifico" && (
              <ResultSection
                title="CONVENIO ESPECÍFICO"
                text={
                  generatedEspecifico ||
                  "No se pudo extraer el texto del Convenio Específico. Prueba en 'Ver Respuesta Cruda'."
                }
                onCopy={() => copyToClipboardAsHtml(generatedEspecifico)}
                onDownload={() => handleDownload("especifico", generatedEspecifico)}
              />
            )}

            {viewStep === "raw" && (
              <ResultSection
                title="RESPUESTA CRUDA DE LA IA"
                text={rawResponse}
                onCopy={() => copyToClipboardAsHtml(rawResponse)}
                onDownload={() => handleDownload("crudo", rawResponse)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const ResultSection: React.FC<{
  title: string;
  text: string;
  onCopy: () => void;
  onDownload: () => void;
  actions?: React.ReactNode;
}> = ({ title, text, onCopy, onDownload, actions }) => (
  <div>
    <div className="conv-result-head">
      <h3 className="serif">{title}</h3>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCopy} className="conv-icon-btn" title="Copiar">
          <span className="material-icons">content_copy</span>
        </button>
        <button onClick={onDownload} className="conv-icon-btn dl" title="Descargar">
          <span className="material-icons">file_download</span>
        </button>
      </div>
    </div>

    <div className="conv-doc">
      {(() => {
        // 1. Pre-process text to fix common AI tag errors and prepare markers
        let processedText = text
          // Fix orphaned closing tags (common during split)
          .replace(/^([^@]*?)\[\/TITULO\]/im, "[TITULO]$1[/TITULO]")
          // Convert tags to internal markers for easier line-processing
          .replace(
            /\[TITULO\]([\s\S]*?)\[\/TITULO\]/gi,
            (m, p) => `@@TITLE@@${p.trim().replace(/\n/g, " ")}@@TITLE@@`
          )
          .replace(
            /\[NEGRILLA\]([\s\S]*?)\[\/NEGRILLA\]/gi,
            (m, p) => `@@BOLD@@${p.trim()}@@BOLD@@`
          );

        return processedText.split("\n").map((line, i) => {
          const trimmedLine = line.trim();

          if (trimmedLine.includes("@@TITLE@@")) {
            const content = trimmedLine.replace(/@@TITLE@@/g, "");
            return (
              <div key={i} className="conv-doc-title">
                {content}
              </div>
            );
          }

          const parts = line.split(/(@@BOLD@@.*?@@BOLD@@)/g);
          return (
            <div key={i} style={{ marginBottom: 10 }}>
              {parts.map((p, pi) => {
                if (p.startsWith("@@BOLD@@")) {
                  return <strong key={pi}>{p.replace(/@@BOLD@@/g, "")}</strong>;
                }
                // Clean any other tags
                return p.replace(/\[\/?(CENTRAR|CURSIVA|SUBRAYADO|ESPACIO_FIRMA)\]/gi, "");
              })}
            </div>
          );
        });
      })()}
    </div>

    <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 12 }}>{actions}</div>
  </div>
);

export default ConvenioGenerator;
