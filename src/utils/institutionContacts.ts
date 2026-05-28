import { FIELD_NOMBRE_PPS_LANZAMIENTOS } from "../constants";
import { getGroupName, normalizeStringForComparison } from "./formatters";

export type InstitutionContact = { id: string; phone?: string };

export const PHONE_DIRECTORY = [
  { name: "ACUCADES", phone: "2996232713" },
  { name: "Asociación Civil Programa Aser", phone: "2993247492" },
  { name: "Asociación Civil Pensar Programa Aser", phone: "2993247492" },
  { name: "Centro de Inclusión Social y Laboral APASIDO", phone: "2984617520" },
  { name: "Centro Evaluador Camioneros", phone: "2994569610" },
  { name: "Centro Salud Parque Industrial", phone: "2994587083" },
  { name: "Centro de Salud Parque Industrial", phone: "2994587083" },
  { name: "Centro SENSUS", phone: "2995160061" },
  { name: "Cita Salud", phone: "2995274960" },
  { name: "Clínica Fava", phone: "2995467311" },
  { name: "Colegio Nuestra Señora de Fátima", phone: "2994771182" },
  { name: "Colegio Psicólogos CPAVZO", phone: "2994092421" },
  { name: "Colegio San José Obrero de Neuquén", phone: "2942508177" },
  { name: "Colegio Virgen de Luján", phone: "2994047602" },
  { name: "Consultorios Las Lilas", phone: "2995353419" },
  { name: "Corporate Resources", phone: "2996100984" },
  { name: "Dige Espacio Terapéutico", phone: "1168733671" },
  { name: "Escuela Cristiana Vida", phone: "2994680666" },
  { name: "Escuela de Formación Cooperativa y Laboral N8", phone: "2604310174" },
  { name: "Escuela Integral de Adolescentes y Jóvenes con Discapacidad N7", phone: "2994193469" },
  { name: "Fundación Austral de Salud Integral", phone: "2995551529" },
  { name: "Fundación Kano", phone: "2984199042" },
  { name: "Fundación Lanna", phone: "2994118855" },
  { name: "Fundación Tiempo", phone: "1154152586" },
  { name: "Institución Fernando Ulloa", phone: "1127470681" },
  { name: "Instituto de Formación Docente N6", phone: "2994163682" },
  { name: "Instituto Liens", phone: "2994281417" },
  { name: "Instituto Ruca Suyay", phone: "2994769427" },
  { name: "ISI College", phone: "2994484812" },
  { name: "Ministerio de Trabajo y Desarrollo Laboral", phone: "2994523457" },
  { name: "Municipalidad de General Fernandez Oro", phone: "2994838857" },
  { name: "Randstad", phone: "3417434859" },
  { name: "Sanatorio Juan XXIII", phone: "2984775371" },
  {
    name: "Subsecretaria de Ciudades Saludables y Prevención de Consumos problemáticos Neuquén",
    phone: "2994194673",
  },
  { name: "Supervisión Educación Primaria", phone: "2984228687" },
].sort((a, b) => b.name.length - a.name.length);

export const getInstitutionContactForPpsName = (
  ppsName: string | null | undefined,
  institutionsMap: Map<string, InstitutionContact> = new Map()
): InstitutionContact | undefined => {
  const normalizedFullName = normalizeStringForComparison(ppsName || "");
  const normalizedGroupName = normalizeStringForComparison(getGroupName(ppsName || ""));

  const dbMatch =
    institutionsMap.get(normalizedFullName) ||
    institutionsMap.get(normalizedGroupName) ||
    Array.from(institutionsMap.entries()).find(([name]) => {
      if (!normalizedGroupName) return false;
      return name.includes(normalizedGroupName) || normalizedGroupName.includes(name);
    })?.[1];

  if (dbMatch?.phone) return dbMatch;

  const directoryMatch = PHONE_DIRECTORY.find((entry) => {
    const normalizedEntry = normalizeStringForComparison(entry.name);
    if (!normalizedEntry) return false;
    if (
      normalizedGroupName.includes("fundacion tiempo de ninos") &&
      normalizedEntry === "fundacion tiempo"
    ) {
      return false;
    }

    return (
      normalizedFullName.includes(normalizedEntry) ||
      normalizedGroupName.includes(normalizedEntry) ||
      normalizedEntry.includes(normalizedGroupName)
    );
  });

  if (!directoryMatch) return dbMatch;

  return {
    id: dbMatch?.id || `phone-directory-${normalizeStringForComparison(directoryMatch.name)}`,
    phone: directoryMatch.phone,
  };
};

export const getPpsInstitutionContact = (
  pps: any,
  institutionsMap?: Map<string, InstitutionContact>
) => getInstitutionContactForPpsName(pps?.[FIELD_NOMBRE_PPS_LANZAMIENTOS], institutionsMap);
