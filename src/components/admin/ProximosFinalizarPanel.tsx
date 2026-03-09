import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import {
  TABLE_NAME_ESTUDIANTES,
  TABLE_NAME_PRACTICAS,
  TABLE_NAME_FINALIZACION,
} from "../../constants";
import {
  FIELD_ESTADO_ESTUDIANTES,
  FIELD_ESTADO_FINALIZACION,
  FIELD_ESTUDIANTE_FINALIZACION,
  FIELD_HORAS_PRACTICAS,
  FIELD_ESPECIALIDAD_PRACTICAS,
  FIELD_ESTUDIANTE_LINK_PRACTICAS,
  FIELD_CORREO_ESTUDIANTES,
  FIELD_LEGAJO_ESTUDIANTES,
  FIELD_NOMBRE_ESTUDIANTES,
  FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES,
} from "../../constants/dbConstants";
import { normalizeStringForComparison, safeGetId } from "../../utils/formatters";
import { sendSmartEmail } from "../../utils/emailService";
import Loader from "../Loader";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Toast from "../ui/Toast";

const HOURS_TOTAL_REQUIRED = 250;
const HOURS_SPECIALTY_REQUIRED = 70;
const ROTATION_AREAS_REQUIRED = 3;

interface StudentDeficit {
  id: string;
  nombre: string;
  legajo: string;
  correo: string;
  horasTotales: number;
  horasFaltantes: number;
  horasPorOrientacion: Record<string, number>;
  orientacionesCursadas: string[];
  orientacionElegida: string;
  tieneOrientacionElegida: boolean;
}

const EMAIL_CONTENT = `Hola {{nombre_alumno}},

Les comparto el instructivo correspondiente a la PPS "Relevamiento del Ejercicio Profesional en Psicología", que acredita 20 horas de Prácticas Profesionales Supervisadas.

El objetivo de esta práctica es que puedan acercarse al ejercicio profesional real de la psicología, mediante entrevistas a profesionales en actividad.

A continuación se detallan las pautas para su realización.

---

**1. Objetivo de la práctica**

El objetivo es que puedan conocer de primera mano cómo trabajan los psicólogos en distintos ámbitos profesionales, comprendiendo:

* los **roles y tareas que desempeñan**
* el **funcionamiento de las instituciones donde trabajan**
* los **marcos teóricos y herramientas que utilizan**
* los **desafíos actuales del ejercicio profesional**

Además, la actividad busca fomentar el **contacto con profesionales del campo**, la reflexión sobre la propia formación y la construcción de la identidad profesional.

---

**2. Cantidad de entrevistas**

Para realizar esta PPS deberán llevar adelante **3 entrevistas a psicólogos/as en ejercicio**.

Es importante tener en cuenta las siguientes condiciones:

* **Al menos 2 de los profesionales entrevistados deben trabajar en instituciones que tengan convenio vigente con la universidad.**
* **1 de los profesionales puede desempeñarse por fuera de estas instituciones.**

Más abajo encontrarán un listado de instituciones con las que hemos trabajado recientemente.

---

**3. Orientación de la práctica**

Al momento de realizar las entrevistas deberán elegir **una orientación** en la cual acreditar las horas (por ejemplo: clínica, educacional, laboral, comunitaria, etc.).

Las **3 entrevistas deben corresponder a la misma orientación elegida**.

Ejemplo:
Si eligen acreditar horas en **orientación laboral**, los profesionales entrevistados deberán trabajar en ámbitos laborales u organizacionales.

---

**4. Modalidad de las entrevistas**

Las entrevistas pueden realizarse:

* **presencialmente**, o
* **de manera virtual**.

Se recomienda utilizar una **guía de entrevista semi-estructurada**, que permita generar un diálogo abierto con el profesional.

Algunos ejes sugeridos para orientar la conversación son:

**Trayectoria profesional**
* Formación de grado y posgrado
* Motivos de elección del área
* Primeros desafíos al comenzar a trabajar

**Institución y contexto de trabajo**
* Tipo de institución
* Población con la que trabajan
* Trabajo en equipo e inserción institucional

**Práctica profesional**
* Tareas habituales
* Marco teórico desde el que trabajan
* Herramientas y técnicas que utilizan

**Desafíos y proyección profesional**
* Dificultades actuales del ejercicio profesional
* Cambios en el rol del psicólogo
* Consejos para estudiantes que están por recibirse

**Reflexión personal y autocuidado**
* Aspectos gratificantes del trabajo
* Estrategias para manejar el desgaste profesional

---

**5. Entrega del trabajo**

Para acreditar las horas deberán entregar **un informe final**, que incluya:

* Presentación breve de cada profesional entrevistado
  (nombre, institución donde trabaja y matrícula profesional)

* **Las entrevistas desgrabadas** (transcripción de lo conversado)

* Un **análisis comparativo** entre las entrevistas

* Una **reflexión personal** sobre los aprendizajes obtenidos

La **desgrabación de las entrevistas es obligatoria** para la aprobación de la práctica.

---

**6. Instituciones con convenio**

A continuación se incluye un listado de instituciones con las que hemos colaborar do recientemente y donde pueden contactar profesionales para las entrevistas:

* A.PA.SI.DO – Cipolletti
* Asociación Civil Pensar – Neuquén
* Centro de Psicoterapia Corporal Patagonia – Cipolletti
* Centro de Rehabilitación y Bienestar Emocional – Cipolletti
* Centro Sensus – Neuquén
* Colegio Nuestra Señora de Fátima – Cipolletti
* Colegio San José Obrero – Neuquén
* Dispositivo "La Casita" – Neuquén
* EIAJD N°7 – Centenario
* Fundación Austral de Salud Integral – Neuquén
* Fundación KANO – General Roca / Villa Regina
* Fundación Lanna Centro DAT – Cipolletti
* Fundación Tiempo de Niños – Cipolletti
* Hospital Natalio Burd – Centenario
* Instituto de Formación Docente N°4 – Neuquén
* Instituto de Formación Docente N°6 – General Roca
* Instituto Liens – Neuquén
* Ministerio de Trabajo – Neuquén
* Municipalidad de Fernández Oro
* Prevención de Consumos (Municipalidad de Neuquén)
* Randstad – Neuquén
* Sanatorio Juan XXIII – General Roca
* Subsecretaría de Ciudades Saludables – Neuquén

---

Ante cualquier duda pueden escribir al correo de PPS.

Saludos.

Blas,
Coordinador de Prácticas Profesionales Supervisadas
Licenciatura en Psicología
UFLO.`;

const ProximosFinalizarPanel: React.FC = () => {
  const [sendingEmails, setSendingEmails] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());

  const { data: studentsData, isLoading } = useQuery({
    queryKey: ["proximosFinalizarData"],
    queryFn: async () => {
      const [estRes, pracRes, finRes] = await Promise.all([
        supabase.from(TABLE_NAME_ESTUDIANTES).select("*"),
        supabase.from(TABLE_NAME_PRACTICAS).select("*"),
        supabase.from(TABLE_NAME_FINALIZACION).select("*"),
      ]);

      const estudiantes = estRes.data || [];
      const practicas = pracRes.data || [];
      const finalizaciones = finRes.data || [];

      const finalizacionMap = new Map<string, any>();
      finalizaciones.forEach((f: any) => {
        const sId = safeGetId(f[FIELD_ESTUDIANTE_FINALIZACION]);
        if (sId) finalizacionMap.set(sId, f);
      });

      const studentPracticesMap = new Map<string, any[]>();
      practicas.forEach((p: any) => {
        const sId = safeGetId(p[FIELD_ESTUDIANTE_LINK_PRACTICAS]);
        if (sId) {
          const existing = studentPracticesMap.get(sId) || [];
          existing.push(p);
          studentPracticesMap.set(sId, existing);
        }
      });

      const result: StudentDeficit[] = [];

      estudiantes.forEach((est: any) => {
        const estado = normalizeStringForComparison(est[FIELD_ESTADO_ESTUDIANTES]);
        if (estado !== "activo") return;

        const finalizacion = finalizacionMap.get(est.id);
        if (finalizacion) {
          const estadoFin = normalizeStringForComparison(finalizacion[FIELD_ESTADO_FINALIZACION]);
          if (estadoFin === "tramite" || estadoFin === "realizada" || estadoFin === "cargado")
            return;
        }

        const studentPracticas = studentPracticesMap.get(est.id) || [];
        let horasTotales = 0;
        const horasPorOrientacion: Record<string, number> = {};
        const orientacionesCursadasSet = new Set<string>();

        studentPracticas.forEach((p: any) => {
          const horas = p[FIELD_HORAS_PRACTICAS] || 0;
          horasTotales += horas;

          const especialidad = p[FIELD_ESPECIALIDAD_PRACTICAS];
          if (especialidad) {
            const normalizedEsp = normalizeStringForComparison(especialidad);
            horasPorOrientacion[normalizedEsp] = (horasPorOrientacion[normalizedEsp] || 0) + horas;
            orientacionesCursadasSet.add(normalizedEsp);
          }
        });

        if (horasTotales < 230) return;

        const orientacionElegida = normalizeStringForComparison(
          est[FIELD_ORIENTACION_ELEGIDA_ESTUDIANTES] || ""
        );
        const tieneOrientacionElegida = !!orientacionElegida;

        result.push({
          id: est.id,
          nombre: est[FIELD_NOMBRE_ESTUDIANTES] || "",
          legajo: est[FIELD_LEGAJO_ESTUDIANTES] || "",
          correo: est[FIELD_CORREO_ESTUDIANTES] || "",
          horasTotales,
          horasFaltantes: Math.max(0, HOURS_TOTAL_REQUIRED - horasTotales),
          horasPorOrientacion,
          orientacionesCursadas: Array.from(orientacionesCursadasSet),
          orientacionElegida,
          tieneOrientacionElegida,
        });
      });

      return result;
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleSelectAll = () => {
    if (selectedStudents.size === (studentsData?.length || 0)) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(studentsData?.map((s) => s.id) || []));
    }
  };

  const handleSelectStudent = (id: string) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedStudents(newSet);
  };

  const handleSendEmail = async (student: StudentDeficit) => {
    if (!student.correo) {
      setToast({ message: `No hay correo registrado para ${student.nombre}`, type: "error" });
      return;
    }

    setSendingEmails((prev) => new Set(prev).add(student.id));

    try {
      const deficitParts: string[] = [];
      if (student.horasFaltantes > 0) {
        deficitParts.push(`${student.horasFaltantes} horas`);
      }
      if (!student.tieneOrientacionElegida) {
        deficitParts.push("elegir una orientación");
      } else {
        const horasOrientacion = student.horasPorOrientacion[student.orientacionElegida] || 0;
        if (horasOrientacion < HOURS_SPECIALTY_REQUIRED) {
          deficitParts.push(
            `${HOURS_SPECIALTY_REQUIRED - horasOrientacion} horas de ${student.orientacionElegida}`
          );
        }
      }
      if (student.orientacionesCursadas.length < ROTATION_AREAS_REQUIRED) {
        deficitParts.push(
          `${ROTATION_AREAS_REQUIRED - student.orientacionesCursadas.length} orientación(es) adicional(es)`
        );
      }

      const deficitText =
        deficitParts.length > 0
          ? `Vemos que te faltan: ${deficitParts.join(", ")}. Por eso queremos brindarte la posibilidad de hacer la siguiente PPS:`
          : `Queremos ofrecerte la siguiente PPS para completar tu formación:`;

      const personalizedContent = EMAIL_CONTENT.replace(
        "{{nombre_alumno}}",
        `Te escribo porque detectamos que tenés más de 230 horas acumuladas en PPS. ${deficitText}\n\n---\n\n${EMAIL_CONTENT}`
      );

      await sendSmartEmail("sac", {
        studentName: student.nombre,
        studentEmail: student.correo,
        ppsName: "Relevamiento del Ejercicio Profesional en Psicología",
        notes: personalizedContent,
      });

      setToast({ message: `Email enviado a ${student.nombre}`, type: "success" });
    } catch (error: any) {
      setToast({ message: `Error al enviar a ${student.nombre}: ${error.message}`, type: "error" });
    } finally {
      setSendingEmails((prev) => {
        const newSet = new Set(prev);
        newSet.delete(student.id);
        return newSet;
      });
    }
  };

  const handleSendSelected = async () => {
    const selectedList = studentsData?.filter((s) => selectedStudents.has(s.id)) || [];
    let successCount = 0;
    let errorCount = 0;

    for (const student of selectedList) {
      await handleSendEmail(student);
      successCount++;
    }

    setToast({
      message: `Correos enviados a ${successCount} estudiante(s)`,
      type: successCount > 0 ? "success" : "error",
    });
    setSelectedStudents(new Set());
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-white">
              Alumnos Próximos a Finalizar
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Estudiantes con más de 230 horas que no tienen acreditación en trámite o realizada
            </p>
          </div>
          {selectedStudents.size > 0 && (
            <Button
              onClick={handleSendSelected}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Enviar email a {selectedStudents.size} estudiante(s)
            </Button>
          )}
        </div>

        {studentsData && studentsData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-2">
                    <input
                      type="checkbox"
                      checked={selectedStudents.size === studentsData.length}
                      onChange={handleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th className="text-left py-3 px-2 font-semibold">Nombre</th>
                  <th className="text-left py-3 px-2 font-semibold">Legajo</th>
                  <th className="text-center py-3 px-2 font-semibold">Horas Totales</th>
                  <th className="text-center py-3 px-2 font-semibold">Faltan</th>
                  <th className="text-center py-3 px-2 font-semibold">Orient. Elegida</th>
                  <th className="text-center py-3 px-2 font-semibold">Horas Orient.</th>
                  <th className="text-center py-3 px-2 font-semibold">Orientaciones</th>
                  <th className="text-center py-3 px-2 font-semibold">Acción</th>
                </tr>
              </thead>
              <tbody>
                {studentsData.map((student) => {
                  const horasOrientacion = student.tieneOrientacionElegida
                    ? student.horasPorOrientacion[student.orientacionElegida] || 0
                    : 0;
                  const faltaOrientacion =
                    !student.tieneOrientacionElegida || horasOrientacion < HOURS_SPECIALTY_REQUIRED;
                  const faltaRotacion =
                    student.orientacionesCursadas.length < ROTATION_AREAS_REQUIRED;

                  return (
                    <tr
                      key={student.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="py-3 px-2">
                        <input
                          type="checkbox"
                          checked={selectedStudents.has(student.id)}
                          onChange={() => handleSelectStudent(student.id)}
                          className="w-4 h-4"
                          disabled={!student.correo}
                        />
                      </td>
                      <td className="py-3 px-2 font-medium">{student.nombre}</td>
                      <td className="py-3 px-2">{student.legajo}</td>
                      <td className="py-3 px-2 text-center">
                        <span
                          className={
                            student.horasTotales >= HOURS_TOTAL_REQUIRED
                              ? "text-green-600"
                              : "text-amber-600"
                          }
                        >
                          {student.horasTotales}
                        </span>
                      </td>
                      <td className="py-3 px-2 text-center text-slate-500">
                        {student.horasFaltantes > 0 ? `${student.horasFaltantes} hs` : "-"}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {student.tieneOrientacionElegida ? (
                          <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs">
                            {student.orientacionElegida}
                          </span>
                        ) : (
                          <span className="text-red-500 text-xs">Sin elegir</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        {student.tieneOrientacionElegida ? (
                          <span className={faltaOrientacion ? "text-red-500" : "text-green-600"}>
                            {horasOrientacion}/{HOURS_SPECIALTY_REQUIRED}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="py-3 px-2 text-center">
                        <span className={faltaRotacion ? "text-red-500" : "text-green-600"}>
                          {student.orientacionesCursadas.length}/{ROTATION_AREAS_REQUIRED}
                        </span>
                        <div className="text-xs text-slate-400 mt-1">
                          {student.orientacionesCursadas.slice(0, 3).join(", ")}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        <Button
                          onClick={() => handleSendEmail(student)}
                          disabled={!student.correo || sendingEmails.has(student.id)}
                          className="text-xs px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                        >
                          {sendingEmails.has(student.id) ? "Enviando..." : "Enviar Email"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            No hay estudiantes próximos a finalizar
          </div>
        )}
      </Card>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default ProximosFinalizarPanel;
