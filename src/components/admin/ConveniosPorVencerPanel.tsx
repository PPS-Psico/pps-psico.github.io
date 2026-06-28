/**
 * ConveniosPorVencerPanel — alta de convenios + alerta de próximos a vencer.
 *
 * · Formulario para registrar un convenio (institución, fecha de firma, tipo,
 *   si es renovación). El vencimiento lo calcula la DB (firma + 24 meses) y el
 *   trigger sincroniza instituciones.convenio_nuevo.
 * · Tabla de convenios que vencen dentro de los próximos 90 días sin renovar.
 *
 * Estilo Paper & Ink scoped (.cpv), consistente con NuevosConvenios (.nco).
 */
import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../../lib/db";
import { fetchConveniosPorVencer, crearConvenio } from "../../services/conveniosService";
import { FIELD_NOMBRE_INSTITUCIONES } from "../../constants";
import Loader from "../Loader";
import Toast from "../ui/Toast";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { formatDate, getGroupName } from "../../utils/formatters";

const CSS = `
.cpv {
  --paper:#F7F5F0; --paper-2:#EFECE4;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --warn:#B4501E; --warn-s:#B4501E14; --ok:#2F5F3A;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .cpv {
  --paper:#0E0E0C; --paper-2:#17171A;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --warn:#E4965D; --warn-s:#E4965D1A; --ok:#88BD96;
}
.cpv .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.02em; }
.cpv .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }
.cpv-section + .cpv-section{ margin-top:30px; }
.cpv-head h3{ font-family:'Instrument Serif', serif; font-size:22px; font-weight:700; margin:5px 0 0; }
.cpv-head p{ font-size:13px; color:var(--ink-3); margin:4px 0 0; max-width:560px; }
.cpv-form{ display:grid; grid-template-columns:1.6fr 1fr 1fr auto; gap:10px; align-items:end; margin-top:14px; }
@media (max-width:760px){ .cpv-form{ grid-template-columns:1fr 1fr; } }
.cpv-field{ display:flex; flex-direction:column; gap:4px; }
.cpv-field label{ font-size:11px; color:var(--ink-3); font-weight:600; }
.cpv-field select, .cpv-field input{ font-family:inherit; font-size:13px; padding:9px 11px; border:1px solid var(--rule-2); border-radius:9px; background:var(--paper); color:var(--ink); }
.cpv-check{ display:flex; align-items:center; gap:7px; font-size:13px; color:var(--ink-2); }
.cpv-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:10px 16px; border-radius:9px; border:1px solid var(--ink); background:var(--ink); color:var(--paper); cursor:pointer; font-family:inherit; white-space:nowrap; }
.cpv-btn:hover{ opacity:.9; } .cpv-btn:disabled{ opacity:.5; cursor:not-allowed; }
.cpv-table{ width:100%; border-collapse:collapse; margin-top:14px; }
.cpv-table th{ text-align:left; font-size:10.5px; text-transform:uppercase; letter-spacing:.08em; color:var(--ink-3); padding:8px 10px; border-bottom:1px solid var(--rule-3); }
.cpv-table td{ font-size:13px; color:var(--ink-2); padding:11px 10px; border-bottom:1px solid var(--rule-2); }
.cpv-pill{ display:inline-block; font-size:11px; font-weight:600; padding:2px 9px; border-radius:999px; }
.cpv-pill.warn{ background:var(--warn-s); color:var(--warn); }
.cpv-empty{ display:flex; align-items:center; gap:9px; padding:14px 16px; border:1px dashed var(--rule-3); border-radius:10px; color:var(--ink-3); font-size:13px; margin-top:14px; }
.cpv-empty .material-icons{ font-size:17px; color:var(--ok); }
`;
injectScopedStyles("cpv-styles", CSS);
injectPremiumMotion();

const ConveniosPorVencerPanel: React.FC<{ isTestingMode?: boolean }> = ({
  isTestingMode = false,
}) => {
  const queryClient = useQueryClient();
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [institucionId, setInstitucionId] = useState("");
  const [fechaFirma, setFechaFirma] = useState("");
  const [tipo, setTipo] = useState<"marco" | "especifico">("marco");
  const [esRenovacion, setEsRenovacion] = useState(false);

  const { data: instituciones = [] } = useQuery({
    queryKey: ["institucionesAll", isTestingMode],
    queryFn: () => db.instituciones.getAll(),
    enabled: !isTestingMode,
  });

  const { data: porVencer = [], isLoading } = useQuery({
    queryKey: ["conveniosPorVencer", isTestingMode],
    queryFn: () => fetchConveniosPorVencer(90),
    enabled: !isTestingMode,
  });

  const crearMutation = useMutation({
    mutationFn: () => crearConvenio({ institucionId, fechaFirma, tipo, esRenovacion }),
    onSuccess: () => {
      setToast({ message: "Convenio registrado.", type: "success" });
      setInstitucionId("");
      setFechaFirma("");
      setEsRenovacion(false);
      queryClient.invalidateQueries({ queryKey: ["conveniosPorVencer"] });
      queryClient.invalidateQueries({ queryKey: ["conveniosKpis"] });
      queryClient.invalidateQueries({ queryKey: ["metricsData"] });
      queryClient.invalidateQueries({ queryKey: ["metricsKPIs"] });
    },
    onError: (e: Error) => setToast({ message: `Error: ${e.message}`, type: "error" }),
  });

  const canSubmit = institucionId && fechaFirma && !crearMutation.isPending;

  return (
    <div className="cpv">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

      {/* Alta de convenio */}
      <section className="cpv-section">
        <div className="cpv-head">
          <span className="eyebrow">Registrar</span>
          <h3 className="serif">Nuevo convenio o renovación</h3>
          <p>
            El vencimiento se calcula solo (firma + 2 años). Marcá "renovación" si ya existía
            vínculo previo con la institución.
          </p>
        </div>
        <div className="cpv-form">
          <div className="cpv-field">
            <label>Institución</label>
            <select value={institucionId} onChange={(e) => setInstitucionId(e.target.value)}>
              <option value="">Seleccionar…</option>
              {[...instituciones]
                .sort((a, b) =>
                  String(a[FIELD_NOMBRE_INSTITUCIONES] || "").localeCompare(
                    String(b[FIELD_NOMBRE_INSTITUCIONES] || "")
                  )
                )
                .map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {getGroupName(i[FIELD_NOMBRE_INSTITUCIONES] || "—")}
                  </option>
                ))}
            </select>
          </div>
          <div className="cpv-field">
            <label>Fecha de firma</label>
            <input type="date" value={fechaFirma} onChange={(e) => setFechaFirma(e.target.value)} />
          </div>
          <div className="cpv-field">
            <label>Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "marco" | "especifico")}
            >
              <option value="marco">Marco</option>
              <option value="especifico">Específico</option>
            </select>
          </div>
          <button className="cpv-btn" disabled={!canSubmit} onClick={() => crearMutation.mutate()}>
            <span className="material-icons" style={{ fontSize: 16 }}>
              add_task
            </span>
            Registrar
          </button>
        </div>
        <label className="cpv-check" style={{ marginTop: 10 }}>
          <input
            type="checkbox"
            checked={esRenovacion}
            onChange={(e) => setEsRenovacion(e.target.checked)}
          />
          Es una renovación (la institución ya tenía convenio antes)
        </label>
      </section>

      {/* Próximos a vencer */}
      <section className="cpv-section">
        <div className="cpv-head">
          <span className="eyebrow">Alerta · 90 días</span>
          <h3 className="serif">Convenios próximos a vencer</h3>
          <p>
            Convenios vigentes cuyo vencimiento cae dentro de los próximos 90 días y que aún no
            fueron renovados.
          </p>
        </div>
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24 }}>
            <Loader />
          </div>
        ) : porVencer.length === 0 ? (
          <div className="cpv-empty">
            <span className="material-icons">check_circle</span>
            No hay convenios por vencer en los próximos 90 días.
          </div>
        ) : (
          <table className="cpv-table">
            <thead>
              <tr>
                <th>Institución</th>
                <th>Tipo</th>
                <th>Firma</th>
                <th>Vence</th>
                <th>Restan</th>
              </tr>
            </thead>
            <tbody>
              {porVencer.map((c) => (
                <tr key={c.convenio_id}>
                  <td>{getGroupName(c.institucion || "—")}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.tipo}</td>
                  <td>{formatDate(c.fecha_firma)}</td>
                  <td>{formatDate(c.fecha_vencimiento)}</td>
                  <td>
                    <span className={`cpv-pill ${c.dias_restantes <= 30 ? "warn" : ""}`}>
                      {c.dias_restantes} días
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
};

export default ConveniosPorVencerPanel;
