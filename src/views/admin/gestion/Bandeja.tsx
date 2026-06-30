import React, { useEffect, useState } from "react";
import { normalizeStringForComparison } from "../../../utils/formatters";
import { STATE_META, CATEGORIES, type BandejaItem, type CatId } from "./gestionTypes";
import { orientSlug } from "./gestionHelpers";

// ─── Bandeja ───────────────────────────────────────────────────────────────

const BandejaCard: React.FC<{
  item: BandejaItem;
  index: number;
  active: boolean;
  onSelect: () => void;
  onContact: () => void;
}> = ({ item, index, active, onSelect, onContact }) => {
  const meta = STATE_META[item.state];
  return (
    <div
      className={`bandeja-card press ${active ? "active" : ""}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={active}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && e.target === e.currentTarget) {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "32px 1fr auto",
          gap: 16,
          alignItems: "flex-start",
        }}
      >
        <div className="mono" style={{ fontSize: 12, color: "var(--ink-4)", paddingTop: 4 }}>
          {String(index).padStart(2, "0")}
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 6,
              flexWrap: "wrap",
            }}
          >
            <span className="chip-status" data-state={item.state}>
              <span className={`dot dot-${meta.dot}`} style={{ width: 6, height: 6 }} />
              {meta.label}
            </span>
            {item.noClasificada && (
              <span
                className="flag-unclassified"
                title="Estado de gestión no reconocido · conviene revisarlo"
              >
                <span className="material-icons">help_outline</span>
                sin clasificar
              </span>
            )}
            {item.flags.map((f) => (
              <span key={f.k} className="flag-missing">
                <span className="material-icons">{f.icon}</span>
                {f.label}
              </span>
            ))}
            {item.orientacion && (
              <span
                className="chip-orient"
                data-orient={orientSlug(item.orientacion)}
                style={{ fontSize: 10.5 }}
              >
                {item.orientacion}
              </span>
            )}
          </div>
          <h3
            className="serif"
            style={{
              margin: 0,
              fontSize: 17,
              fontWeight: 700,
              letterSpacing: "-0.015em",
              color: "var(--ink)",
            }}
          >
            {item.titulo}
          </h3>
          <div style={{ marginTop: 6, fontSize: 13, color: "var(--ink-2)", lineHeight: 1.4 }}>
            {item.razon}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            <span className="meta mono" style={{ fontSize: 11 }}>
              → {item.nextStep}
            </span>
          </div>
        </div>
        <div
          style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={`btn btn-sm ${item.phone ? "btn-wa" : "btn-ai"} press`}
            onClick={onContact}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              {item.phone ? "chat" : "auto_awesome"}
            </span>
            {item.phone ? "Contactar" : "Hermes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Bandeja: React.FC<{
  items: BandejaItem[];
  activeCat: CatId;
  totalCount: number;
  selectedKey: string | null;
  onSelect: (item: BandejaItem) => void;
  onContact: (item: BandejaItem) => void;
}> = ({ items, activeCat, totalCount, selectedKey, onSelect, onContact }) => {
  const cat = CATEGORIES.find((c) => c.id === activeCat);
  const isToday = activeCat === "hoy";
  const cap = isToday ? 7 : items.length;
  const [showAll, setShowAll] = useState(false);
  useEffect(() => {
    setShowAll(false);
  }, [activeCat]);
  const visible = showAll ? items : items.slice(0, cap);
  const hidden = items.length - visible.length;

  return (
    <>
      <header style={{ padding: "20px 32px 16px", borderBottom: "1px solid var(--rule-2)" }}>
        <span className="eyebrow">{isToday ? "Bandeja del día" : "Categoría"}</span>
        <h2
          className="serif"
          style={{ margin: "4px 0 0", fontSize: 24, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {isToday ? (
            <>
              Hoy conviene <em>esto</em>
            </>
          ) : (
            cat?.label
          )}
        </h2>
        <div className="meta" style={{ marginTop: 6 }}>
          {isToday
            ? `${Math.min(items.length, cap)} acciones priorizadas · ${totalCount} cosas en gestión`
            : `${cat?.note} · ${items.length} ítems`}
        </div>
      </header>

      <div style={{ padding: "20px 32px 64px", display: "flex", flexDirection: "column", gap: 12 }}>
        {items.length === 0 ? (
          <div style={{ padding: "60px 0", textAlign: "center", color: "var(--ink-3)" }}>
            <span className="material-icons" style={{ fontSize: 40, color: "var(--ink-4)" }}>
              check_circle
            </span>
            <div className="serif" style={{ marginTop: 12, fontSize: 18, fontWeight: 700 }}>
              Nada pendiente en esta vista
            </div>
            <div className="meta" style={{ marginTop: 6 }}>
              Probá otra categoría o cambiá la búsqueda.
            </div>
          </div>
        ) : (
          <>
            {visible.map((item, i) => (
              <BandejaCard
                key={item.id}
                item={item}
                index={i + 1}
                active={selectedKey === normalizeStringForComparison(item.grupo)}
                onSelect={() => onSelect(item)}
                onContact={() => onContact(item)}
              />
            ))}
            {hidden > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="press"
                style={{
                  marginTop: 8,
                  padding: "12px 16px",
                  background: "transparent",
                  border: "1px dashed var(--rule-3)",
                  borderRadius: 10,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--ink-3)",
                  fontFamily: "inherit",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  width: "100%",
                }}
              >
                <span className="material-icons" style={{ fontSize: 14 }}>
                  expand_more
                </span>
                Ver {hidden} más
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};
