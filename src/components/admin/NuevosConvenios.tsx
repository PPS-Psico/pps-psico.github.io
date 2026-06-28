/**
 * NuevosConvenios — Rediseño v1 (Paper & Ink editorial)
 *
 * Solo cambia la capa visual. La lógica se preserva intacta:
 *   · Query de instituciones + lanzamientos.
 *   · Derivación de convenios confirmados vs. potenciales del año.
 *   · confirmMutation que marca el año de convenio en la institución.
 */
import React, { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { db } from "../../lib/db";
import { crearConvenio } from "../../services/conveniosService";
import {
  FIELD_NOMBRE_INSTITUCIONES,
  FIELD_CONVENIO_NUEVO_INSTITUCIONES,
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
} from "../../constants";
import Loader from "../Loader";
import EmptyState from "../EmptyState";
import Toast from "../ui/Toast";
import { injectScopedStyles } from "../../utils/injectScopedStyles";
import { injectPremiumMotion } from "./premiumMotion";
import { logger } from "../../utils/logger";
import {
  normalizeStringForComparison,
  parseToUTCDate,
  formatDate,
  getGroupName,
} from "../../utils/formatters";

interface PotentialAgreement {
  institutionId: string;
  institutionName: string;
  launches: { id: string; name: string; date: string }[];
}

// ─── CSS scoped (Paper & Ink editorial) ───────────────────────────────────────
const CSS = `
.nco {
  --paper:#F7F5F0; --paper-2:#EFECE4; --paper-3:#E5E1D7;
  --ink:#14130F; --ink-2:#2A2823; --ink-3:#6B6660; --ink-4:#A8A39C;
  --rule-2:#1413101A; --rule-3:#1413102E;
  --accent:#1F3A8A; --accent-s:#1F3A8A14;
  --warn:#B4501E; --warn-s:#B4501E14;
  --ok:#2F5F3A; --ok-s:#2F5F3A14;
  color:var(--ink); font-family:'Hanken Grotesk', system-ui, sans-serif;
}
html.dark .nco {
  --paper:#0E0E0C; --paper-2:#17171A; --paper-3:#1F1F23;
  --ink:#F2EFE8; --ink-2:#DAD6CD; --ink-3:#97928A; --ink-4:#5C5852;
  --rule-2:#F2EFE822; --rule-3:#F2EFE836;
  --accent:#8FB1FF; --accent-s:#8FB1FF1A;
  --warn:#E4965D; --warn-s:#E4965D1A;
  --ok:#88BD96; --ok-s:#88BD961A;
}
.nco .serif{ font-family:'Instrument Serif', serif; letter-spacing:-0.025em; }
.nco .mono{ font-family:'JetBrains Mono', ui-monospace, monospace; }
.nco .eyebrow{ font-size:10.5px; text-transform:uppercase; letter-spacing:.12em; font-weight:600; color:var(--ink-3); }

.nco-section + .nco-section{ margin-top:30px; }
.nco-section-head{ margin-bottom:14px; }
.nco-section-head h3{ font-family:'Instrument Serif', serif; font-size:22px; font-weight:700; letter-spacing:-0.02em; margin:5px 0 0; }
.nco-section-head p{ font-size:13px; color:var(--ink-3); margin:4px 0 0; max-width:560px; }

/* Confirmados */
.nco-confirmed{ display:grid; grid-template-columns:repeat(auto-fill, minmax(220px,1fr)); gap:8px; }
.nco-conf-item{ display:flex; align-items:center; gap:9px; padding:11px 14px; border:1px solid var(--rule-2); border-radius:10px; background:var(--paper); }
.nco-conf-item .material-icons{ font-size:17px; color:var(--ok); }
.nco-conf-name{ font-size:13.5px; color:var(--ink-2); font-weight:500; }

/* Potenciales */
.nco-pot{ border:1px solid var(--rule-2); border-left:3px solid var(--warn); border-radius:12px; background:var(--paper); padding:16px 18px; display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
.nco-pot + .nco-pot{ margin-top:10px; }
.nco-pot-name{ font-size:15px; font-weight:600; color:var(--ink); }
.nco-pot-launches{ margin-top:8px; display:flex; flex-direction:column; gap:3px; }
.nco-pot-launch{ font-size:12px; color:var(--ink-3); }
.nco-pot-launch .mono{ color:var(--ink-4); }
.nco-btn{ display:inline-flex; align-items:center; gap:7px; font-size:13px; font-weight:500; padding:9px 15px; border-radius:9px; border:1px solid var(--ink); background:var(--ink); color:var(--paper); cursor:pointer; font-family:inherit; transition:opacity .12s; white-space:nowrap; flex-shrink:0; }
.nco-btn:hover{ opacity:.9; }
.nco-btn:disabled{ opacity:.5; cursor:not-allowed; }
.nco-btn .material-icons{ font-size:16px; }
@keyframes nco-spin{ to{ transform:rotate(360deg); } }
.nco-spin{ width:14px; height:14px; border:2px solid rgba(255,255,255,.4); border-top-color:#fff; border-radius:999px; animation:nco-spin .8s linear infinite; }
.nco-empty{ display:flex; align-items:center; gap:9px; padding:14px 16px; border:1px dashed var(--rule-3); border-radius:10px; color:var(--ink-3); font-size:13px; }
.nco-empty .material-icons{ font-size:17px; color:var(--ok); }
`;
injectScopedStyles("nco-styles", CSS);
injectPremiumMotion();

const NuevosConvenios: React.FC<{ isTestingMode?: boolean }> = ({ isTestingMode = false }) => {
  const queryClient = useQueryClient();
  const [toastInfo, setToastInfo] = useState<{ message: string; type: "success" | "error" } | null>(
    null
  );
  const year = new Date().getFullYear();

  const { data, isLoading, error } = useQuery({
    queryKey: ["conveniosData", isTestingMode],
    queryFn: async () => {
      if (isTestingMode) {
        return {
          instituciones: [
            {
              id: "inst_test_1",
              createdTime: "",
              [FIELD_NOMBRE_INSTITUCIONES]: "Inst Test Nueva",
              [FIELD_CONVENIO_NUEVO_INSTITUCIONES]: 2024,
            } as any,
            {
              id: "inst_test_2",
              createdTime: "",
              [FIELD_NOMBRE_INSTITUCIONES]: "Inst Test Potencial",
            } as any,
          ],
          lanzamientos: [
            {
              id: "lanz_test_1",
              createdTime: "",
              [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Inst Test Nueva - Sede A",
              [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-03-01`,
            } as any,
            {
              id: "lanz_test_2",
              createdTime: "",
              [FIELD_NOMBRE_PPS_LANZAMIENTOS]: "Inst Test Potencial - Taller B",
              [FIELD_FECHA_INICIO_LANZAMIENTOS]: `${new Date().getFullYear()}-04-01`,
            } as any,
          ],
        };
      }
      const [institucionesRes, lanzamientosRes] = await Promise.all([
        db.instituciones.getAll(),
        db.lanzamientos.getAll(),
      ]);
      return { instituciones: institucionesRes, lanzamientos: lanzamientosRes };
    },
  });

  const confirmMutation = useMutation({
    mutationFn: (institutionId: string) => {
      const currentYear = new Date().getFullYear();
      if (isTestingMode) {
        logger.info("TEST MODE: Confirming agreement for", institutionId);
        return new Promise((resolve) => setTimeout(resolve, 500));
      }
      // Registramos un convenio (primer convenio = no renovación). El trigger de
      // la DB sincroniza instituciones.convenio_nuevo = año del primer convenio.
      return crearConvenio({
        institucionId: institutionId,
        fechaFirma: `${currentYear}-01-01`,
        tipo: "marco",
        esRenovacion: false,
      });
    },
    onSuccess: () => {
      setToastInfo({ message: "Convenio confirmado con éxito.", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["conveniosData", isTestingMode] });
      queryClient.invalidateQueries({ queryKey: ["metricsData"] });
      queryClient.invalidateQueries({ queryKey: ["metricsKPIs"] });
      queryClient.invalidateQueries({ queryKey: ["conveniosKpis"] });
    },
    onError: (e: Error) => {
      setToastInfo({ message: `Error al confirmar: ${e.message}`, type: "error" });
    },
  });

  const { confirmed, potentials } = useMemo(() => {
    if (!data) return { confirmed: [] as string[], potentials: [] as PotentialAgreement[] };

    const currentYear = new Date().getFullYear();

    const institutionsMap = new Map<string, { id: string; isNew: boolean; year?: number }>();
    data.instituciones.forEach((inst) => {
      const name = inst[FIELD_NOMBRE_INSTITUCIONES];
      if (name) {
        const yearVal = Number(inst[FIELD_CONVENIO_NUEVO_INSTITUCIONES]);
        const isNew = !isNaN(yearVal) && yearVal >= currentYear - 1; // Consideramos "Nuevo" si es de este año o el anterior
        institutionsMap.set(normalizeStringForComparison(name), {
          id: inst.id,
          isNew,
          year: yearVal,
        });
      }
    });

    const launchesThisYear = data.lanzamientos
      .filter((l) => {
        const date = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS]);
        return date && date.getUTCFullYear() === currentYear;
      })
      .sort((a, b) => {
        const dateA = parseToUTCDate(a[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getTime() || 0;
        const dateB = parseToUTCDate(b[FIELD_FECHA_INICIO_LANZAMIENTOS])?.getTime() || 0;
        return dateA - dateB;
      });

    const confirmedMap = new Map<string, Date>();
    const potentialsMap = new Map<string, PotentialAgreement>();

    launchesThisYear.forEach((launch) => {
      const ppsName = launch[FIELD_NOMBRE_PPS_LANZAMIENTOS];
      if (!ppsName) return;

      const groupName = getGroupName(ppsName);
      const normalizedGroupName = normalizeStringForComparison(groupName);
      const institutionInfo = institutionsMap.get(normalizedGroupName);

      if (institutionInfo) {
        if (institutionInfo.isNew) {
          if (!confirmedMap.has(groupName)) {
            const launchDate = parseToUTCDate(launch[FIELD_FECHA_INICIO_LANZAMIENTOS]);
            if (launchDate) {
              confirmedMap.set(groupName, launchDate);
            }
          }
        } else {
          if (!potentialsMap.has(institutionInfo.id)) {
            potentialsMap.set(institutionInfo.id, {
              institutionId: institutionInfo.id,
              institutionName: groupName,
              launches: [],
            });
          }
          potentialsMap.get(institutionInfo.id)!.launches.push({
            id: launch.id,
            name: ppsName,
            date: launch[FIELD_FECHA_INICIO_LANZAMIENTOS] || "N/A",
          });
        }
      }
    });

    const confirmed = Array.from(confirmedMap.entries())
      .map(([name, date]) => ({ name, date }))
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((item) => item.name);

    return {
      confirmed,
      potentials: Array.from(potentialsMap.values()).sort((a, b) =>
        a.institutionName.localeCompare(b.institutionName)
      ),
    };
  }, [data]);

  if (isLoading)
    return (
      <div className="nco" style={{ display: "flex", justifyContent: "center", padding: 32 }}>
        <Loader />
      </div>
    );
  if (error) return <EmptyState icon="error" title="Error" message={error.message} />;

  return (
    <div className="nco">
      {toastInfo && (
        <Toast
          message={toastInfo.message}
          type={toastInfo.type}
          onClose={() => setToastInfo(null)}
        />
      )}

      {/* Confirmados */}
      <section className="nco-section">
        <div className="nco-section-head">
          <span className="eyebrow">Confirmados · {year}</span>
          <h3 className="serif">Convenios nuevos confirmados</h3>
          <p>Instituciones marcadas como "convenio nuevo" que tuvieron lanzamientos este año.</p>
        </div>
        {confirmed.length > 0 ? (
          <div className="nco-confirmed">
            {confirmed.map((name) => (
              <div key={name} className="nco-conf-item">
                <span className="material-icons">check_circle</span>
                <span className="nco-conf-name">{name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="nco-empty">
            <span className="material-icons" style={{ color: "var(--ink-4)" }}>
              info
            </span>
            No se han confirmado convenios nuevos este año.
          </div>
        )}
      </section>

      {/* Potenciales */}
      <section className="nco-section">
        <div className="nco-section-head">
          <span className="eyebrow">Por revisar</span>
          <h3 className="serif">Posibles convenios a confirmar</h3>
          <p>
            Instituciones con lanzamientos este año que todavía no tienen el año de convenio
            marcado.
          </p>
        </div>
        {potentials.length > 0 ? (
          <div>
            {potentials.map((item) => (
              <div key={item.institutionId} className="nco-pot">
                <div style={{ minWidth: 0 }}>
                  <div className="nco-pot-name">{item.institutionName}</div>
                  <div className="nco-pot-launches">
                    {item.launches.map((l) => (
                      <div key={l.id} className="nco-pot-launch">
                        {l.name} <span className="mono">· {formatDate(l.date)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  className="nco-btn"
                  onClick={() => confirmMutation.mutate(item.institutionId)}
                  disabled={
                    confirmMutation.isPending && confirmMutation.variables === item.institutionId
                  }
                >
                  {confirmMutation.isPending && confirmMutation.variables === item.institutionId ? (
                    <span className="nco-spin" />
                  ) : (
                    <span className="material-icons">add_task</span>
                  )}
                  Confirmar {year}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="nco-empty">
            <span className="material-icons">check_circle</span>
            Todas las instituciones con lanzamientos este año están correctamente marcadas.
          </div>
        )}
      </section>
    </div>
  );
};

export default NuevosConvenios;
