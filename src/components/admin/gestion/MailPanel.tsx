// ──────────────────────────────────────────────────────────────────────────
// MailPanel — panel DERECHO para leer y responder un correo (sin modal).
//
// Layout de 3 zonas con scroll interno:
//   · Header fijo: asunto, estado, remitente.
//   · Conversación scrolleable (el "rectángulo" que se puede recorrer).
//   · Composer fijo abajo: el borrador de Hermes ya viene PREVISUALIZADO y
//     editable, sin botón intermedio. Solo "Enviar" (con confirmación) y archivar.
//
// Seguridad: el envío respeta el kill-switch (gmailService).
// ──────────────────────────────────────────────────────────────────────────
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getThread,
  sendReply,
  modifyThread,
  getDraftForThread,
  learnFromDraftEdit,
  type GmailThread,
  type GmailMessage,
  type HermesDraft,
} from "../../../services/gmailService";
import { fetchHermesDraft, hermesWebhookConfigured } from "../../../services/hermesDraft";
import type { GmailHilo } from "../../../hooks/useGmailHilos";

interface Props {
  hilo: GmailHilo;
  isTestingMode?: boolean;
  onClose: () => void;
  onActionDone?: (msg: string) => void;
  onRefetch?: () => void;
}

const ME = "blas.rivera@uflouniversidad.edu.ar";

const extractEmail = (s: string): string => {
  const m = (s || "").match(/<([^>]+)>/);
  return (m ? m[1] : s || "").trim();
};
const initialOf = (s: string): string => {
  const e = extractEmail(s).replace(/[<>"]/g, "");
  return (e[0] || "?").toUpperCase();
};
const fmtDate = (iso: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};
const localMessages = (hilo: GmailHilo): GmailMessage[] => {
  const raw = (hilo as unknown as { raw_mensajes?: Array<Record<string, unknown>> }).raw_mensajes;
  if (!Array.isArray(raw)) return [];
  return raw.map((m) => {
    const from = String(m.from || "");
    return {
      from,
      to: String(m.to || ""),
      subject: String(m.subject || hilo.asunto || ""),
      date: String(m.date || ""),
      snippet: String(m.snippet || ""),
      fromMe: extractEmail(from).toLowerCase() === ME,
    };
  });
};

export const MailPanel: React.FC<Props> = ({
  hilo,
  isTestingMode = false,
  onClose,
  onActionDone,
  onRefetch,
}) => {
  const queryClient = useQueryClient();
  const [thread, setThread] = useState<GmailThread | null>(null);
  const [loading, setLoading] = useState(true);

  const [replyBody, setReplyBody] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [working, setWorking] = useState(false);
  const [hermesDraft, setHermesDraft] = useState<HermesDraft | null>(null);
  const [edited, setEdited] = useState(false);

  const fallback = useMemo(() => localMessages(hilo), [hilo]);

  const replyTo = useMemo(() => {
    if (hilo.email_institucion) return hilo.email_institucion;
    const ext = (hilo.participantes as string[] | undefined)?.find(
      (p) => extractEmail(String(p)).toLowerCase() !== ME
    );
    return ext ? extractEmail(String(ext)) : "";
  }, [hilo]);

  const syncEverywhere = () => {
    onRefetch?.();
    queryClient.invalidateQueries({ queryKey: ["gmailHilos"] });
  };

  // Carga: conversación (cuerpo completo on-demand) + borrador inteligente,
  // que se precarga directamente en el composer (sin botón intermedio).
  useEffect(() => {
    let alive = true;
    setLoading(true);
    setReplyBody("");
    setHermesDraft(null);
    setEdited(false);

    const loadDraft = async () => {
      if (isTestingMode) return;
      // 1. borrador ya generado por Hermes
      const d = await getDraftForThread(hilo.thread_id);
      if (!alive) return;
      if (d) {
        setHermesDraft(d);
        if (d.borrador && !d.requiereDecision) setReplyBody(d.borrador);
        return;
      }
      // 2. on-demand al webhook (si hay institución vinculada)
      if (hermesWebhookConfigured() && hilo.institucion_id) {
        setDraftLoading(true);
        try {
          const texto = await fetchHermesDraft({
            institucionId: hilo.institucion_id,
            institucion: hilo.asunto || "Institución",
            canal: "mail",
            estilo: "formal",
            accion: "contactar",
          });
          if (alive && texto) setReplyBody(texto);
        } finally {
          if (alive) setDraftLoading(false);
        }
      }
    };
    loadDraft();

    if (isTestingMode) {
      setThread({
        threadId: hilo.thread_id,
        asunto: hilo.asunto || "(sin asunto)",
        participantes: (hilo.participantes as string[]) || [],
        mensajes: fallback,
      });
      setLoading(false);
      return;
    }
    getThread(hilo.thread_id)
      .then((t) => alive && setThread(t.mensajes.length ? t : { ...t, mensajes: fallback }))
      .catch(
        () =>
          alive &&
          setThread({
            threadId: hilo.thread_id,
            asunto: hilo.asunto || "(sin asunto)",
            participantes: (hilo.participantes as string[]) || [],
            mensajes: fallback,
          })
      )
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [hilo, isTestingMode, fallback]);

  const messages = thread?.mensajes || fallback;

  const handleArchive = async () => {
    setWorking(true);
    const res = await modifyThread(hilo.thread_id, "archive");
    setWorking(false);
    if (res.success) {
      onActionDone?.(
        res.dryRun ? "Archivar (dry-run): no se aplicó en modo seguro." : "Hilo archivado."
      );
      syncEverywhere();
      onClose();
    } else {
      onActionDone?.(`No se pudo archivar: ${res.message || "error"}`);
    }
  };

  const handleSend = async () => {
    setWorking(true);
    const res = await sendReply({
      threadId: hilo.thread_id,
      to: replyTo,
      subject: hilo.asunto || "(sin asunto)",
      body: replyBody,
    });
    setWorking(false);
    setConfirmSend(false);
    if (res.success) {
      onActionDone?.(
        res.dryRun ? "Respuesta lista (dry-run): no se envió en modo seguro." : "Respuesta enviada."
      );
      // Cierre del ciclo de aprendizaje: Hermes compara su borrador con lo enviado
      // y aprende de tus correcciones para la próxima. Best-effort, no bloquea.
      if (hermesDraft?.suggestionId) {
        void learnFromDraftEdit({
          suggestionId: hermesDraft.suggestionId,
          borradorOriginal: hermesDraft.borrador || "",
          borradorFinal: replyBody,
          asunto: hilo.asunto || undefined,
        });
      }
      syncEverywhere();
      onClose();
    } else {
      onActionDone?.(`No se pudo enviar: ${res.message || "error"}`);
    }
  };

  const waiting = hilo.estado === "esperando_respuesta";
  const accent = waiting ? "var(--warn)" : "var(--accent)";
  const requiresDecision = hermesDraft?.requiereDecision;
  const hasDraft = !!replyBody.trim();

  // Etiqueta del estado del composer.
  const composerLabel = draftLoading
    ? "Hermes está redactando…"
    : requiresDecision
      ? "Hermes no decide esto"
      : hermesDraft?.borrador && !edited
        ? "Borrador de Hermes · editá y enviá"
        : hasDraft
          ? "Tu respuesta"
          : "Escribí tu respuesta";

  return (
    <aside
      className="gv3-ficha"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "calc(100vh - 60px)",
        overflow: "hidden",
      }}
    >
      {/* ── Header fijo ── */}
      <div
        style={{
          padding: "18px 22px 14px",
          borderBottom: "1px solid var(--rule-2)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <span
            style={{
              fontSize: 10.5,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            Correo institucional
          </span>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ink-3)",
              padding: 0,
              display: "inline-flex",
            }}
          >
            <span className="material-icons" style={{ fontSize: 20 }}>
              close
            </span>
          </button>
        </div>
        <h2
          className="serif"
          style={{ margin: "8px 0 0", fontSize: 19, lineHeight: 1.25, color: "var(--ink)" }}
        >
          {hilo.asunto || "(sin asunto)"}
        </h2>
        <div
          style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}
        >
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              color: accent,
              background: `color-mix(in oklab, ${accent} 13%, var(--paper))`,
              padding: "3px 9px",
              borderRadius: 999,
              letterSpacing: "0.02em",
            }}
          >
            {waiting ? "Esperando respuesta" : "Te deben respuesta"}
          </span>
          <span
            style={{
              fontSize: 12,
              color: "var(--ink-3)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {replyTo}
          </span>
        </div>
      </div>

      {/* ── Conversación scrolleable (el rectángulo que se recorre) ── */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "16px 22px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 24, fontSize: 12, color: "var(--ink-3)" }}>
            Cargando conversación…
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", padding: 24, fontSize: 12, color: "var(--ink-3)" }}>
            Sin mensajes para mostrar.
          </div>
        ) : (
          messages.map((m, i) => {
            const who = m.fromMe ? "Vos · Coordinación" : extractEmail(m.from) || "Contacto";
            return (
              <div key={m.id || i} style={{ display: "flex", gap: 10, marginBottom: 14 }}>
                {/* avatar */}
                <div
                  style={{
                    flexShrink: 0,
                    width: 30,
                    height: 30,
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: 700,
                    background: m.fromMe
                      ? "var(--ink)"
                      : `color-mix(in oklab, ${accent} 18%, var(--paper))`,
                    color: m.fromMe ? "var(--paper)" : accent,
                  }}
                >
                  {m.fromMe ? "ψ" : initialOf(m.from)}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 8,
                      marginBottom: 3,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)" }}>
                      {who}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        color: "var(--ink-4)",
                        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                      }}
                    >
                      {fmtDate(m.date)}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: "var(--ink-2)",
                      lineHeight: 1.55,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      padding: "10px 12px",
                      borderRadius: 12,
                      border: "1px solid var(--rule-2)",
                      background: m.fromMe ? "var(--paper-2)" : "var(--paper)",
                    }}
                  >
                    {m.body || m.snippet || "(sin contenido)"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Composer fijo abajo: borrador YA previsualizado ── */}
      <div
        style={{
          flexShrink: 0,
          borderTop: "1px solid var(--rule-2)",
          background: "var(--paper)",
          padding: "12px 18px 16px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 7 }}>
          <span
            className={`material-icons${draftLoading ? " animate-spin" : ""}`}
            style={{ fontSize: 15, color: requiresDecision ? "var(--warn)" : "var(--ai)" }}
          >
            {draftLoading ? "progress_activity" : requiresDecision ? "pan_tool" : "auto_awesome"}
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: requiresDecision ? "var(--warn)" : "var(--ai)",
            }}
          >
            {composerLabel}
          </span>
        </div>

        {requiresDecision ? (
          <div
            style={{
              fontSize: 12.5,
              color: "var(--ink-2)",
              lineHeight: 1.5,
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid color-mix(in oklab, var(--warn) 28%, var(--rule-2))",
              background: "color-mix(in oklab, var(--warn) 7%, var(--paper))",
              marginBottom: 10,
            }}
          >
            {hermesDraft?.motivo || "Este caso necesita tu criterio. Escribí la respuesta a mano."}
          </div>
        ) : null}

        <textarea
          value={replyBody}
          onChange={(e) => {
            setReplyBody(e.target.value);
            if (!edited) setEdited(true);
          }}
          placeholder={draftLoading ? "Cargando borrador de Hermes…" : "Escribí tu respuesta…"}
          rows={5}
          style={{
            width: "100%",
            resize: "none",
            padding: 11,
            borderRadius: 10,
            border: "1px solid var(--rule-2)",
            background: "var(--paper-2)",
            color: "var(--ink)",
            fontFamily: "inherit",
            fontSize: 13,
            lineHeight: 1.55,
            maxHeight: 180,
            overflowY: "auto",
          }}
        />

        <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10 }}>
          <button
            disabled={working || !hasDraft || !replyTo}
            onClick={() => setConfirmSend(true)}
            style={{
              flex: 1,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "10px 16px",
              borderRadius: 10,
              border: "none",
              background: "var(--ink)",
              color: "var(--paper)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: working || !hasDraft || !replyTo ? "default" : "pointer",
              opacity: working || !hasDraft || !replyTo ? 0.5 : 1,
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              send
            </span>
            Enviar respuesta
          </button>
          <button
            onClick={handleArchive}
            disabled={working}
            title="Archivar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid var(--rule-2)",
              background: "transparent",
              color: "var(--ink-2)",
              fontFamily: "inherit",
              fontSize: 13,
              fontWeight: 600,
              cursor: working ? "default" : "pointer",
            }}
          >
            <span className="material-icons" style={{ fontSize: 16 }}>
              archive
            </span>
          </button>
        </div>
      </div>

      {/* ── Confirmación de envío ── */}
      {confirmSend && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            background: "color-mix(in oklab, var(--ink, #14130F) 28%, transparent)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setConfirmSend(false);
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "var(--paper)",
              border: "1px solid var(--rule-3)",
              borderRadius: 16,
              padding: 22,
              color: "var(--ink)",
              boxShadow: "0 24px 64px -12px rgba(0,0,0,0.3)",
            }}
          >
            <h3 className="serif" style={{ margin: 0, fontSize: 19, fontWeight: 700 }}>
              Confirmar envío
            </h3>
            <p style={{ marginTop: 8, fontSize: 13, lineHeight: 1.5, color: "var(--ink-3)" }}>
              Vas a enviar esta respuesta a <b>{replyTo}</b> en «{hilo.asunto}».
            </p>
            <div
              style={{
                marginTop: 12,
                padding: 12,
                borderRadius: 10,
                background: "var(--paper-2)",
                border: "1px solid var(--rule-2)",
                fontSize: 13,
                color: "var(--ink-2)",
                maxHeight: 180,
                overflowY: "auto",
                whiteSpace: "pre-wrap",
                lineHeight: 1.55,
              }}
            >
              {replyBody}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button
                onClick={() => setConfirmSend(false)}
                disabled={working}
                style={{
                  padding: "8px 14px",
                  borderRadius: 9,
                  border: "1px solid var(--rule-2)",
                  background: "transparent",
                  color: "var(--ink-2)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSend}
                disabled={working}
                style={{
                  padding: "8px 16px",
                  borderRadius: 9,
                  border: "none",
                  background: "var(--ink)",
                  color: "var(--paper)",
                  fontFamily: "inherit",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  opacity: working ? 0.6 : 1,
                }}
              >
                {working ? "Enviando…" : "Confirmar y enviar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};

export default MailPanel;
