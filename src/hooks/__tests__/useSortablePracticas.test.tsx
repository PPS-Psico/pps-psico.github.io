import { act, renderHook } from "@testing-library/react";
import { useSortablePracticas, type SortConfig } from "../useSortablePracticas";
import * as C from "../../constants";
import type { Practica } from "../../types";

const makePractica = (over: Partial<Record<string, unknown>>): Practica =>
  ({ id: String(over.id ?? "p"), createdTime: "", ...over }) as unknown as Practica;

const practicas: Practica[] = [
  makePractica({
    id: "1",
    [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Zeta",
    [C.FIELD_HORAS_PRACTICAS]: 30,
    [C.FIELD_FECHA_INICIO_PRACTICAS]: "2026-03-01",
    [C.FIELD_ESTADO_PRACTICA]: "En curso",
    [C.FIELD_ESPECIALIDAD_PRACTICAS]: "Clínica",
  }),
  makePractica({
    id: "2",
    [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Alfa",
    [C.FIELD_HORAS_PRACTICAS]: 120,
    [C.FIELD_FECHA_INICIO_PRACTICAS]: "2026-01-15",
    [C.FIELD_ESTADO_PRACTICA]: "Finalizada",
    [C.FIELD_ESPECIALIDAD_PRACTICAS]: "Laboral",
  }),
  makePractica({
    id: "3",
    [C.FIELD_NOMBRE_INSTITUCION_LOOKUP_PRACTICAS]: "Mu",
    [C.FIELD_HORAS_PRACTICAS]: 0,
    [C.FIELD_FECHA_INICIO_PRACTICAS]: null,
    [C.FIELD_ESTADO_PRACTICA]: "En curso",
    [C.FIELD_ESPECIALIDAD_PRACTICAS]: "Educacional",
  }),
];

const noSort: SortConfig = { key: null, direction: "ascending" };

describe("useSortablePracticas", () => {
  it("sin key configurada conserva el orden original", () => {
    const { result } = renderHook(() => useSortablePracticas(practicas, noSort));
    expect(result.current.sortedPracticas.map((p) => p.id)).toEqual(["1", "2", "3"]);
  });

  it("ordena por institución ascendente (alfabético, normalizado)", () => {
    const { result } = renderHook(() =>
      useSortablePracticas(practicas, { key: "institucion", direction: "ascending" })
    );
    expect(result.current.sortedPracticas.map((p) => p.id)).toEqual(["2", "3", "1"]);
  });

  it("ordena por horas descendente", () => {
    const { result } = renderHook(() =>
      useSortablePracticas(practicas, { key: "horas", direction: "descending" })
    );
    expect(result.current.sortedPracticas.map((p) => p.id)).toEqual(["2", "1", "3"]);
  });

  it("ordena por fecha de inicio ascendente; fechas nulas van primero (time=0)", () => {
    const { result } = renderHook(() =>
      useSortablePracticas(practicas, { key: "fechaInicio", direction: "ascending" })
    );
    // p3 (null -> 0), p2 (ene), p1 (mar)
    expect(result.current.sortedPracticas.map((p) => p.id)).toEqual(["3", "2", "1"]);
  });

  it("no muta el array original", () => {
    const original = [...practicas];
    renderHook(() => useSortablePracticas(practicas, { key: "horas", direction: "ascending" }));
    expect(practicas).toEqual(original);
  });

  it("requestSort alterna ascending -> descending sobre la misma key", () => {
    const { result } = renderHook(() => useSortablePracticas(practicas, noSort));

    act(() => result.current.requestSort("horas"));
    expect(result.current.sortConfig).toEqual({ key: "horas", direction: "ascending" });

    act(() => result.current.requestSort("horas"));
    expect(result.current.sortConfig).toEqual({ key: "horas", direction: "descending" });
  });

  it("requestSort sobre una key distinta arranca en ascending", () => {
    const { result } = renderHook(() =>
      useSortablePracticas(practicas, { key: "horas", direction: "descending" })
    );
    act(() => result.current.requestSort("estado"));
    expect(result.current.sortConfig).toEqual({ key: "estado", direction: "ascending" });
  });
});
