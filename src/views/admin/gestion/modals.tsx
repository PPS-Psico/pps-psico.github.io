import React, { useState } from "react";
import { fetchHermesDraft, hermesWebhookConfigured } from "../../../services/hermesDraft";
import { STATE_META, type InstitutionVM, type UiState } from "./gestionTypes";

// ─── Plantillas de mensaje + reescritura Hermes (mockeada · shadow mode) ─────

export const WA_BASE = (vm: InstitutionVM) =>
  `Hola${vm.referente ? " " + vm.referente.split(" ")[0] : ""}, te escribo de la coordinación de Prácticas Profesionales Supervisadas de Psicología (UFLO Universidad). Quería consultarte por la continuidad de las prácticas en ${vm.nombre} para el próximo ciclo. ¿Tendrías unos minutos para conversarlo? ¡Gracias!`;

export const HERMES_STYLES: { id: string; label: string; icon: string }[] = [
  { id: "formal", label: "Formal", icon: "gavel" },
  { id: "breve", label: "Breve", icon: "bolt" },
  { id: "calido", label: "Cálido", icon: "favorite" },
  { id: "reinsistir", label: "Reinsistir", icon: "replay" },
];

export const hermesRewrite = (base: string, style: string, vm: InstitutionVM): string => {
  const ref = vm.referente ? vm.referente.split(" ")[0] : "";
  switch (style) {
    case "formal":
      return `Estimado/a${ref ? " " + ref : ""}:\n\nMe comunico en representación de la coordinación de Prácticas Profesionales Supervisadas de la Licenciatura en Psicología (UFLO Universidad) para consultar por la continuidad de las prácticas en ${vm.nombre} durante el próximo ciclo lectivo. Quedo a disposición para coordinar una reunión. Saludos cordiales.`;
    case "breve":
      return `Hola${ref ? " " + ref : ""}, soy de coordinación de PPS de Psicología UFLO. ¿Seguimos con las prácticas en ${vm.nombre} el próximo ciclo? ¡Gracias!`;
    case "calido":
      return `¡Hola${ref ? " " + ref : ""}! ¿Cómo va todo por ${vm.nombre}? Desde la coordinación de PPS de Psicología UFLO queríamos agradecerles por el trabajo del ciclo anterior y ver si los entusiasma seguir recibiendo practicantes. ¡Nos encantaría continuar! 😊`;
    case "reinsistir":
      return `Hola${ref ? " " + ref : ""}, te reescribo desde coordinación de PPS de Psicología UFLO por si se te traspapeló mi mensaje anterior 🙂. Cuando puedas, me encantaría saber si seguimos adelante con las prácticas en ${vm.nombre}. ¡Gracias!`;
    default:
      return base;
  }
};

export const ContactModal: React.FC<{
  vm: InstitutionVM;
  onClose: () => void;
  onSend: (vm: InstitutionVM, text: string) => void;
  onMarkWaiting: (vm: InstitutionVM) => void;
}> = ({ vm, onClose, onSend, onMarkWaiting }) => {
  const [text, setText] = useState(() => WA_BASE(vm));
  const [thinking, setThinking] = useState<string | null>(null);
  const [source, setSource] = useState<"n8n" | "local" | null>(null);

  const applyStyle = async (style: "formal" | "breve" | "calido" | "reinsistir") => {
    setThinking(style);
    setSource(null);
    // 1) Intentar borrador real vía n8n (contexto del último hilo).
    const real = await fetchHermesDraft({
      institucionId: vm.id,
      institucion: vm.nombre,
      referente: vm.referente,
      telefono: vm.phone,
      canal: "whatsapp",
      estilo: style,
      accion: style === "reinsistir" ? "reinsistir" : "contactar",
    });
    // 2) Fallback a plantilla local si n8n no responde / no está configurado.
    if (real) {
      setText(real);
      setSource("n8n");
    } else {
      setText(hermesRewrite(WA_BASE(vm), style, vm));
      setSource("local");
    }
    setThinking(null);
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 520, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Contactar por WhatsApp
        </div>
        <h3
          className="serif"
          style={{ margin: "4px 0 4px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {vm.nombre}
        </h3>
        <div className="meta mono" style={{ fontSize: 12, marginBottom: 16 }}>
          {vm.phone ? vm.phone : <span style={{ color: "var(--warn)" }}>Sin teléfono cargado</span>}
        </div>

        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <span className="material-icons" style={{ fontSize: 15, color: "var(--ai)" }}>
              auto_awesome
            </span>
            <span className="label" style={{ color: "var(--ai)" }}>
              Reescribir con Hermes
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {HERMES_STYLES.map((s) => (
              <button
                key={s.id}
                className="btn btn-sm btn-ai press"
                onClick={() => applyStyle(s.id as "formal" | "breve" | "calido" | "reinsistir")}
                disabled={!!thinking}
              >
                <span className="material-icons" style={{ fontSize: 13 }}>
                  {s.icon}
                </span>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <textarea
          className={`field ${thinking ? "shimmer" : ""}`}
          value={thinking ? "Hermes está reescribiendo…" : text}
          onChange={(e) => setText(e.target.value)}
          disabled={!!thinking}
          style={{ minHeight: 130, fontSize: 13.5, lineHeight: 1.5 }}
        />
        <div
          className="meta"
          style={{
            fontSize: 11,
            marginTop: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexWrap: "wrap",
          }}
        >
          <span className="material-icons" style={{ fontSize: 13 }}>
            info
          </span>
          Hermes solo propone el texto. Vos revisás y enviás manualmente desde WhatsApp.
          {source === "n8n" && (
            <span
              className="chip"
              style={{
                fontSize: 9.5,
                color: "var(--ai)",
                background: "var(--ai-soft)",
                borderColor: "transparent",
              }}
            >
              <span className="material-icons" style={{ fontSize: 11 }}>
                auto_awesome
              </span>
              contexto real (n8n)
            </span>
          )}
          {source === "local" && (
            <span className="chip" style={{ fontSize: 9.5 }}>
              <span className="material-icons" style={{ fontSize: 11 }}>
                {hermesWebhookConfigured() ? "cloud_off" : "draft"}
              </span>
              {hermesWebhookConfigured() ? "Hermes offline · plantilla" : "plantilla local"}
            </span>
          )}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 18,
            flexWrap: "wrap",
          }}
        >
          <button className="btn btn-ghost btn-sm press" onClick={() => onMarkWaiting(vm)}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              schedule_send
            </span>
            Marcar “Esperando respuesta”
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn press" onClick={onClose}>
              Cancelar
            </button>
            <button
              className="btn btn-wa press"
              onClick={() => onSend(vm, text)}
              disabled={!vm.phone || !!thinking}
            >
              <span className="material-icons" style={{ fontSize: 14 }}>
                open_in_new
              </span>
              Abrir WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── EditInstitucionModal ─────────────────────────────────────────────────────

export const EditInstitucionModal: React.FC<{
  vm: InstitutionVM;
  saving: boolean;
  onSave: (patch: {
    telefono?: string;
    tutor?: string;
    direccion?: string;
    convenio_nuevo?: string;
  }) => void;
  onClose: () => void;
}> = ({ vm, saving, onSave, onClose }) => {
  const [telefono, setTelefono] = useState(vm.phone || "");
  const [tutor, setTutor] = useState(vm.referente || "");
  const [direccion, setDireccion] = useState(vm.localidad || "");
  const [convenio, setConvenio] = useState(vm.convenio || "");

  const fields = [
    { label: "Teléfono", value: telefono, set: setTelefono, ph: "+54 9 11 ...", mono: true },
    { label: "Referente", value: tutor, set: setTutor, ph: "Nombre del referente", mono: false },
    {
      label: "Localidad / dirección",
      value: direccion,
      set: setDireccion,
      ph: "Localidad",
      mono: false,
    },
    {
      label: "Convenio",
      value: convenio,
      set: setConvenio,
      ph: "Estado del convenio",
      mono: false,
    },
  ];

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 460, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Editar datos de institución
        </div>
        <h3
          className="serif"
          style={{ margin: "4px 0 18px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {vm.nombre}
        </h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {fields.map((f) => (
            <div key={f.label}>
              <span className="label">{f.label}</span>
              <input
                className={`field ${f.mono ? "mono" : ""}`}
                value={f.value}
                placeholder={f.ph}
                onChange={(e) => f.set(e.target.value)}
                style={{ marginTop: 6 }}
              />
            </div>
          ))}
        </div>
        <div
          className="meta"
          style={{
            fontSize: 11,
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span className="material-icons" style={{ fontSize: 13 }}>
            save
          </span>
          Se actualiza la ficha de la institución en la base.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn press" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn btn-primary press"
            disabled={saving}
            onClick={() => onSave({ telefono, tutor, direccion, convenio_nuevo: convenio })}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              {saving ? "hourglass_empty" : "check"}
            </span>
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ReminderForm ─────────────────────────────────────────────────────────────

const REMINDER_PRESETS: { label: string; days: number }[] = [
  { label: "Mañana", days: 1 },
  { label: "En 5 días", days: 5 },
  { label: "En 1 semana", days: 7 },
  { label: "En 2 semanas", days: 14 },
  { label: "En 1 mes", days: 30 },
];

export const ReminderForm: React.FC<{
  vm: InstitutionVM;
  saving: boolean;
  onSave: (isoDate: string) => void;
  onClose: () => void;
}> = ({ vm, saving, onSave, onClose }) => {
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
  });

  const setPreset = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setDate(d.toISOString().slice(0, 10));
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div
        className="modal-card"
        style={{ maxWidth: 420, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Crear recordatorio
        </div>
        <h3
          className="serif"
          style={{ margin: "4px 0 18px", fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {vm.nombre}
        </h3>
        <span className="label">¿Cuándo te aviso?</span>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginBottom: 12 }}>
          {REMINDER_PRESETS.map((p) => (
            <button
              key={p.days}
              className="chip press"
              onClick={() => setPreset(p.days)}
              style={{ cursor: "pointer" }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="date"
          className="field mono"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <div
          className="meta"
          style={{
            fontSize: 11,
            marginTop: 12,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <span className="material-icons" style={{ fontSize: 13 }}>
            alarm
          </span>
          Se guarda en “próximo seguimiento” de la PPS más reciente.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn press" onClick={onClose} disabled={saving}>
            Cancelar
          </button>
          <button className="btn btn-primary press" disabled={saving} onClick={() => onSave(date)}>
            <span className="material-icons" style={{ fontSize: 14 }}>
              {saving ? "hourglass_empty" : "alarm_add"}
            </span>
            {saving ? "Guardando…" : "Crear recordatorio"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── ConfirmStateChange ───────────────────────────────────────────────────────

export const ConfirmStateChange: React.FC<{
  vm: InstitutionVM;
  newState: UiState;
  saving: boolean;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}> = ({ vm, newState, saving, onConfirm, onCancel }) => {
  const [note, setNote] = useState("");
  return (
    <div className="modal-bg" onClick={onCancel}>
      <div
        className="modal-card"
        style={{ maxWidth: 460, padding: 28 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Registrar cambio de estado
        </div>
        <h3
          className="serif"
          style={{
            margin: "4px 0 8px",
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: "-0.02em",
            lineHeight: 1.2,
          }}
        >
          {vm.nombre}
        </h3>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 0 18px",
            flexWrap: "wrap",
          }}
        >
          <span className="chip-status" data-state={vm.state} style={{ opacity: 0.6 }}>
            {STATE_META[vm.state].label}
          </span>
          <span className="material-icons" style={{ fontSize: 16, color: "var(--ink-4)" }}>
            arrow_forward
          </span>
          <span className="chip-status" data-state={newState}>
            {STATE_META[newState].label}
          </span>
        </div>
        <span className="label">Nota breve · opcional</span>
        <textarea
          className="field"
          placeholder="Ej: hablé con el referente, confirma para el próximo ciclo"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          style={{ marginTop: 6, minHeight: 70, fontSize: 13.5 }}
        />
        <div
          className="meta"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11.5,
            padding: "10px 0 0",
          }}
        >
          <span className="material-icons" style={{ fontSize: 13 }}>
            history
          </span>
          Se actualiza el estado de gestión en la base.
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn press" onClick={onCancel} disabled={saving}>
            Cancelar
          </button>
          <button
            className="btn btn-primary press"
            onClick={() => onConfirm(note)}
            disabled={saving}
          >
            <span className="material-icons" style={{ fontSize: 14 }}>
              {saving ? "hourglass_empty" : "check"}
            </span>
            {saving ? "Guardando…" : "Registrar cambio"}
          </button>
        </div>
      </div>
    </div>
  );
};
