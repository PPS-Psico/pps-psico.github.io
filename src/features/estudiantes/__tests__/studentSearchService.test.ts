import {
  searchStudents,
  studentSearchFilter,
  STUDENT_SEARCH_PAGE_SIZE,
} from "../studentSearchService";

let mockData: unknown[] = [];
let mockError: unknown = null;
const mockQuery = {
  select: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  abortSignal: jest.fn().mockReturnThis(),
  then: (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data: mockData, error: mockError }).then(resolve),
};
const mockFrom = jest.fn((_table: string) => mockQuery);
jest.mock("../../../lib/supabaseClient", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockData = [];
  mockError = null;
});

it("pide sólo la página y tres campos, con orden estable y cancelación", async () => {
  mockData = Array.from({ length: 21 }, (_, id) => ({
    id: String(id),
    nombre: "Ana",
    legajo: String(id),
  }));
  const signal = new AbortController().signal;
  const result = await searchStudents(" Ana ", 2, signal);
  expect(mockQuery.select).toHaveBeenCalledWith("id, nombre, legajo");
  expect(mockQuery.ilike).toHaveBeenCalledWith("estado", "activo");
  expect(mockQuery.order.mock.calls).toEqual([
    ["nombre", { ascending: true }],
    ["id", { ascending: true }],
  ]);
  expect(mockQuery.range).toHaveBeenCalledWith(20, 40);
  expect(mockQuery.abortSignal).toHaveBeenCalledWith(signal);
  expect(result.students).toHaveLength(STUDENT_SEARCH_PAGE_SIZE);
  expect(result.hasNextPage).toBe(true);
});

it("no consulta con una búsqueda vacía o un solo carácter", async () => {
  await expect(searchStudents(" ", 1)).resolves.toEqual({ students: [], hasNextPage: false });
  await searchStudents("a", 1);
  expect(mockFrom).not.toHaveBeenCalled();
});

it("no convierte errores en ausencia de estudiantes", async () => {
  mockError = { code: "42501", message: "Denied" };
  await expect(searchStudents("Ana", 1)).rejects.toMatchObject({
    name: "DbError",
    kind: "permission-denied",
  });
});

it("mantiene comas, comillas y operadores aparentes dentro del valor literal", () => {
  const term = 'Ana",id.neq.0),(%_';
  const quoted = JSON.stringify('%Ana",id.neq.0),(\\%\\_%');
  expect(studentSearchFilter(term)).toBe(`nombre.ilike.${quoted},legajo.ilike.${quoted}`);
});

it("distingue la última página y rechaza offsets inválidos", async () => {
  mockData = [{ id: "last", nombre: "Ana", legajo: "1" }];
  expect((await searchStudents("Ana", 1)).hasNextPage).toBe(false);
  await expect(searchStudents("Ana", 0)).rejects.toThrow(RangeError);
});
