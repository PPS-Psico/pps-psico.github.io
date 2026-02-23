import JSZip from "jszip";
import React, { useState } from "react";
import { supabase } from "../../lib/supabaseClient";
import { generateWithGemini, ModelDiagnostic, testGeminiModel } from "../../services/geminiService";
import Loader from "../Loader";
import Button from "../ui/Button";
import Card from "../ui/Card";
import Toast from "../ui/Toast";

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
    console.error("Error extracting text from docx:", err);
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
      console.log("DEBUG - AI RESPONSE LENGTH:", response.length);

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
      console.error("Generation error:", error);
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
      console.error("Download error:", error);
      setToastInfo({ message: "Error al descargar la plantilla.", type: "error" });
    }
  };

  return (
    <Card title="Generador de Convenios con IA" icon="description">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      <div className="space-y-6 mt-4">
        {viewStep === "config" ? (
          <div className="space-y-6 animate-fade-in p-2">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 p-8 bg-white dark:bg-slate-900/50 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-2xl backdrop-blur-sm">
              {/* File Upload Section */}
              <div className="lg:col-span-2 space-y-4">
                <label className="group relative block cursor-pointer">
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1 mb-2 block">
                    Información de la Institución
                  </span>
                  <div
                    className={`
                    relative overflow-hidden rounded-2xl border-2 border-dashed transition-all duration-300 p-8 text-center
                    ${
                      file
                        ? "border-blue-500/50 bg-blue-50/30 dark:bg-blue-500/5"
                        : "border-slate-200 dark:border-slate-700 hover:border-blue-400/50 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }
                  `}
                  >
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="absolute inset-0 z-10 cursor-pointer opacity-0"
                      accept=".docx,.doc,.txt"
                    />
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className={`p-4 rounded-full transition-transform duration-500 group-hover:scale-110 ${file ? "bg-blue-500 text-white shadow-lg shadow-blue-500/20" : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"}`}
                      >
                        <span className="material-icons text-3xl">
                          {file ? "task" : "upload_file"}
                        </span>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                          {file ? file.name : "Sube el Word o TXT de la empresa"}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {file
                            ? `${(file.size / 1024).toFixed(1)} KB`
                            : "Arrastra el archivo o haz clic para buscar"}
                        </p>
                      </div>
                    </div>
                  </div>
                </label>
              </div>

              {/* Options Section */}
              <div className="flex flex-col justify-between space-y-6">
                <div>
                  <span className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 ml-1 mb-4 block">
                    Tipo de Documento
                  </span>
                  <div className="grid grid-cols-1 gap-2">
                    {(["marco", "especifico", "ambos"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setAgreementType(t)}
                        className={`
                          flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200
                          ${
                            agreementType === t
                              ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20 translate-x-1"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700"
                          }
                        `}
                      >
                        <span className="capitalize">{t}</span>
                        {agreementType === t && (
                          <span className="material-icons text-sm">check_circle</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col justify-end">
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
                      const results = [];
                      for (const m of modelsToTest) {
                        const res = await testGeminiModel(m);
                        results.push(res);
                        setDiagnostics([...results]);
                      }
                      setIsDiagnosing(false);
                    }}
                    disabled={isDiagnosing}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-500 transition-colors mb-2 flex items-center gap-1 justify-center"
                  >
                    <span className="material-icons text-xs">biotech</span>
                    {isDiagnosing ? "Escaneando modelos..." : "Diagnosticar Modelos (Buscador 3.0)"}
                  </button>
                  <Button
                    onClick={handleGenerate}
                    isLoading={isGenerating}
                    icon="auto_awesome"
                    className="w-full h-14 !rounded-xl !text-base !font-black !uppercase !tracking-tighter hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-blue-600/20"
                  >
                    Generar Convenios
                  </Button>
                </div>
              </div>
            </div>

            {/* Diagnostic Results */}
            {diagnostics.length > 0 && (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-fade-in">
                <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-3 flex items-center gap-2">
                  <span className="material-icons text-xs">analytics</span>
                  Resultados del Diagnóstico de Modelos
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {diagnostics.map((d, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="text-[10px] font-bold font-mono text-slate-400 truncate max-w-[120px]"
                          title={d.model}
                        >
                          {d.model}
                        </span>
                        <span
                          className={`w-2 h-2 rounded-full ${
                            d.status === "success"
                              ? "bg-green-500 animate-pulse"
                              : d.status === "quota_exceeded"
                                ? "bg-amber-500"
                                : "bg-red-500"
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[10px] font-black uppercase ${
                          d.status === "success"
                            ? "text-green-600"
                            : d.status === "quota_exceeded"
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {d.message}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setDiagnostics([])}
                  className="mt-4 text-[10px] font-black text-slate-400 hover:text-red-500 uppercase tracking-widest"
                >
                  Cerrar Diagnóstico
                </button>
              </div>
            )}
            {!isGenerating && !generatedMarco && !generatedEspecifico && (
              <div className="py-8 text-center animate-pulse">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                  <span className="material-icons text-sm">info</span>
                  <p className="text-xs font-bold uppercase tracking-widest">
                    Listo para procesar con IA
                  </p>
                </div>
              </div>
            )}
            {isGenerating && (
              <div className="py-12 flex flex-col items-center gap-4">
                <Loader />
                <p className="text-sm animate-pulse">Redactando borrador legal...</p>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between gap-4 mb-4">
              <button
                onClick={() => setViewStep("config")}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all"
              >
                <span className="material-icons text-sm">arrow_back</span>
                <span className="text-xs font-black uppercase tracking-widest">Atrás</span>
              </button>

              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {agreementType === "ambos" && (
                  <>
                    <button
                      onClick={() => setViewStep("marco")}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${viewStep === "marco" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Borrador Marco
                    </button>
                    <button
                      onClick={() => setViewStep("especifico")}
                      className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-tighter transition-all ${viewStep === "especifico" ? "bg-white dark:bg-slate-700 text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      Borrador Específico
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewStep("raw")}
                  className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${viewStep === "raw" ? "bg-white dark:bg-slate-700 text-amber-600 shadow-sm" : "text-slate-400 hover:text-slate-600"}`}
                >
                  Ver Respuesta Cruda
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
    </Card>
  );
};

const ResultSection: React.FC<{
  title: string;
  text: string;
  onCopy: () => void;
  onDownload: () => void;
  actions?: React.ReactNode;
}> = ({ title, text, onCopy, onDownload, actions }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-tighter">
        {title}
      </h3>
      <div className="flex gap-2">
        <button
          onClick={onCopy}
          className="p-2 transition-colors bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 hover:text-blue-600"
          title="Copiar"
        >
          <span className="material-icons">content_copy</span>
        </button>
        <button
          onClick={onDownload}
          className="p-2 transition-colors bg-blue-50 dark:bg-blue-900/20 rounded-lg text-blue-600 hover:bg-blue-600 hover:text-white"
          title="Descargar"
        >
          <span className="material-icons">file_download</span>
        </button>
      </div>
    </div>

    <div className="bg-white dark:bg-slate-950 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl min-h-[500px] max-h-[700px] overflow-y-auto font-serif text-sm leading-relaxed text-slate-800 dark:text-slate-200">
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
              <div
                key={i}
                className="text-xl font-black text-center text-blue-700 dark:text-blue-400 mb-8 mt-4 uppercase tracking-tight"
              >
                {content}
              </div>
            );
          }

          const parts = line.split(/(@@BOLD@@.*?@@BOLD@@)/g);
          return (
            <div key={i} className="mb-3">
              {parts.map((p, pi) => {
                if (p.startsWith("@@BOLD@@")) {
                  return (
                    <strong
                      key={pi}
                      className="font-black text-slate-900 dark:text-white uppercase tracking-tighter"
                    >
                      {p.replace(/@@BOLD@@/g, "")}
                    </strong>
                  );
                }
                // Clean any other tags
                return p.replace(/\[\/?(CENTRAR|CURSIVA|SUBRAYADO|ESPACIO_FIRMA)\]/gi, "");
              })}
            </div>
          );
        });
      })()}
    </div>

    <div className="flex justify-end pt-2">{actions}</div>
  </div>
);

export default ConvenioGenerator;
