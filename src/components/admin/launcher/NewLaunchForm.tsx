/**
 * NewLaunchForm — Formulario "Nuevo Lanzamiento" reconstruido en el sistema
 * visual Paper & Ink (v3). Es puramente presentacional: recibe el estado y los
 * handlers desde LanzadorConvocatorias. Reemplaza la antigua maqueta basada en
 * Tailwind slate/blue/indigo.
 */
import React from "react";
import { FIELD_NOMBRE_INSTITUCIONES } from "../../../constants";
import type { AirtableRecord, InstitucionFields } from "../../../types";
import { ALL_ORIENTACIONES } from "../../../types";
import { normalizeStringForComparison } from "../../../utils/formatters";
import { CheckRow, FormField, FormSection } from "./LaunchFormPrimitives";
import type { FormData, ScheduleEntry } from "./launchForm.types";

const orientSlug = (o: string) =>
  o
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

interface NewLaunchFormProps {
  formData: FormData;
  setFormData: React.Dispatch<React.SetStateAction<FormData>>;
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => void;

  // Institution search
  instiSearch: string;
  setInstiSearch: (v: string) => void;
  isDropdownOpen: boolean;
  setIsDropdownOpen: (v: boolean) => void;
  filteredInstitutions: AirtableRecord<InstitucionFields>[];
  selectedInstitution: AirtableRecord<InstitucionFields> | null;
  onSelectInstitution: (inst: AirtableRecord<InstitucionFields>) => void;
  onOpenNewInstitution: () => void;
  lastLanzamiento: unknown;
  onLoadLastData: () => void;

  // Schedules & activities
  schedules: ScheduleEntry[];
  onScheduleChange: (index: number, field: "time" | "orientacion", value: string) => void;
  onAddSchedule: () => void;
  onRemoveSchedule: (index: number) => void;
  isMultiOrientation: boolean;
  safeOrientacion: string[];
  actividades: string[];
  onActivityChange: (index: number, value: string) => void;
  onAddActivity: () => void;
  onRemoveActivity: (index: number) => void;

  // AI
  rawActivityText: string;
  setRawActivityText: (v: string) => void;
  isGenerating: boolean;
  onRunAI: () => void;

  // File upload
  uploadingFile: boolean;
  onUploadFile: (file: File) => void;

  // Submit
  onPreview: () => void;
}

export const NewLaunchForm: React.FC<NewLaunchFormProps> = (props) => {
  const {
    formData,
    setFormData,
    handleChange,
    instiSearch,
    setInstiSearch,
    isDropdownOpen,
    setIsDropdownOpen,
    filteredInstitutions,
    selectedInstitution,
    onSelectInstitution,
    onOpenNewInstitution,
    lastLanzamiento,
    onLoadLastData,
    schedules,
    onScheduleChange,
    onAddSchedule,
    onRemoveSchedule,
    isMultiOrientation,
    safeOrientacion,
    actividades,
    onActivityChange,
    onAddActivity,
    onRemoveActivity,
    rawActivityText,
    setRawActivityText,
    isGenerating,
    onRunAI,
    uploadingFile,
    onUploadFile,
    onPreview,
  } = props;

  const isOnline = formData.direccion === "Modalidad Virtual";

  const toggleOrientacion = (o: string) => {
    const current = safeOrientacion;
    const already = current.some(
      (x) => normalizeStringForComparison(x) === normalizeStringForComparison(o)
    );
    const next = already
      ? current.filter((x) => normalizeStringForComparison(x) !== normalizeStringForComparison(o))
      : [...current, o];
    setFormData((prev) => ({ ...prev, orientacion: next }));
  };

  // Section completeness (for pending dots)
  const missingS1 = [
    !selectedInstitution && !instiSearch.trim(),
    !formData.nombrePPS,
    safeOrientacion.length === 0,
    !isOnline && !formData.direccion,
  ].filter(Boolean).length;
  const missingS2 = [
    !formData.fechaInicio,
    !formData.fechaInicioInscripcion || !formData.fechaFinInscripcion,
    !formData.cuposDisponibles,
    !formData.horasAcreditadas && formData.horasAcreditadas !== 0,
  ].filter(Boolean).length;
  const missingS3 = [!formData.descripcion].filter(Boolean).length;
  const missingS4 = [schedules.filter((s) => s.time.trim()).length === 0].filter(Boolean).length;
  const missingTotal = missingS1 + missingS2 + missingS3 + missingS4;
  const ready = !!formData.nombrePPS && !!formData.fechaInicio && safeOrientacion.length > 0;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto" }}>
      {/* ── 01 · INSTITUCIÓN ── */}
      <FormSection
        number="01"
        title="Institución"
        subtitle="Buscá un convenio existente o registrá uno nuevo"
        pending={missingS1}
        right={
          lastLanzamiento ? (
            <button type="button" className="btn btn-sm" onClick={onLoadLastData}>
              <span className="material-icons" style={{ fontSize: 14 }}>
                history
              </span>
              Cargar datos anteriores
            </button>
          ) : undefined
        }
      >
        {selectedInstitution ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "14px 16px",
              border: "1px solid var(--rule-2)",
              borderRadius: 10,
              background: "var(--paper-2)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
              <span className="material-icons" style={{ fontSize: 18, color: "var(--ink-3)" }}>
                apartment
              </span>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                {(selectedInstitution[FIELD_NOMBRE_INSTITUCIONES] as string) || "Institución"}
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setInstiSearch("");
                setIsDropdownOpen(true);
                onSelectInstitution(null as unknown as AirtableRecord<InstitucionFields>);
              }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                swap_horiz
              </span>
              Cambiar
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
              <span
                className="material-icons"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 16,
                  color: "var(--ink-4)",
                  pointerEvents: "none",
                }}
              >
                search
              </span>
              <input
                className="field"
                style={{ paddingLeft: 38 }}
                value={instiSearch}
                onChange={(e) => {
                  setInstiSearch(e.target.value);
                  setIsDropdownOpen(true);
                }}
                onFocus={() => setIsDropdownOpen(true)}
                placeholder="Escribí para buscar institución…"
                autoComplete="off"
              />
              {isDropdownOpen && filteredInstitutions.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    zIndex: 100,
                    marginTop: 6,
                    width: "100%",
                    background: "var(--paper)",
                    borderRadius: 10,
                    border: "1px solid var(--rule-2)",
                    boxShadow: "0 12px 28px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    maxHeight: 280,
                    overflowY: "auto",
                  }}
                >
                  {filteredInstitutions.map((inst) => (
                    <button
                      key={inst.id}
                      type="button"
                      onClick={() => onSelectInstitution(inst)}
                      style={{
                        width: "100%",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "11px 14px",
                        border: "none",
                        borderBottom: "1px solid var(--rule-2)",
                        background: "transparent",
                        cursor: "pointer",
                        fontFamily: "inherit",
                        textAlign: "left",
                        color: "var(--ink-2)",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper-2)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      <span
                        className="material-icons"
                        style={{ fontSize: 16, color: "var(--ink-4)" }}
                      >
                        business
                      </span>
                      <span style={{ fontSize: 13.5, fontWeight: 500 }}>
                        {inst[FIELD_NOMBRE_INSTITUCIONES] as string}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="button"
              className="btn"
              style={{ borderStyle: "dashed" }}
              onClick={onOpenNewInstitution}
            >
              <span className="material-icons" style={{ fontSize: 16 }}>
                add
              </span>
              Nueva institución
            </button>
          </div>
        )}

        {selectedInstitution && lastLanzamiento ? (
          <div
            className="lf-info-box"
            style={{ marginTop: 12, borderLeft: "3px solid var(--warn)" }}
          >
            <CheckRow
              label="Marcar como renovación de convenio"
              sublabel="Tildalo solo en la primera PPS después de renovar el convenio (≈ cada 2 años). El resto van sin tildar."
              checked={!!formData.convenioRenovado}
              onChange={(v) => setFormData((prev) => ({ ...prev, convenioRenovado: v }))}
            />
          </div>
        ) : null}
      </FormSection>

      {/* ── 02 · DATOS BÁSICOS ── */}
      <FormSection
        number="02"
        title="Datos básicos"
        subtitle="Nombre visible, orientación, cupos y fechas"
        pending={missingS2}
      >
        <FormField label="Nombre PPS · visible para estudiantes">
          <input
            className="field"
            name="nombrePPS"
            value={(formData.nombrePPS as string) || ""}
            onChange={handleChange}
            placeholder="Ej: PPS Clínica · Hospital General · 2026-2"
          />
        </FormField>

        <div className="lf-grid-2">
          <FormField label="Orientaciones">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {ALL_ORIENTACIONES.map((o) => {
                const on = safeOrientacion.some(
                  (s) => normalizeStringForComparison(s) === normalizeStringForComparison(o)
                );
                return (
                  <button
                    key={o}
                    type="button"
                    className={`chip-orient ${on ? "" : "off"}`}
                    data-orient={orientSlug(o)}
                    onClick={() => toggleOrientacion(o)}
                  >
                    {o}
                  </button>
                );
              })}
            </div>
          </FormField>

          <FormField label="Dirección / lugar">
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                className="field"
                name="direccion"
                value={isOnline ? "" : (formData.direccion as string) || ""}
                onChange={handleChange}
                placeholder={isOnline ? "Online · sin dirección" : "Ej: Gallo 1330, CABA"}
                disabled={isOnline}
                style={{ opacity: isOnline ? 0.5 : 1 }}
              />
              <label className="lf-check" style={{ whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={isOnline}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      direccion: e.target.checked ? "Modalidad Virtual" : "",
                    }))
                  }
                />
                <span className="lf-check-label">Online</span>
              </label>
            </div>
          </FormField>
        </div>

        <div className="lf-grid-3">
          <FormField label="Cupos">
            <input
              className="field"
              type="number"
              name="cuposDisponibles"
              value={formData.cuposDisponibles as number}
              onChange={handleChange}
              placeholder="4"
              min={1}
            />
          </FormField>
          <FormField label="Horas acreditadas">
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                className="field"
                type="number"
                name="horasAcreditadas"
                value={
                  formData.horasAcreditadas === 0 ? "" : (formData.horasAcreditadas as number) || ""
                }
                onChange={handleChange}
                placeholder={formData.horasAcreditadas === 0 ? "Según recorrido" : "80"}
                disabled={formData.horasAcreditadas === 0}
                min={1}
              />
              <CheckRow
                label="Según recorrido"
                sublabel="El volumen de horas no está prefijado y se define según el recorrido del estudiante"
                checked={formData.horasAcreditadas === 0}
                onChange={(checked) => {
                  setFormData((prev) => ({
                    ...prev,
                    horasAcreditadas: checked ? 0 : 80,
                  }));
                }}
              />
            </div>
          </FormField>
          <FormField label="Encuentro inicial">
            <input
              className="field"
              type="datetime-local"
              name="fechaEncuentroInicial"
              value={(formData.fechaEncuentroInicial as string) || ""}
              onChange={handleChange}
            />
          </FormField>
        </div>

        <div className="lf-grid-2" style={{ marginTop: 4 }}>
          <FormField label="Inicio de práctica">
            <input
              className="field"
              type="date"
              name="fechaInicio"
              value={(formData.fechaInicio as string) || ""}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="Fin de práctica">
            <input
              className="field"
              type="date"
              name="fechaFin"
              value={(formData.fechaFin as string) || ""}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="Inscripción desde">
            <input
              className="field"
              type="date"
              name="fechaInicioInscripcion"
              value={(formData.fechaInicioInscripcion as string) || ""}
              onChange={handleChange}
            />
          </FormField>
          <FormField label="Inscripción hasta">
            <input
              className="field"
              type="date"
              name="fechaFinInscripcion"
              value={(formData.fechaFinInscripcion as string) || ""}
              onChange={handleChange}
            />
          </FormField>
        </div>

        <div style={{ display: "flex", gap: 28, flexWrap: "wrap", marginTop: 4 }}>
          <CheckRow
            label="Pedir certificado de trabajo"
            checked={formData.reqCertificadoTrabajo}
            onChange={(v) => setFormData((prev) => ({ ...prev, reqCertificadoTrabajo: v }))}
          />
          <CheckRow
            label="Solicitar CV"
            checked={formData.reqCv}
            onChange={(v) => setFormData((prev) => ({ ...prev, reqCv: v }))}
          />
        </div>

        <div className="lf-info-box" style={{ marginTop: 16 }}>
          <CheckRow
            label="Programar lanzamiento automático"
            sublabel="La convocatoria se publicará sola en la fecha y hora indicadas"
            checked={formData.programarLanzamiento}
            onChange={(v) => setFormData((prev) => ({ ...prev, programarLanzamiento: v }))}
          />
          {formData.programarLanzamiento && (
            <div style={{ marginTop: 12 }}>
              <input
                className="field"
                type="datetime-local"
                name="fechaPublicacion"
                value={formData.fechaPublicacion}
                onChange={handleChange}
              />
            </div>
          )}
        </div>
      </FormSection>

      {/* ── 03 · CONTENIDO ── */}
      <FormSection
        number="03"
        title="Contenido y actividades"
        subtitle="Qué hace el estudiante en esta práctica"
        pending={missingS3}
      >
        <div className="lf-callout">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 8,
              flexWrap: "wrap",
            }}
          >
            <span
              className="label"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--ai)" }}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                auto_awesome
              </span>
              Asistente IA · material de referencia
            </span>
            <button
              type="button"
              className="btn btn-ai btn-sm"
              onClick={onRunAI}
              disabled={isGenerating || !rawActivityText.trim()}
              style={{ opacity: isGenerating || !rawActivityText.trim() ? 0.5 : 1 }}
            >
              <span
                className={`material-icons ${isGenerating ? "lf-spin" : ""}`}
                style={{ fontSize: 14 }}
              >
                {isGenerating ? "autorenew" : "auto_fix_high"}
              </span>
              {isGenerating ? "Analizando…" : "Generar con IA"}
            </button>
          </div>
          <div className="meta" style={{ marginBottom: 8 }}>
            Pegá el email, propuesta o programa que te mandaron. La IA arma descripción, actividades
            y horarios.
          </div>
          <textarea
            className="field"
            value={rawActivityText}
            onChange={(e) => setRawActivityText(e.target.value)}
            placeholder="Pegá acá el material de referencia…"
            style={{ minHeight: 90, background: "var(--paper)" }}
          />
        </div>

        <FormField label="Descripción de la propuesta · visible para estudiantes">
          <textarea
            className="field"
            name="descripcion"
            value={formData.descripcion}
            onChange={handleChange}
            placeholder="¿En qué consiste la práctica? ¿Quién supervisa? ¿Cómo es la dinámica?"
            style={{ minHeight: 110 }}
          />
        </FormField>

        <FormField
          label={
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}
            >
              Lista de actividades
              <input
                className="field"
                name="actividadesLabel"
                value={formData.actividadesLabel}
                onChange={handleChange}
                placeholder="Título de la lista"
                style={{
                  width: 180,
                  padding: "4px 8px",
                  fontSize: 11,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              />
            </span>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {actividades.map((act, idx) => (
              <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="lf-act-num">{String(idx + 1).padStart(2, "0")}</span>
                <input
                  className="field"
                  value={act}
                  onChange={(e) => onActivityChange(idx, e.target.value)}
                  placeholder={`Actividad ${idx + 1}`}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => onRemoveActivity(idx)}
                  title="Eliminar"
                >
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    close
                  </span>
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={onAddActivity}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                add
              </span>
              Agregar actividad
            </button>
          </div>
        </FormField>

        <FormField label="Requisito excluyente · opcional">
          <input
            className="field"
            name="requisitoObligatorio"
            value={formData.requisitoObligatorio}
            onChange={handleChange}
            placeholder="Ej: Tener aprobada Psicopatología I"
          />
        </FormField>

        <FormField
          label="Archivo descargable · opcional"
          hint="Subí un archivo o pegá una URL externa."
        >
          <div className="lf-grid-2">
            <input
              className="field"
              name="archivoDescargableNombre"
              value={formData.archivoDescargableNombre}
              onChange={handleChange}
              placeholder="Descripción del archivo"
            />
            {formData.archivoDescargableUrl ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: "1px solid var(--ok)",
                  background: "var(--ok-soft)",
                }}
              >
                <span className="material-icons" style={{ fontSize: 16, color: "var(--ok)" }}>
                  check_circle
                </span>
                <span style={{ fontSize: 12.5, color: "var(--ink-2)", flex: 1 }}>
                  Archivo subido
                </span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setFormData((prev) => ({ ...prev, archivoDescargableUrl: "" }))}
                >
                  <span className="material-icons" style={{ fontSize: 14 }}>
                    close
                  </span>
                </button>
              </div>
            ) : (
              <label
                className="btn"
                style={{ justifyContent: "center", borderStyle: "dashed", cursor: "pointer" }}
              >
                <span className="material-icons" style={{ fontSize: 16 }}>
                  {uploadingFile ? "autorenew" : "upload_file"}
                </span>
                {uploadingFile ? "Subiendo…" : "Subir archivo"}
                <input
                  type="file"
                  style={{ display: "none" }}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.rar"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadFile(file);
                  }}
                />
              </label>
            )}
          </div>
          <input
            className="field"
            name="archivoDescargableUrl"
            value={formData.archivoDescargableUrl}
            onChange={handleChange}
            placeholder="…o pegá una URL externa"
            style={{ marginTop: 8 }}
          />
        </FormField>

        <FormField
          label="Link de la Tarea · Campus / Moodle · opcional"
          hint="Pegá el enlace de la Tarea (buzón de entrega) que creaste en Moodle. El campus generará solo la tarjeta de entrega en la orientación correspondiente."
        >
          <input
            className="field"
            name="linkTareaCampus"
            value={(formData.linkTareaCampus as string) || ""}
            onChange={handleChange}
            placeholder="https://campus.uflo.edu.ar/mod/assign/view.php?id=…"
          />
        </FormField>
      </FormSection>

      {/* ── 04 · HORARIOS ── */}
      <FormSection
        number="04"
        title="Horarios y supervisores"
        subtitle="Franjas disponibles y comisiones"
        pending={missingS4}
        right={
          <CheckRow
            label="Horarios fijos (obligatorios)"
            checked={formData.horariosFijos}
            onChange={(v) => setFormData((prev) => ({ ...prev, horariosFijos: v }))}
          />
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {schedules.map((schedule, idx) => (
            <div
              key={idx}
              style={{
                display: "grid",
                gridTemplateColumns:
                  isMultiOrientation && safeOrientacion.length >= 2 ? "1fr 180px auto" : "1fr auto",
                gap: 8,
                alignItems: "center",
              }}
            >
              <input
                className="field"
                value={schedule.time}
                onChange={(e) => onScheduleChange(idx, "time", e.target.value)}
                placeholder="Ej: Lunes 9 a 12 hs · Lic. Pérez"
              />
              {isMultiOrientation && safeOrientacion.length >= 2 && (
                <select
                  className="field"
                  value={schedule.orientacion}
                  onChange={(e) => onScheduleChange(idx, "orientacion", e.target.value)}
                >
                  <option value="">Cualquiera</option>
                  {safeOrientacion.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onRemoveSchedule(idx)}
                title="Eliminar horario"
              >
                <span className="material-icons" style={{ fontSize: 14 }}>
                  delete
                </span>
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ alignSelf: "flex-start" }}
            onClick={onAddSchedule}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              add
            </span>
            Agregar franja
          </button>
        </div>
      </FormSection>

      {/* ── CTA ── */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 12,
          padding: "16px 0",
          background: "linear-gradient(180deg, transparent, var(--paper) 30%)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div className="meta">
          {ready
            ? "Listo para previsualizar y publicar."
            : "Completá los datos mínimos: nombre, fecha de inicio y orientación."}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onPreview}
          style={{ padding: "10px 20px", borderRadius: 999 }}
        >
          <span className="material-icons" style={{ fontSize: 16 }}>
            {formData.programarLanzamiento ? "schedule_send" : "visibility"}
          </span>
          Previsualizar y lanzar
          {missingTotal > 0 && (
            <span
              className="mono"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 4,
                background: "var(--warn-soft)",
                color: "var(--warn)",
              }}
            >
              {missingTotal}
            </span>
          )}
        </button>
      </div>
    </div>
  );
};

export default NewLaunchForm;
