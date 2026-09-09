import { useStudentSearch } from "./useStudentSearch";

export function StudentReplacementSearch({
  enrolledIds,
  onSelect,
  disabled = false,
  enabled = true,
}: {
  enrolledIds: readonly string[];
  onSelect: (id: string) => void;
  disabled?: boolean;
  enabled?: boolean;
}) {
  const search = useStudentSearch(enabled, enrolledIds);
  return (
    <div className="lv4-replacement-search">
      <label className="lv4-replacement-label" htmlFor="replacement-student-search">
        Nombre o legajo del estudiante
      </label>
      <input
        id="replacement-student-search"
        className="lv4-search"
        type="search"
        maxLength={100}
        placeholder="Escribí al menos 2 caracteres"
        value={search.term}
        onChange={(event) => search.setTerm(event.target.value)}
      />
      <div role="status" className="lv4-replacement-status">
        {!enabled
          ? "La búsqueda estará disponible cuando se confirme la lista de postulados."
          : search.needsTerm
            ? "Buscá un estudiante activo que no esté postulado en esta PPS."
            : search.isLoading
              ? "Buscando estudiantes…"
              : search.error
                ? "No se pudo consultar a los estudiantes."
                : !search.students.length
                  ? search.hasNextPage || search.page > 1
                    ? "No hay estudiantes disponibles en esta página."
                    : "No se encontraron estudiantes disponibles."
                  : null}
      </div>
      {search.error && !search.isLoading && (
        <button className="lv4-btn" onClick={search.retry}>
          Reintentar búsqueda
        </button>
      )}
      {!search.isLoading && !search.error && (
        <ul className="lv4-replacement-results">
          {search.students.map((student) => (
            <li className="lv4-replacement-row" key={student.id}>
              <div className="lv4-replacement-identity">
                <strong>{student.nombre}</strong>
                <span>Legajo: {student.legajo || "Sin legajo"}</span>
              </div>
              <button
                className="lv4-btn"
                disabled={disabled}
                aria-label={`Seleccionar a ${student.nombre}`}
                onClick={() => onSelect(student.id)}
              >
                Seleccionar
              </button>
            </li>
          ))}
        </ul>
      )}
      {!search.needsTerm && (search.page > 1 || search.hasNextPage) && (
        <nav className="lv4-replacement-pagination" aria-label="Páginas de estudiantes">
          <button
            className="lv4-btn"
            disabled={search.page === 1 || search.isLoading}
            onClick={search.previous}
          >
            Anterior
          </button>
          <span>Página {search.page}</span>
          <button
            className="lv4-btn"
            disabled={!search.hasNextPage || search.isLoading || !!search.error}
            onClick={search.next}
          >
            Siguiente
          </button>
        </nav>
      )}
    </div>
  );
}
