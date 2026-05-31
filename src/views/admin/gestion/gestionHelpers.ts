import {
  FIELD_NOMBRE_PPS_LANZAMIENTOS,
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ORIENTACION_LANZAMIENTOS,
  FIELD_FECHA_INICIO_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
  FIELD_HISTORIAL_GESTION_LANZAMIENTOS,
  FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS,
  FIELD_DIRECCION_LANZAMIENTOS,
} from "../../../constants";
import type { InstitutionInfo } from "../../../hooks/useGestionConvocatorias";
import type { LanzamientoPPS } from "../../../types";
import {
  getGroupName,
  normalizeStringForComparison,
  parseToUTCDate,
} from "../../../utils/formatters";
import {
  dbToUiState,
  REINSISTIR_THRESHOLD_DAYS,
  POR_FINALIZAR_THRESHOLD_DAYS,
  type BandejaItem,
  type InstitutionVM,
  type MissingFlag,
  type UiState,
} from "./gestionTypes";

// Slug de orientación (primera palabra, sin acentos) para data-attrs de estilo.
export const orientSlug = (o?: string | null) =>
  o
    ? o
        .toString()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .split(/[\s,/]+/)[0]
    : "";

export const flagsFor = (vm: {
  phone?: string | null;
  referente?: string | null;
  convenio?: string | null;
}): MissingFlag[] => {
  const f: MissingFlag[] = [];
  if (!vm.phone) f.push({ k: "tel", label: "sin tel", icon: "phone" });
  if (!vm.referente) f.push({ k: "ref", label: "sin referente", icon: "person" });
  if (!vm.convenio) f.push({ k: "conv", label: "sin convenio", icon: "description" });
  return f;
};

// Texto corto que describe la última actividad de una institución a partir del
// lanzamiento más reciente: estado de la convocatoria/gestión + cohorte (mes año).
export const buildActivityLabel = (latest: LanzamientoPPS): string | null => {
  const estado =
    (latest[FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS] as string) ||
    (latest[FIELD_ESTADO_GESTION_LANZAMIENTOS] as string) ||
    "";
  const inicio = parseToUTCDate((latest[FIELD_FECHA_INICIO_LANZAMIENTOS] as string) || undefined);
  let cohorte = "";
  if (inicio) {
    const mes = inicio
      .toLocaleDateString("es", { month: "short", timeZone: "UTC" })
      .replace(".", "");
    cohorte = `cohorte ${mes} ${inicio.getUTCFullYear()}`;
  }
  const parts = [estado.trim(), cohorte].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
};

// ─── Derivación de items (bandeja) desde los grupos del hook ────────────────

export function buildItems(
  fd: {
    porContactar?: LanzamientoPPS[];
    contactadasEsperandoRespuesta?: LanzamientoPPS[];
    respondidasPendienteDecision?: LanzamientoPPS[];
    relanzamientosConfirmados?: LanzamientoPPS[];
    activasYPorFinalizar?: LanzamientoPPS[];
    activasIndefinidas?: LanzamientoPPS[];
  },
  instMap: Map<string, InstitutionInfo>
): BandejaItem[] {
  const items: BandejaItem[] = [];

  const mk = (launch: LanzamientoPPS, state: UiState): BandejaItem => {
    const nombre = (launch[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Sin nombre";
    const grupo = getGroupName(nombre);
    const inst = instMap.get(normalizeStringForComparison(grupo));
    const orientacion =
      (launch[FIELD_ORIENTACION_LANZAMIENTOS] as string) ||
      (inst?.orientaciones && inst.orientaciones[0]) ||
      null;
    const phone = inst?.phone || null;

    const daysSinceEnd = (launch as any).daysSinceEnd as number | undefined;
    const daysWaiting = ((launch as any).daysWaiting ?? (launch as any).daysSinceResponse) as
      | number
      | undefined;
    const daysLeft = (launch as any).daysLeft as number | undefined;
    const noClasificada = (launch as any).noClasificada === true;

    let titulo = grupo;
    let razon = "";
    let nextStep = "";
    let daysAgo = 0;

    switch (state) {
      case "porContactar":
        titulo = `Contactar ${grupo}`;
        if (noClasificada) {
          razon =
            daysSinceEnd != null
              ? `PPS finalizada hace ${daysSinceEnd} días · estado sin clasificar`
              : "Finalizada · estado de gestión sin clasificar";
          nextStep = "Revisar y asignar un estado de gestión";
        } else {
          razon =
            daysSinceEnd != null
              ? `PPS finalizada hace ${daysSinceEnd} días · sin gestión registrada`
              : "Finalizada · sin gestión registrada";
          nextStep = "Confirmar continuidad para el próximo ciclo";
        }
        daysAgo = daysSinceEnd ?? 0;
        break;
      case "reinsistir":
        titulo = `Reinsistir ${grupo}`;
        razon =
          daysWaiting != null
            ? `Sin respuesta hace ${daysWaiting} días al último contacto`
            : "Sin respuesta hace tiempo";
        nextStep = "Reenviar consulta con recordatorio cortés";
        daysAgo = daysWaiting ?? 0;
        break;
      case "esperandoRespuesta":
        titulo = `${grupo} · seguimiento`;
        razon =
          daysWaiting != null
            ? `Contactada hace ${daysWaiting} días · esperando respuesta`
            : "Contactada · monitoreando";
        nextStep = "Esperar respuesta · reinsistir si se pasa la ventana";
        daysAgo = daysWaiting ?? 0;
        break;
      case "pendienteDecision":
        titulo = `Decidir continuidad ${grupo}`;
        razon = "Respondieron · falta definir los próximos pasos";
        nextStep = "Confirmar fechas y pasar a Confirmada";
        daysAgo = daysWaiting ?? 0;
        break;
      case "confirmada":
        titulo = `${grupo} · relanzamiento confirmado`;
        razon =
          daysLeft != null && daysLeft >= 0
            ? `Finaliza en ${daysLeft} días`
            : "Relanzamiento confirmado";
        nextStep = "Sin acción · seguimiento programado";
        break;
      case "porFinalizar":
        titulo =
          daysLeft != null ? `${grupo} cierra en ${daysLeft} días` : `${grupo} por finalizar`;
        razon = "PPS activa terminando · preparar cierre académico";
        nextStep = "Preparar cierre y abrir conversación de relanzamiento";
        daysAgo = daysLeft != null ? Math.abs(daysLeft) : 0;
        break;
      case "activa":
        titulo = `${grupo} · en curso`;
        razon = daysLeft != null ? `Quedan ${daysLeft} días de cursada` : "PPS activa";
        nextStep = "Monitorear · sin acción inmediata";
        break;
      case "indefinida":
        titulo = `${grupo} · sin fechas`;
        razon = "Faltan fechas de inicio / fin para ubicarla en el calendario";
        nextStep = "Cargar fechas o archivar";
        break;
      default:
        break;
    }

    const flags: MissingFlag[] = [];
    if (!phone) flags.push({ k: "tel", label: "sin tel", icon: "phone" });
    if (state === "indefinida")
      flags.push({ k: "fechas", label: "sin fechas", icon: "event_busy" });

    return {
      id: launch.id,
      launch,
      state,
      nombre,
      grupo,
      orientacion,
      phone,
      titulo,
      razon,
      nextStep,
      daysAgo,
      flags,
      noClasificada: state === "porContactar" && noClasificada,
    };
  };

  (fd.porContactar || []).forEach((l) => items.push(mk(l, "porContactar")));
  (fd.contactadasEsperandoRespuesta || []).forEach((l) =>
    items.push(
      mk(
        l,
        ((l as any).daysWaiting ?? 0) > REINSISTIR_THRESHOLD_DAYS
          ? "reinsistir"
          : "esperandoRespuesta"
      )
    )
  );
  (fd.respondidasPendienteDecision || []).forEach((l) => items.push(mk(l, "pendienteDecision")));
  (fd.relanzamientosConfirmados || []).forEach((l) => items.push(mk(l, "confirmada")));
  (fd.activasYPorFinalizar || []).forEach((l) => {
    const dl = (l as any).daysLeft as number | undefined;
    items.push(mk(l, dl != null && dl <= POR_FINALIZAR_THRESHOLD_DAYS ? "porFinalizar" : "activa"));
  });
  (fd.activasIndefinidas || []).forEach((l) => items.push(mk(l, "indefinida")));

  return items;
}

// ─── Derivación de instituciones (CRM) desde lanzamientos + map ─────────────

export function buildInstitutions(
  lanzamientos: LanzamientoPPS[],
  instMap: Map<string, InstitutionInfo>,
  items: BandejaItem[]
): InstitutionVM[] {
  const itemStateByKey = new Map<string, UiState>();
  const noClasificadaByKey = new Map<string, boolean>();
  items.forEach((it) => {
    itemStateByKey.set(normalizeStringForComparison(it.grupo), it.state);
    if (it.noClasificada) noClasificadaByKey.set(normalizeStringForComparison(it.grupo), true);
  });

  const groups = new Map<string, LanzamientoPPS[]>();
  lanzamientos.forEach((l) => {
    const grupo = getGroupName((l[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Sin nombre");
    const key = normalizeStringForComparison(grupo);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(l);
  });

  const result: InstitutionVM[] = [];
  groups.forEach((launches, key) => {
    launches.sort((a, b) => {
      const da = new Date((a[FIELD_FECHA_INICIO_LANZAMIENTOS] as string) || "1900-01-01").getTime();
      const db = new Date((b[FIELD_FECHA_INICIO_LANZAMIENTOS] as string) || "1900-01-01").getTime();
      return db - da;
    });
    const latest = launches[0];
    const grupo = getGroupName((latest[FIELD_NOMBRE_PPS_LANZAMIENTOS] as string) || "Sin nombre");
    const inst = instMap.get(key);

    const itemState = itemStateByKey.get(key) || null;
    const state = itemState || dbToUiState(latest[FIELD_ESTADO_GESTION_LANZAMIENTOS] as string);

    const orientaciones =
      inst?.orientaciones && inst.orientaciones.length
        ? inst.orientaciones
        : [
            ...new Set(
              launches
                .map((l) => (l[FIELD_ORIENTACION_LANZAMIENTOS] as string) || "")
                .filter(Boolean)
            ),
          ];

    // Helper: primer valor no vacío entre los lanzamientos (ordenados del más
    // reciente al más antiguo) para campos que también vienen en la convocatoria.
    const firstFromLaunches = (field: string): string | null => {
      for (const l of launches) {
        const v = (l[field as keyof LanzamientoPPS] as unknown as string) || "";
        if (v && String(v).trim()) return String(v).trim();
      }
      return null;
    };

    const phone = inst?.phone || null;
    const referente = inst?.referente || null;
    const localidad = inst?.localidad || firstFromLaunches(FIELD_DIRECCION_LANZAMIENTOS) || null;
    const convenio = inst?.convenio || null;

    const lastActivity = Math.max(
      ...launches.map((l) =>
        new Date((l[FIELD_FECHA_INICIO_LANZAMIENTOS] as string) || "1900-01-01").getTime()
      )
    );

    // Texto descriptivo de la última actividad: estado + cohorte (mes/año del inicio).
    const lastActivityLabel = buildActivityLabel(latest);

    result.push({
      key,
      id: inst?.id || key,
      nombre: grupo,
      state,
      orientaciones,
      phone,
      referente,
      localidad,
      convenio,
      notas: (latest[FIELD_NOTAS_GESTION_LANZAMIENTOS] as string) || null,
      historial: (latest[FIELD_HISTORIAL_GESTION_LANZAMIENTOS] as string) || null,
      proximo: (latest[FIELD_PROXIMO_SEGUIMIENTO_LANZAMIENTOS] as string) || null,
      lastActivity,
      lastActivityLabel,
      launches,
      flags: flagsFor({ phone, referente, convenio }),
      itemState,
      noClasificada: noClasificadaByKey.get(key) || false,
    });
  });

  return result.sort((a, b) => a.nombre.localeCompare(b.nombre));
}
