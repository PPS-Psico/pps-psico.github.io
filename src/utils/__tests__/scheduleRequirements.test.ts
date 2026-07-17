import { describe, expect, it } from "@jest/globals";
import {
  FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS,
  FIELD_HORARIOS_FIJOS_LANZAMIENTOS,
  FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS,
} from "../../constants";
import {
  getMandatoryLaunchSchedules,
  mergeMandatorySchedules,
  parseLaunchSchedules,
} from "../scheduleRequirements";

const horarios = ["Lunes 9 a 12", "Martes 14 a 17", "Viernes 8 a 10"];

describe("scheduleRequirements", () => {
  it("interpreta un subconjunto explícito de horarios obligatorios", () => {
    const launch = {
      [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: horarios.join("; "),
      [FIELD_HORARIOS_FIJOS_LANZAMIENTOS]: false,
      [FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS]: [horarios[0], horarios[2]],
    };

    expect(getMandatoryLaunchSchedules(launch)).toEqual([horarios[0], horarios[2]]);
  });

  it("conserva convocatorias legacy con todos los horarios fijos", () => {
    const launch = {
      [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: horarios.join("; "),
      [FIELD_HORARIOS_FIJOS_LANZAMIENTOS]: true,
      [FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS]: null,
    };

    expect(getMandatoryLaunchSchedules(launch)).toEqual(horarios);
  });

  it("un array vacío explícito prevalece sobre el booleano legacy", () => {
    const launch = {
      [FIELD_HORARIO_SELECCIONADO_LANZAMIENTOS]: horarios.join("; "),
      [FIELD_HORARIOS_FIJOS_LANZAMIENTOS]: true,
      [FIELD_HORARIOS_OBLIGATORIOS_LANZAMIENTOS]: [],
    };

    expect(getMandatoryLaunchSchedules(launch)).toEqual([]);
  });

  it("incluye siempre los obligatorios y conserva el orden publicado", () => {
    expect(mergeMandatorySchedules([horarios[2]], [horarios[0]], horarios)).toEqual([
      horarios[0],
      horarios[2],
    ]);
    expect(parseLaunchSchedules(` ${horarios[0]};\n${horarios[1]}; ${horarios[0]} `)).toEqual([
      horarios[0],
      horarios[1],
    ]);
  });
});
