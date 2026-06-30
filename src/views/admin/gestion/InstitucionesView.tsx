import React, { useEffect, useMemo, useRef, useState } from "react";
import { formatDate } from "../../../utils/formatters";
import {
  STATE_META,
  nextActionFor,
  type InstitutionVM,
  type SortKey,
  type FilterOption,
} from "./gestionTypes";
import { orientSlug } from "./gestionHelpers";

// ─── FilterDropdown ──────────────────────────────────────────────────────────
// Dropdown de filtro con menú flotante (cierre por click-fuera / Escape,
// estética Paper & Ink). Soporta puntos de color por orientación y check.
const FilterDropdown: React.FC<{
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}> = ({ label, value, options, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isActive = value !== "all";
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="filter-dd" ref={ref}>
      <button
        type="button"
        className={`filter-trigger press ${isActive ? "active" : ""} ${open ? "open" : ""}`}
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {isActive && current?.orient && (
          <span
            className="filter-dot"
            style={{ width: 7, height: 7 }}
            data-orient={current.orient}
          />
        )}
        <span>{isActive ? current?.label : label}</span>
        <span className="material-icons filter-caret">expand_more</span>
      </button>
      {open && (
        <div className="filter-menu" role="listbox">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="option"
              aria-selected={opt.value === value}
              className={`filter-opt ${opt.value === value ? "selected" : ""}`}
              data-orient={opt.orient}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.orient && <span className="filter-dot" data-orient={opt.orient} />}
              <span>{opt.label}</span>
              {opt.value === value && <span className="material-icons filter-check">check</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── InstitucionesView (cartera / CRM) ───────────────────────────────────────

export const InstitucionesView: React.FC<{
  institutions: InstitutionVM[];
  selectedKey: string | null;
  onSelect: (vm: InstitutionVM) => void;
  onContact?: (vm: InstitutionVM) => void;
}> = ({ institutions, selectedKey, onSelect, onContact }) => {
  const [sortBy, setSortBy] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [orientFilter, setOrientFilter] = useState<string>("all");
  const [convenioFilter, setConvenioFilter] = useState<string>("all");
  const [query, setQuery] = useState("");

  const orientOptions = useMemo<FilterOption[]>(() => {
    const bySlug = new Map<string, string>();
    institutions.forEach((i) =>
      i.orientaciones.forEach((o) => {
        if (!o) return;
        const slug = orientSlug(o);
        // Nos quedamos con la primera etiqueta legible por slug (evita duplicados
        // tipo "Clínica" / "Clinica" por acentos o mayúsculas).
        if (slug && !bySlug.has(slug)) bySlug.set(slug, o.trim());
      })
    );
    const opts = [...bySlug.entries()]
      .map(([slug, label]) => ({ value: slug, label, orient: slug }))
      .sort((a, b) => a.label.localeCompare(b.label));
    return [{ value: "all", label: "Toda orientación" }, ...opts];
  }, [institutions]);

  const convenioOptions: FilterOption[] = useMemo(
    () => [
      { value: "all", label: "Convenio · todos" },
      { value: "con", label: "Con convenio" },
      { value: "sin", label: "Sin convenio" },
    ],
    []
  );

  const filtered = useMemo(() => {
    let list = institutions;
    if (orientFilter !== "all")
      list = list.filter((i) => i.orientaciones.some((o) => orientSlug(o) === orientFilter));
    if (convenioFilter !== "all") {
      list = list.filter((i) => (convenioFilter === "con" ? !!i.convenio : !i.convenio));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (i) =>
          i.nombre.toLowerCase().includes(q) ||
          (i.referente || "").toLowerCase().includes(q) ||
          (i.localidad || "").toLowerCase().includes(q) ||
          (i.phone || "").toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "nombre") cmp = a.nombre.localeCompare(b.nombre);
      else if (sortBy === "actividad") cmp = b.lastActivity - a.lastActivity;
      else if (sortBy === "faltantes") cmp = b.flags.length - a.flags.length;
      else if (sortBy === "proxima") {
        const pa = a.proximo ? new Date(a.proximo).getTime() : Infinity;
        const pb = b.proximo ? new Date(b.proximo).getTime() : Infinity;
        cmp = pa - pb;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [institutions, orientFilter, convenioFilter, query, sortBy, sortDir]);

  const toggleSort = (k: SortKey) => {
    if (sortBy === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(k);
      setSortDir("asc");
    }
  };

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button className={`sort-btn ${sortBy === k ? "active" : ""}`} onClick={() => toggleSort(k)}>
      {label}
      {sortBy === k && (
        <span className="material-icons" style={{ fontSize: 12 }}>
          {sortDir === "asc" ? "arrow_upward" : "arrow_downward"}
        </span>
      )}
    </button>
  );

  const filtersActive = orientFilter !== "all" || convenioFilter !== "all" || !!query.trim();

  return (
    <>
      <header
        style={{
          padding: "20px 32px 16px",
          borderBottom: "1px solid var(--rule-2)",
          position: "relative",
          zIndex: 20,
        }}
      >
        <span className="eyebrow">Cartera de instituciones</span>
        <h2
          className="serif"
          style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {filtered.length} {filtered.length === 1 ? "institución" : "instituciones"}
          {filtersActive && (
            <span style={{ color: "var(--ink-4)", fontWeight: 500, fontSize: 18 }}>
              {" "}
              · de {institutions.length}
            </span>
          )}
        </h2>
        <div className="meta" style={{ marginTop: 6 }}>
          Buscar, auditar y limpiar — sin depender de la bandeja del día.
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            marginTop: 16,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div className="inst-search">
            <span className="material-icons">search</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre, referente, localidad o tel…"
            />
          </div>
          <span style={{ flex: 1 }} />
          <FilterDropdown
            label="Toda orientación"
            value={orientFilter}
            options={orientOptions}
            onChange={setOrientFilter}
          />
          <FilterDropdown
            label="Convenio · todos"
            value={convenioFilter}
            options={convenioOptions}
            onChange={setConvenioFilter}
          />
        </div>
      </header>

      <div className="sort-header">
        <SortBtn k="nombre" label="Institución" />
        <span className="label" style={{ fontSize: 10 }}>
          Estado actual
        </span>
        <SortBtn k="actividad" label="Últ. actividad" />
        <span className="label" style={{ fontSize: 10 }}>
          Próxima acción
        </span>
        <SortBtn k="faltantes" label="Faltantes" />
        <span />
      </div>

      <div style={{ paddingBottom: 64 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "60px 32px", textAlign: "center", color: "var(--ink-3)" }}>
            <span className="material-icons" style={{ fontSize: 40, color: "var(--ink-4)" }}>
              search_off
            </span>
            <div className="serif" style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>
              Sin resultados
            </div>
            <div className="meta" style={{ marginTop: 6 }}>
              Probá quitando algún filtro o cambiando la búsqueda.
            </div>
          </div>
        ) : (
          filtered.map((vm) => (
            <div
              key={vm.key}
              role="button"
              tabIndex={0}
              className={`inst-row press ${selectedKey === vm.key ? "active" : ""}`}
              onClick={() => onSelect(vm)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(vm);
                }
              }}
            >
              {/* Institución */}
              <div style={{ minWidth: 0 }}>
                <div
                  className="serif"
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    letterSpacing: "-0.01em",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {vm.nombre}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    marginTop: 4,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  {vm.orientaciones.slice(0, 2).map((o, i) => (
                    <span
                      key={`${o}-${i}`}
                      className="chip-orient"
                      data-orient={orientSlug(o)}
                      style={{ fontSize: 10 }}
                    >
                      {o}
                    </span>
                  ))}
                  {vm.localidad && (
                    <span className="meta" style={{ fontSize: 10.5 }}>
                      · {vm.localidad}
                    </span>
                  )}
                </div>
              </div>

              {/* Estado actual */}
              <div>
                <span className="chip-status" data-state={vm.state} style={{ fontSize: 10.5 }}>
                  <span className={`dot dot-${STATE_META[vm.state].dot}`} />
                  {STATE_META[vm.state].label}
                </span>
              </div>

              {/* Última actividad */}
              <div className="meta" style={{ fontSize: 11.5, lineHeight: 1.35 }}>
                {vm.lastActivityLabel ? (
                  <>
                    <span style={{ color: "var(--ink-2)" }}>{vm.lastActivityLabel}</span>
                    {vm.lastActivity > 0 && (
                      <span
                        className="mono"
                        style={{
                          display: "block",
                          fontSize: 10.5,
                          color: "var(--ink-4)",
                          marginTop: 2,
                        }}
                      >
                        {formatDate(new Date(vm.lastActivity).toISOString())}
                      </span>
                    )}
                  </>
                ) : vm.lastActivity > 0 ? (
                  <span className="mono">
                    {formatDate(new Date(vm.lastActivity).toISOString())}
                  </span>
                ) : (
                  <span style={{ color: "var(--ink-4)" }}>—</span>
                )}
              </div>

              {/* Próxima acción */}
              <div
                className="meta"
                style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.35 }}
              >
                {nextActionFor(vm)}
                {vm.proximo && (
                  <span
                    className="mono"
                    style={{
                      display: "block",
                      fontSize: 10.5,
                      color: "var(--accent)",
                      marginTop: 2,
                    }}
                  >
                    {formatDate(vm.proximo)}
                  </span>
                )}
              </div>

              {/* Faltantes */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {vm.flags.length === 0 ? (
                  <span className="flag-complete">
                    <span className="material-icons">check_circle</span>
                    completo
                  </span>
                ) : (
                  vm.flags.map((f) => (
                    <span key={f.k} className="flag-icon" title={f.label}>
                      <span className="material-icons">{f.icon}</span>
                    </span>
                  ))
                )}
              </div>

              {/* Acciones rápidas */}
              <div className="inst-actions" onClick={(e) => e.stopPropagation()}>
                {vm.phone && onContact && (
                  <button
                    type="button"
                    className="inst-act inst-act-wa press"
                    title={`WhatsApp ${vm.phone}`}
                    onClick={() => onContact(vm)}
                  >
                    <span className="material-icons">chat</span>
                  </button>
                )}
                <button
                  type="button"
                  className="inst-act press"
                  title="Ver ficha"
                  onClick={() => onSelect(vm)}
                >
                  <span className="material-icons">chevron_right</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
};
