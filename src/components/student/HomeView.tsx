import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  CompromisoPPS,
  Convocatoria,
  LanzamientoPPS,
  EstudianteFields,
  InformeTask,
  TabId,
  CriteriosCalculados,
  FinalizacionPPS,
} from "../../types";
import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_HORAS_PRACTICAS,
  FIELD_HORARIO_FORMULA_CONVOCATORIAS,
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTADO_PRACTICA,
  FIELD_FECHA_INICIO_PRACTICAS,
  FIELD_FECHA_FIN_PRACTICAS,
  FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS,
  FIELD_NOTA_PRACTICAS,
  FIELD_EMPRESA_PPS_SOLICITUD,
  FIELD_ESTADO_PPS,
  FIELD_ULTIMA_ACTUALIZACION_PPS,
} from "../../constants";
import {
  cleanDbValue,
  formatDate,
  normalizeStringForComparison,
  parseToUTCDate,
} from "../../utils/formatters";
import { getErrorMessage } from "../../utils/getErrorMessage";
import ConfirmModal from "../ConfirmModal";
import CompromisoPPSModal from "./CompromisoPPSModal";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useModal } from "../../contexts/ModalContext";
import { useMutation } from "@tanstack/react-query";
import { fetchSeleccionados } from "../../services";
import { mockDb } from "../../services/mockDb";
import StudentSummaryCard from "./home/StudentSummaryCard";
import StudentConvCard from "./home/StudentConvCard";
import StudentNextStepCard, { type NextStepData } from "./home/StudentNextStepCard";
import StudentAcreditacionCard from "./home/StudentAcreditacionCard";
import StudentPracRow, { type StudentPracRowData } from "./home/StudentPracRow";
import StudentSolicitudItem, { type StudentSolicitudItemData } from "./home/StudentSolicitudItem";
import StudentHomeAtlas, { AhIcon } from "./home/atlas/StudentHomeAtlas";
import MesasAvisoBanner from "./home/MesasAvisoBanner";
import StudentOnboardingCard from "./StudentOnboardingCard";
import { useStudentPanel } from "../../contexts/StudentPanelContext";
import { isPracticeDisapproved } from "../../logic/studentRules";

interface HomeViewProps {
  myEnrollments: Convocatoria[];
  allLanzamientos: LanzamientoPPS[];
  lanzamientos: LanzamientoPPS[];
  student: EstudianteFields | null;
  onInscribir: (lanzamiento: LanzamientoPPS, completedOrientaciones?: string[]) => void;
  onCancelarInscripcion: (convocatoriaId: string) => void;
  isCancelandoInscripcion?: boolean;
  institutionAddressMap: Map<string, string>;
  institutionLogoMap?: Map<string, { url: string; invert: boolean }>;
  enrollmentMap: Map<string, Convocatoria>;
  compromisoMap?: Map<string, CompromisoPPS>;
  completedLanzamientoIds: Set<string>;
  completedOrientationsByInstitution: Map<string, Set<string>>;
  informeTasks: InformeTask[];
  onNavigate: (tabId: TabId) => void;
  criterios: CriteriosCalculados;
  onOpenFinalization: () => void;
  finalizacionRequest?: FinalizacionPPS | null;
  onAcceptCompromiso?: (payload: {
    convocatoriaId: string;
    lanzamientoId: string;
    fullName: string;
    dni: number | null;
    legajo: string;
    signature: string;
  }) => Promise<void>;
  isSubmittingCompromiso?: boolean;
}

const HomeView: React.FC<HomeViewProps> = ({
  myEnrollments,
  criterios,
  lanzamientos,
  institutionAddressMap,
  enrollmentMap,
  onInscribir,
  onCancelarInscripcion,
  student,
  onAcceptCompromiso,
  isSubmittingCompromiso,
  onNavigate,
  informeTasks,
  compromisoMap,
  allLanzamientos,
}) => {
  const { authenticatedUser } = useAuth();
  const { resolvedTheme } = useTheme();
  const { openSeleccionadosModal, showModal } = useModal();
  const { practicas, solicitudes } = useStudentPanel();
  const navigate = useNavigate();
  const openDetalle = (l: LanzamientoPPS) => navigate(`/student/convocatoria/${l.id}`);
  const isTesting = authenticatedUser?.legajo === "99999";
  const [pendingCancel, setPendingCancel] = useState<{ id: string; nombre: string } | null>(null);
  const [pendingCompromiso, setPendingCompromiso] = useState<{
    lanzamiento: LanzamientoPPS;
    enrollment: Convocatoria;
  } | null>(null);

  const handleCancelarInscripcion = (convocatoriaId: string, nombrePPS: string) => {
    setPendingCancel({ id: convocatoriaId, nombre: nombrePPS });
  };

  const confirmCancelarInscripcion = () => {
    if (pendingCancel) {
      onCancelarInscripcion(pendingCancel.id);
      setPendingCancel(null);
    }
  };

  // ── Ver convocados (seleccionados) de una convocatoria cerrada ──
  const seleccionadosMutation = useMutation({
    mutationFn: async (lanzamiento: LanzamientoPPS) => {
      if (isTesting) {
        const enrollments = await mockDb.getAll("convocatorias", {
          [FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS]: lanzamiento.id,
        });
        const selected = enrollments.filter(
          (e: Record<string, unknown>) =>
            normalizeStringForComparison(e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]) ===
            "seleccionado"
        );
        if (selected.length === 0) return null;
        const studentIds = selected.map(
          (e: Record<string, unknown>) => e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]
        );
        const students = await mockDb.getAll("estudiantes", { id: studentIds });
        const studentMap = new Map<string, Record<string, unknown>>(
          students.map((s: Record<string, unknown>) => [s.id as string, s])
        );
        const grouped: Record<string, { nombre: string; legajo: string }[]> = {};
        selected.forEach((e: Record<string, unknown>) => {
          const horario = (e[FIELD_HORARIO_FORMULA_CONVOCATORIAS] as string) || "No especificado";
          const s = studentMap.get(e[FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS] as string);
          if (s) {
            if (!grouped[horario]) grouped[horario] = [];
            grouped[horario].push({
              nombre: s[FIELD_NOMBRE_ESTUDIANTES] as string,
              legajo: s[FIELD_LEGAJO_ESTUDIANTES] as string,
            });
          }
        });
        return grouped;
      }
      return fetchSeleccionados(lanzamiento);
    },
    onSuccess: (data, lanzamiento) => {
      const title = lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] || "Convocatoria";
      openSeleccionadosModal(data, title);
    },
    onError: (error) => showModal("Error", getErrorMessage(error)),
  });

  // ── Saludo editorial ──────────────────────────────────────────
  const now = new Date();
  const hour = now.getHours();
  const greeting =
    hour < 12 && hour >= 5
      ? "Buenos días"
      : hour < 20 && hour >= 12
        ? "Buenas tardes"
        : "Buenas noches";
  const dateStr = now.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const currentDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);
  const studentName =
    (student?.[FIELD_NOMBRE_ESTUDIANTES] as string) || authenticatedUser?.nombre || "Estudiante";
  const firstName = studentName.split(" ")[0];

  // ── Convocatorias ─────────────────────────────────────────────
  // "Hoy" como medianoche UTC de la fecha-calendario local. Las fechas de los
  // lanzamientos son texto (a veces ISO date-only); `parseToUTCDate` las lleva a
  // medianoche UTC de su fecha-calendario, evitando el corrimiento de un día que
  // producía `new Date(...).setHours(0,0,0,0)` en zonas con offset negativo (AR).
  const nowLocal = new Date();
  const today = new Date(Date.UTC(nowLocal.getFullYear(), nowLocal.getMonth(), nowLocal.getDate()));

  // Un lanzamiento archivado no debe verse en el inicio del estudiante, ni como
  // abierto ni como cerrado. Cubre ambas fuentes de "archivado":
  //   · estado_gestion = 'Archivado' / 'No se Relanza' (auto-archivado o admin)
  //   · estado_convocatoria = 'Archivado' / 'Archivada'
  const isArchivedLaunch = (l: LanzamientoPPS) => {
    const g = normalizeStringForComparison(l[FIELD_ESTADO_GESTION_LANZAMIENTOS] || "");
    const c = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] || "");
    return g === "archivado" || g === "no se relanza" || c === "archivado" || c === "archivada";
  };

  const openLanzamientos = lanzamientos.filter((l) => {
    if (isArchivedLaunch(l)) return false;
    const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
    return status === "abierta" || status === "abierto";
  });

  // Cerradas en el Home: SOLO las que todavía no comenzaron (su fecha de inicio
  // es hoy o futura). Una vez que la PPS arranca deja de ser accionable acá (el
  // consentimiento ya cerró y la práctica vive en "Mis prácticas"), así que no
  // ensuciamos el inicio con todo el historial de cerradas.
  // Incluimos también las PPS donde el estudiante está inscripto/seleccionado
  // aunque su lanzamiento ya no figure en la lista pública (Confirmacion/
  // archivado), siempre que aún no hayan comenzado.
  const openIds = new Set(openLanzamientos.map((l) => l.id));
  const notStarted = (l: LanzamientoPPS) => {
    const d = parseToUTCDate(l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
    if (!d) return false;
    return d.getTime() >= today.getTime();
  };
  const closedLanzamientos = (() => {
    const seen = new Set<string>();
    const out: LanzamientoPPS[] = [];
    const push = (l: LanzamientoPPS) => {
      if (seen.has(l.id) || openIds.has(l.id) || !notStarted(l) || isArchivedLaunch(l)) return;
      seen.add(l.id);
      out.push(l);
    };
    lanzamientos.forEach((l) => {
      const status = normalizeStringForComparison(l[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]);
      if (status === "cerrada" || status === "cerrado" || status === "confirmacion") push(l);
    });
    (allLanzamientos || []).forEach((l) => {
      if (enrollmentMap.has(l.id)) push(l);
    });
    return out;
  })();

  const activeEnrollment = myEnrollments?.find((e) => {
    const status = normalizeStringForComparison(e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] || "");
    return status === "seleccionado" || status === "adjudicado" || status === "en curso";
  });

  const activePpsName = activeEnrollment
    ? ((activeEnrollment as Record<string, unknown>)[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) ||
      "PPS en curso"
    : "";
  const activePpsShort = activePpsName ? activePpsName.split(" - ")[0].trim() : "";

  const totalTarget = 250;
  const hoursAcc = Math.round(criterios?.horasTotales || 0);
  const progressPct =
    totalTarget > 0 ? Math.min(100, Math.round((hoursAcc / totalTarget) * 100)) : 0;

  const practicasTotal = myEnrollments?.length ?? 0;

  const hasOpen = openLanzamientos.length > 0;
  const hasClosed = closedLanzamientos.length > 0;

  // Alumno "nuevo de verdad": sin prácticas, sin solicitudes y sin inscripciones.
  // Para este caso mostramos un onboarding en vez del EmptyState seco.
  const isBrandNewStudent =
    (practicas?.length ?? 0) === 0 &&
    (solicitudes?.length ?? 0) === 0 &&
    (myEnrollments?.length ?? 0) === 0;

  // ── Datos derivados para el rail editorial (desktop) ──────────
  const MESES = [
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
  ];
  const fmtShort = (raw?: unknown): string => {
    if (!raw) return "";
    const f = formatDate(raw as string);
    const m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/.exec(f);
    if (!m) return f;
    return `${parseInt(m[1], 10)} ${MESES[parseInt(m[2], 10) - 1] ?? ""}`.trim();
  };

  const areasCursadas = criterios?.orientacionesCursadasCount ?? 0;
  const hoursShort = Math.max(0, Math.round(criterios?.horasFaltantes250 ?? 0));
  const studentOrientacion =
    (student?.[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] as string) || "General";

  // Consentimiento digital pendiente: el estudiante quedó seleccionado/adjudicado
  // en una PPS pero todavía no firmó/aceptó el compromiso.
  const pendingConsent = (() => {
    for (const e of myEnrollments || []) {
      const status = normalizeStringForComparison(
        (e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] as string) || ""
      );
      if (status !== "seleccionado" && status !== "adjudicado") continue;
      const compromiso = compromisoMap?.get(e.id);
      const compromisoEstado = normalizeStringForComparison(compromiso?.estado || "");
      const compromisoAceptado = compromisoEstado.startsWith("acept") || !!compromiso?.accepted_at;
      if (compromisoAceptado) continue;
      const lanzamientoId = (e as Record<string, unknown>)[
        FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS
      ] as string;
      const lanzamiento =
        (lanzamientos || []).find((l) => l.id === lanzamientoId) ||
        (allLanzamientos || []).find((l) => l.id === lanzamientoId);
      if (!lanzamiento) continue;
      // El consentimiento es PREVIO al inicio: solo lo pedimos para una PPS que
      // todavía no arrancó. Si ya inició (o terminó), no corresponde firmarlo.
      const inicioDate = parseToUTCDate(lanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS] as string);
      if (!inicioDate) continue;
      if (inicioDate < today) continue;
      return {
        enrollment: e,
        lanzamiento,
        ppsName: ((lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "tu PPS")
          .split(" - ")[0]
          .trim(),
      };
    }
    return null;
  })();

  // PPS confirmada por comenzar: el estudiante quedó seleccionado/adjudicado, ya
  // firmó el consentimiento y la práctica todavía no arrancó. Alimenta el
  // "Próximo paso" del inicio como recordatorio de la fecha de inicio (sin
  // acción). Si todavía falta firmar, ese caso lo cubre `pendingConsent`; si la
  // PPS ya arrancó, deja de ser un "próximo paso".
  const upcomingStart = (() => {
    for (const e of myEnrollments || []) {
      const status = normalizeStringForComparison(
        (e[FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS] as string) || ""
      );
      if (status !== "seleccionado" && status !== "adjudicado") continue;
      const compromiso = compromisoMap?.get(e.id);
      const compromisoEstado = normalizeStringForComparison(compromiso?.estado || "");
      const compromisoAceptado = compromisoEstado.startsWith("acept") || !!compromiso?.accepted_at;
      if (!compromisoAceptado) continue;
      const lanzamientoId = (e as Record<string, unknown>)[
        FIELD_LANZAMIENTO_VINCULADO_CONVOCATORIAS
      ] as string;
      const lanzamiento =
        (lanzamientos || []).find((l) => l.id === lanzamientoId) ||
        (allLanzamientos || []).find((l) => l.id === lanzamientoId);
      if (!lanzamiento) continue;
      const inicioRaw = lanzamiento[FIELD_FECHA_INICIO_LANZAMIENTOS];
      const inicioDate = parseToUTCDate(inicioRaw as string);
      if (!inicioDate) continue;
      if (inicioDate < today) continue;
      return {
        ppsName: ((lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "tu PPS")
          .split(" - ")[0]
          .trim(),
        startDate: inicioRaw as string,
      };
    }
    return null;
  })();

  // Próximo paso: prioriza informe pendiente, luego convocatoria abierta.
  const pendingInforme = informeTasks?.find((t) => !t.informeSubido);
  const nextStep: NextStepData | null = (() => {
    if (pendingInforme) {
      return {
        title: "Entregá tu informe final",
        subtitle:
          "Tenés un informe pendiente. Subilo para cerrar la práctica y acreditar las horas.",
        where: (pendingInforme.ppsName || "Tu PPS").split(" - ")[0].trim(),
        date: fmtShort(pendingInforme.fechaFinalizacion),
      };
    }
    if (openLanzamientos.length > 0) {
      const l = openLanzamientos[0];
      const nm = ((l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "una convocatoria")
        .split(" - ")[0]
        .trim();
      return {
        title: `Inscribite a ${nm}`,
        subtitle:
          openLanzamientos.length === 1
            ? "Hay una convocatoria abierta. No pierdas el cupo."
            : `Hay ${openLanzamientos.length} convocatorias abiertas. No pierdas el cupo.`,
        where: (l[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "Convocatoria",
        date: "",
      };
    }
    return null;
  })();

  const solicitudItems: StudentSolicitudItemData[] = (solicitudes || []).slice(0, 4).map((s) => ({
    id: s.id,
    name: (s[FIELD_EMPRESA_PPS_SOLICITUD] as string) || "Institución",
    area: studentOrientacion,
    sub: s[FIELD_ULTIMA_ACTUALIZACION_PPS]
      ? `Actualizada ${fmtShort(s[FIELD_ULTIMA_ACTUALIZACION_PPS])}`
      : "En gestión",
    status: (s[FIELD_ESTADO_PPS] as string) || "Pendiente",
  }));

  const pracRows: StudentPracRowData[] = [...(practicas || [])]
    .sort(
      (a, b) =>
        new Date((b[FIELD_FECHA_INICIO_PRACTICAS] as string) || 0).getTime() -
        new Date((a[FIELD_FECHA_INICIO_PRACTICAS] as string) || 0).getTime()
    )
    .slice(0, 4)
    .map((p) => {
      // Solo mostramos la nota si es realmente una calificación numérica.
      // Valores como "Sin calificar" o "No Entregado" no son notas → "—".
      const rawNota = p[FIELD_NOTA_PRACTICAS];
      const notaNum = rawNota != null && String(rawNota).trim() !== "" ? Number(rawNota) : NaN;
      const notaClean = Number.isFinite(notaNum) ? String(rawNota).trim() : null;
      return {
        id: p.id,
        area: (p[FIELD_ESPECIALIDAD_PRACTICAS] as string) || "General",
        status: (p[FIELD_ESTADO_PRACTICA] as string) || "—",
        name: cleanDbValue(p[FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]) || "Institución",
        dates: [fmtShort(p[FIELD_FECHA_INICIO_PRACTICAS]), fmtShort(p[FIELD_FECHA_FIN_PRACTICAS])]
          .filter(Boolean)
          .join(" — "),
        hs: isPracticeDisapproved(p[FIELD_ESTADO_PRACTICA])
          ? 0
          : (p[FIELD_HORAS_PRACTICAS] as number) || 0,
        nota: notaClean,
      };
    });

  const renderConv = (lanzamiento: LanzamientoPPS, keySuffix: string, isOpen: boolean) => {
    const enrollment = enrollmentMap.get(lanzamiento.id);
    const isPendingConsentLaunch =
      !isOpen && pendingConsent?.lanzamiento?.id === lanzamiento.id && !!pendingConsent.enrollment;

    return (
      <StudentConvCard
        key={`${lanzamiento.id}-${keySuffix}`}
        lanzamiento={lanzamiento}
        enrollment={enrollment ?? null}
        isOpen={isOpen}
        onOpen={() => openDetalle(lanzamiento)}
        onVerConvocados={() => seleccionadosMutation.mutate(lanzamiento)}
        onInscribirse={() => openDetalle(lanzamiento)}
        pendingConsentCta={isPendingConsentLaunch}
        onFirmarConsentimiento={
          isPendingConsentLaunch
            ? () =>
                setPendingCompromiso({
                  lanzamiento: pendingConsent.lanzamiento,
                  enrollment: pendingConsent.enrollment,
                })
            : undefined
        }
        onCancelarInscripcion={() =>
          enrollment &&
          handleCancelarInscripcion(
            enrollment.id,
            (lanzamiento[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "esta PPS"
          )
        }
      />
    );
  };

  return (
    <div
      className="ed animate-fade-in"
      data-mode={resolvedTheme}
      data-accent="teal"
      style={{ background: resolvedTheme === "dark" ? "#0a0e1a" : "#fafaf7", minHeight: "100vh" }}
    >
      {/* ── Escritorio: rediseño Atlas ── */}
      <div className="hidden md:block">
        <StudentHomeAtlas
          student={student}
          studentName={studentName}
          criterios={criterios}
          openLanzamientos={openLanzamientos}
          closedLanzamientos={closedLanzamientos}
          enrollmentMap={enrollmentMap}
          institutionAddressMap={institutionAddressMap}
          practicas={practicas ?? []}
          solicitudes={solicitudes ?? []}
          informeTasks={informeTasks ?? []}
          consent={
            pendingConsent
              ? {
                  ppsName: pendingConsent.ppsName,
                  lanzamientoId: pendingConsent.lanzamiento.id,
                  area: pendingConsent.lanzamiento[FIELD_ORIENTACION_LANZAMIENTOS] as
                    | string
                    | undefined,
                }
              : null
          }
          upcomingStart={upcomingStart}
          onStartConsent={() =>
            pendingConsent &&
            setPendingCompromiso({
              lanzamiento: pendingConsent.lanzamiento,
              enrollment: pendingConsent.enrollment,
            })
          }
          onOpenDetalle={openDetalle}
          onInscribir={onInscribir}
          onCancelarInscripcion={handleCancelarInscripcion}
          onVerConvocados={(l) => seleccionadosMutation.mutate(l)}
          onNavigate={onNavigate}
        />
      </div>

      {/* ── Mobile: layout editorial existente ── */}
      <div className="md:hidden mx-auto w-full max-w-[430px] px-1 pb-6">
        {/* Saludo editorial (mobile · en desktop lo provee WelcomeBanner) */}
        <div className="mobile-hero-head md:hidden">
          <span className="eyebrow mobile-hero-head__date">{currentDate}</span>
          <div className="display mobile-hero-head__title">
            {greeting}, <span>{firstName}.</span>
          </div>
          <p className="mobile-hero-head__copy">
            {hasOpen
              ? openLanzamientos.length === 1
                ? "Hay una convocatoria abierta para sumar horas."
                : `Hay ${openLanzamientos.length} convocatorias abiertas para sumar horas.`
              : "Las próximas oportunidades van a aparecer acá."}
          </p>
        </div>

        <MesasAvisoBanner />

        {/* Consentimiento digital (mobile) — la convocatoria seleccionada
            evoluciona a tarjeta de firma (no es un widget aparte). */}
        {pendingConsent && (
          <div className="mb-4">
            <StudentConvCard
              lanzamiento={pendingConsent.lanzamiento}
              enrollment={pendingConsent.enrollment}
              isOpen={false}
              needsConsent
              onOpen={() => openDetalle(pendingConsent.lanzamiento)}
              onFirmarConsentimiento={() =>
                setPendingCompromiso({
                  lanzamiento: pendingConsent.lanzamiento,
                  enrollment: pendingConsent.enrollment,
                })
              }
            />
          </div>
        )}

        {/* Layout: mobile apilado (hero → convocatorias); desktop 2 columnas
            (convocatorias a la izquierda en grilla, hero sticky a la derecha). */}
        <div className="md:grid md:grid-cols-12 md:gap-6 md:items-start">
          {/* Hero resumen — sidebar en desktop */}
          <aside className="md:col-span-4 md:order-2 md:sticky md:top-6">
            <StudentSummaryCard
              criterios={criterios}
              activePpsName={activePpsShort}
              hasActiveEnrollment={!!activeEnrollment}
              totalTarget={totalTarget}
              progressPct={progressPct}
              hoursAcc={hoursAcc}
              practicasTotal={practicasTotal}
            />

            {/* Contexto editorial — solo escritorio (mobile mantiene su flujo) */}
            <div className="mt-4 hidden md:flex md:flex-col md:gap-4">
              {nextStep && <StudentNextStepCard next={nextStep} />}

              {solicitudItems.length > 0 && (
                <div className="rounded-2xl border border-student-line bg-student-bg-elevated p-5">
                  <div className="mb-1 flex items-baseline justify-between">
                    <h4 className="font-mono text-[10.5px] uppercase tracking-[.12em] text-student-ink-muted">
                      Solicitudes
                    </h4>
                    <button
                      type="button"
                      onClick={() => onNavigate("solicitudes")}
                      className="font-mono text-[10.5px] text-student-ink-subtle transition-colors hover:text-student-ink"
                    >
                      {solicitudItems.length} en gestión →
                    </button>
                  </div>
                  {solicitudItems.map((s) => (
                    <StudentSolicitudItem key={s.id} data={s} />
                  ))}
                </div>
              )}

              <StudentAcreditacionCard
                hours={hoursAcc}
                total={totalTarget}
                pct={progressPct}
                areas={areasCursadas}
                hoursShort={hoursShort}
              />
            </div>
          </aside>

          {/* Columna principal — convocatorias */}
          <div className="md:col-span-8 md:order-1 mt-5 md:mt-0">
            {/* Convocatorias abiertas */}
            {hasOpen ? (
              <>
                <div className="flex items-baseline justify-between mb-2.5">
                  <span className="eyebrow">Convocatorias abiertas</span>
                  <span className="mono" style={{ fontSize: 10.5, color: "var(--accent)" }}>
                    {openLanzamientos.length} {openLanzamientos.length === 1 ? "nueva" : "nuevas"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {openLanzamientos.map((l) => renderConv(l, "open", true))}
                </div>
              </>
            ) : null}

            {/* Cerradas recientemente (excluye la que ya se muestra como consentimiento) */}
            {(() => {
              const closedToShow = closedLanzamientos.filter(
                (l) => l.id !== pendingConsent?.lanzamiento?.id
              );
              if (closedToShow.length === 0) return null;
              return (
                <>
                  <div
                    className={`flex items-baseline justify-between mb-2.5 ${hasOpen ? "mt-7" : ""}`}
                  >
                    <span className="eyebrow">Cerradas recientemente</span>
                    <span className="mono" style={{ fontSize: 10.5, color: "var(--ink-subtle)" }}>
                      {closedToShow.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-80">
                    {closedToShow.map((l) => renderConv(l, "closed", false))}
                  </div>
                </>
              );
            })()}

            {!hasOpen && !hasClosed ? (
              <div className="mt-2">
                {isBrandNewStudent ? (
                  <StudentOnboardingCard
                    studentName={studentName}
                    onNavigate={(tab) => onNavigate(tab as TabId)}
                  />
                ) : (
                  <div className="ah-empty ah-empty--home-mobile">
                    <div className="ah-empty__ic">
                      <AhIcon name="bell" size={20} />
                    </div>
                    <div className="ah-empty__t">No hay convocatorias abiertas</div>
                    <p className="ah-empty__s">
                      Estate atento al grupo de WhatsApp para no perderte novedades.
                    </p>
                  </div>
                )}
              </div>
            ) : null}

            {/* Historial — solo escritorio */}
            {pracRows.length > 0 ? (
              <div className="mt-7 hidden md:block">
                <div className="mb-2.5 flex items-baseline justify-between">
                  <span className="eyebrow">Tu historial</span>
                  <button
                    type="button"
                    onClick={() => onNavigate("practicas")}
                    className="mono"
                    style={{ fontSize: 10.5, color: "var(--ink-subtle)" }}
                  >
                    {practicas?.length ?? pracRows.length} prácticas →
                  </button>
                </div>
                <div className="rounded-2xl border border-student-line bg-student-bg-elevated px-5 py-1">
                  {pracRows.map((p) => (
                    <StudentPracRow key={p.id} data={p} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!pendingCancel}
        title="Cancelar inscripción"
        message={`¿Estás seguro que deseas cancelar tu inscripción a "${pendingCancel?.nombre}"?\n\nEsta acción no se puede deshacer.`}
        confirmText="Sí, cancelar inscripción"
        cancelText="Volver"
        type="danger"
        onConfirm={confirmCancelarInscripcion}
        onClose={() => setPendingCancel(null)}
      />
      <CompromisoPPSModal
        isOpen={!!pendingCompromiso}
        onClose={() => setPendingCompromiso(null)}
        student={student}
        lanzamiento={pendingCompromiso?.lanzamiento || null}
        enrollment={pendingCompromiso?.enrollment || null}
        onSubmit={async (payload) => {
          await onAcceptCompromiso?.(payload);
        }}
        isSubmitting={isSubmittingCompromiso}
      />
    </div>
  );
};

export default HomeView;
