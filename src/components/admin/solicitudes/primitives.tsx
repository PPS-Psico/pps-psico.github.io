import React from "react";
import type { TabType } from "./types";

// ─── Primitivos UI presentacionales del módulo de Solicitudes ───────

// ─── SubTabs (top tabs) ──────────────────────────────────────────────
export interface SubTabItem {
  id: TabType;
  label: string;
  icon: string;
  count: number;
}

export const SubTabs: React.FC<{
  tabs: SubTabItem[];
  active: TabType;
  onChange: (id: TabType) => void;
}> = ({ tabs, active, onChange }) => {
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: "var(--paper-2)",
        border: "1px solid var(--rule-2)",
      }}
    >
      {tabs.map((t) => {
        const on = active === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className="press"
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              padding: "9px 14px",
              borderRadius: 9,
              border: 0,
              background: on ? "var(--paper)" : "transparent",
              color: on ? "var(--ink)" : "var(--ink-3)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
              boxShadow: on ? "0 1px 3px rgba(20,19,16,0.1)" : "none",
              transition: "all .12s ease",
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              {t.icon}
            </span>
            <span>{t.label}</span>
            {t.count > 0 && (
              <span
                className="mono"
                style={{
                  fontSize: 10.5,
                  padding: "1px 6px",
                  borderRadius: 999,
                  background: on ? "var(--ink)" : "var(--rule-2)",
                  color: on ? "var(--paper)" : "var(--ink-3)",
                  fontWeight: 600,
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─── FilterTabs (quick filter buttons) ──────────────────────────────
export interface FilterOption {
  value: string;
  label: string;
  icon?: string;
  tone?: "ai" | "warn";
  count?: number;
}

export const FilterTabs: React.FC<{
  options: FilterOption[];
  value: string;
  onChange: (val: string) => void;
}> = ({ options, value, onChange }) => {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => {
        const on = value === o.value;
        const special = o.tone === "ai" || o.tone === "warn";
        const toneC =
          o.tone === "ai" ? "var(--ai)" : o.tone === "warn" ? "var(--warn)" : "var(--ink)";
        const toneS =
          o.tone === "ai"
            ? "var(--ai-soft)"
            : o.tone === "warn"
              ? "var(--warn-soft)"
              : "var(--paper-2)";
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className="press"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${on ? (special ? toneC : "var(--ink)") : "var(--rule-2)"}`,
              background: on ? (special ? toneS : "var(--ink)") : "transparent",
              color: on ? (special ? toneC : "var(--paper)") : "var(--ink-2)",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {o.icon && (
              <span className="material-icons" style={{ fontSize: 14 }}>
                {o.icon}
              </span>
            )}
            {o.label}
            {o.count != null && (
              <span className="mono" style={{ fontSize: 10.5, opacity: 0.75 }}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─── SearchBar ──────────────────────────────────────────────────────
export const SearchBar: React.FC<{
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
}> = ({ value, onChange, placeholder }) => {
  return (
    <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
      <span
        className="material-icons"
        style={{
          position: "absolute",
          left: 11,
          top: "50%",
          transform: "translateY(-50%)",
          fontSize: 17,
          color: "var(--ink-4)",
        }}
      >
        search
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field"
        style={{ paddingLeft: 36, fontSize: 13 }}
      />
    </div>
  );
};

// ─── DataGrid Item ──────────────────────────────────────────────────
export const DataItem: React.FC<{
  label: string;
  value: React.ReactNode;
  icon?: string;
  full?: boolean;
}> = ({ label, value, icon, full }) => {
  const empty = !value;
  return (
    <div
      style={{
        gridColumn: full ? "1 / -1" : "auto",
        background: "var(--paper)",
        border: "1px solid var(--rule-2)",
        borderRadius: 10,
        padding: "10px 12px",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
        {icon && (
          <span className="material-icons" style={{ fontSize: 13, color: "var(--ink-4)" }}>
            {icon}
          </span>
        )}
        <span className="label" style={{ fontSize: 9.5 }}>
          {label}
        </span>
      </div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: empty ? "var(--ink-4)" : "var(--ink)",
          fontStyle: empty ? "italic" : "normal",
          lineHeight: 1.4,
          wordBreak: "break-word",
        }}
      >
        {value || "No especificado"}
      </div>
    </div>
  );
};

// ─── Empty State ────────────────────────────────────────────────────
export const EmptyState: React.FC<{
  icon: string;
  title: string;
  msg: string;
}> = ({ icon, title, msg }) => {
  return (
    <div style={{ padding: "64px 24px", textAlign: "center" }}>
      <div
        style={{
          width: 54,
          height: 54,
          borderRadius: 999,
          background: "var(--paper-2)",
          display: "inline-flex",
          alignItems: "center",
          justifyItems: "center",
          justifyContent: "center",
          margin: "0 auto",
        }}
      >
        <span className="material-icons" style={{ fontSize: 26, color: "var(--ink-4)" }}>
          {icon}
        </span>
      </div>
      <div
        className="serif"
        style={{ marginTop: 14, fontSize: 17, fontWeight: 700, color: "var(--ink-2)" }}
      >
        {title}
      </div>
      <div
        className="meta"
        style={{ marginTop: 6, maxWidth: 280, marginInline: "auto", lineHeight: 1.5 }}
      >
        {msg}
      </div>
    </div>
  );
};
