import { describe, expect, it } from "@jest/globals";
import { computeHorarioHealth, type HealthRosterRow } from "../lanzadorHealth";

const row = (
  horario: string,
  estado = "Inscripto",
  via: "asignado" | "seleccionado" = "seleccionado"
): HealthRosterRow => ({
  estado_inscripcion: estado,
  horario_asignado: via === "asignado" ? horario : null,
  horario_seleccionado: via === "seleccionado" ? horario : null,
});

describe("computeHorarioHealth", () => {
  it("devuelve [] cuando los horarios son fijos (sin diferenciación por franja)", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12; Martes 14-16",
      horariosFijos: true,
      cupos: 6,
      roster: [row("Lunes 10-12")],
    });
    expect(out).toEqual([]);
  });

  it("devuelve [] cuando no hay franjas declaradas", () => {
    expect(
      computeHorarioHealth({ horarioStr: "", horariosFijos: false, cupos: 6, roster: [] })
    ).toEqual([]);
    expect(
      computeHorarioHealth({ horarioStr: null, horariosFijos: false, cupos: 6, roster: [] })
    ).toEqual([]);
  });

  it("estima el cupo por franja como total ÷ nº de franjas", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12; Martes 14-16",
      horariosFijos: false,
      cupos: 6,
      roster: [],
    });
    expect(out).toHaveLength(2);
    expect(out[0].cuposLocal).toBe(3);
    expect(out[1].cuposLocal).toBe(3);
  });

  it("cuenta inscriptos por franja usando horario_asignado o, si falta, horario_seleccionado", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12; Martes 14-16",
      horariosFijos: false,
      cupos: 4,
      roster: [
        row("Lunes 10-12", "Inscripto", "seleccionado"),
        row("lunes 10-12", "Inscripto", "asignado"), // match case-insensitive
        row("Martes 14-16", "Inscripto", "seleccionado"),
      ],
    });
    const lunes = out.find((h) => h.label === "Lunes 10-12")!;
    const martes = out.find((h) => h.label === "Martes 14-16")!;
    expect(lunes.count).toBe(2);
    expect(martes.count).toBe(1);
  });

  it("cuenta seleccionados solo para estado 'Seleccionado' (insensible a mayúsculas)", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12",
      horariosFijos: false,
      cupos: 4,
      roster: [
        row("Lunes 10-12", "Seleccionado"),
        row("Lunes 10-12", "seleccionado"),
        row("Lunes 10-12", "Inscripto"),
      ],
    });
    expect(out[0].count).toBe(3);
    expect(out[0].seleccionados).toBe(2);
  });

  it("marca status 'low' cuando la franja no tiene inscriptos", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12; Martes 14-16",
      horariosFijos: false,
      cupos: 4,
      roster: [row("Lunes 10-12")],
    });
    const martes = out.find((h) => h.label === "Martes 14-16")!;
    expect(martes.count).toBe(0);
    expect(martes.status).toBe("low");
    expect(martes.libres).toBe(2); // cupoEstimado 2 - 0
  });

  it("marca status 'full' cuando los inscriptos alcanzan el cupo estimado", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12",
      horariosFijos: false,
      cupos: 2,
      roster: [row("Lunes 10-12"), row("Lunes 10-12")],
    });
    expect(out[0].cuposLocal).toBe(2);
    expect(out[0].status).toBe("full");
    expect(out[0].libres).toBe(0);
  });

  it("deriva selStatus: completo / falta / excedido respecto al cupo estimado", () => {
    const base = { horarioStr: "Lunes 10-12", horariosFijos: false, cupos: 2 };
    const completo = computeHorarioHealth({
      ...base,
      roster: [row("Lunes 10-12", "Seleccionado"), row("Lunes 10-12", "Seleccionado")],
    });
    expect(completo[0].selStatus).toBe("completo");
    expect(completo[0].faltanSeleccion).toBe(0);

    const falta = computeHorarioHealth({
      ...base,
      roster: [row("Lunes 10-12", "Seleccionado"), row("Lunes 10-12", "Inscripto")],
    });
    expect(falta[0].selStatus).toBe("falta");
    expect(falta[0].faltanSeleccion).toBe(1);

    const excedido = computeHorarioHealth({
      ...base,
      roster: [
        row("Lunes 10-12", "Seleccionado"),
        row("Lunes 10-12", "Seleccionado"),
        row("Lunes 10-12", "Seleccionado"),
      ],
    });
    expect(excedido[0].selStatus).toBe("excedido");
  });

  it("cuando no hay cupo total, cuposLocal es null y selStatus 'indef'", () => {
    const out = computeHorarioHealth({
      horarioStr: "Lunes 10-12",
      horariosFijos: false,
      cupos: null,
      roster: [row("Lunes 10-12", "Seleccionado")],
    });
    expect(out[0].cuposLocal).toBeNull();
    expect(out[0].libres).toBeNull();
    expect(out[0].faltanSeleccion).toBeNull();
    expect(out[0].selStatus).toBe("indef");
  });
});
