import React from "react";
import { CATEGORIES, type CatId, type CatDef, type ViewMode } from "./gestionTypes";

// ─── Navegación de Gestión: Rail lateral + ViewModeTabs ─────────────────────

// ─── Rail (colapsable) ───────────────────────────────────────────────────────

export const Rail: React.FC<{
  activeCat: CatId;
  counts: Record<string, number>;
  search: string;
  collapsed: boolean;
  onToggle: () => void;
  onSearch: (v: string) => void;
  onSelect: (c: CatId) => void;
}> = ({ activeCat, counts, search, collapsed, onToggle, onSearch, onSelect }) => {
  const RailRow = (cat: CatDef) => (
    <button
      key={cat.id}
      onClick={() => onSelect(cat.id)}
      title={collapsed ? cat.label : undefined}
      className={`rail-row press ${activeCat === cat.id ? "active" : ""}`}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 14,
        }}
      >
        {cat.tone ? (
          <span className={`dot dot-${cat.tone}`} />
        ) : (
          <span className="material-icons" style={{ fontSize: 14, color: "var(--ink-3)" }}>
            {cat.icon}
          </span>
        )}
      </span>
      <span
        className="rail-label"
        style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
      >
        {cat.label}
      </span>
      <span className="count">{counts[cat.id] || "·"}</span>
    </button>
  );

  return (
    <aside className="gv3-rail">
      <div
        style={{
          padding: collapsed ? "16px 0 10px" : "18px 14px 10px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        {!collapsed && (
          <div className="rail-hideable">
            <h1
              className="serif"
              style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em" }}
            >
              Gestión
            </h1>
            <div className="meta" style={{ marginTop: 4 }}>
              Escritorio de coordinación
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          className="btn btn-ghost btn-sm press"
          title={collapsed ? "Expandir" : "Colapsar"}
          style={{ padding: 6, margin: collapsed ? "0 auto" : 0 }}
        >
          <span className="material-icons" style={{ fontSize: 18, color: "var(--ink-3)" }}>
            {collapsed ? "chevron_right" : "chevron_left"}
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="rail-hideable" style={{ padding: "0 14px 12px" }}>
          <div style={{ position: "relative" }}>
            <span
              className="material-icons"
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: 14,
                color: "var(--ink-4)",
                pointerEvents: "none",
              }}
            >
              search
            </span>
            <input
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Buscar institución…"
              className="field"
              style={{ paddingLeft: 32, fontSize: 12.5, paddingTop: 8, paddingBottom: 8 }}
            />
          </div>
        </div>
      )}

      {!collapsed && <div className="rail-section-title label rail-hideable">Categorías</div>}
      {CATEGORIES.filter((c) => c.id !== "hoy").map(RailRow)}

      <div
        style={{
          padding: collapsed ? "16px 0" : "20px 14px 16px",
          marginTop: "auto",
          borderTop: "1px solid var(--rule-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
        }}
      >
        <span className="meta" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span className="dot dot-ok dot-live" style={{ color: "var(--ok)" }} />
          {!collapsed && <span className="rail-hideable">Sincronizado</span>}
        </span>
        {!collapsed && (
          <span className="mono meta rail-hideable" style={{ fontSize: 10.5 }}>
            v3.2
          </span>
        )}
      </div>
    </aside>
  );
};

// ─── ViewModeTabs ────────────────────────────────────────────────────────────

export const ViewModeTabs: React.FC<{
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
  badges: Record<string, number>;
}> = ({ mode, onChange, badges }) => {
  const tabs: { id: ViewMode; label: string; icon: string; ai?: boolean }[] = [
    { id: "mails", label: "Hoy", icon: "auto_awesome", ai: true },
    { id: "bandeja", label: "Seguimiento", icon: "checklist" },
    { id: "instituciones", label: "Instituciones", icon: "apartment" },
    { id: "calendario", label: "Calendario", icon: "calendar_month" },
    { id: "contactos", label: "Contactos", icon: "forum", ai: true },
  ];
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: "8px 16px",
        background: "var(--paper-2)",
        borderBottom: "1px solid var(--rule-2)",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const active = mode === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className="press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 14px",
              borderRadius: 7,
              border: "none",
              cursor: "pointer",
              background: active ? "var(--paper)" : "transparent",
              color: active ? (tab.ai ? "var(--ai)" : "var(--ink)") : "var(--ink-3)",
              fontWeight: active ? 600 : 500,
              fontSize: 12.5,
              fontFamily: "inherit",
              boxShadow: active ? "0 1px 2px rgba(20,19,16,0.06)" : "none",
            }}
          >
            <span className="material-icons" style={{ fontSize: 15 }}>
              {tab.icon}
            </span>
            {tab.label}
            {badges[tab.id] != null && badges[tab.id] > 0 && (
              <span
                className="mono"
                style={{
                  fontSize: 10,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: tab.ai ? "var(--ai)" : active ? "var(--ink)" : "var(--rule-2)",
                  color: tab.ai ? "var(--paper)" : active ? "var(--paper)" : "var(--ink-3)",
                  fontWeight: 600,
                }}
              >
                {badges[tab.id]}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
