import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  decideMoodleEvidence,
  fetchMoodleEvidenceInbox,
  type MoodleEvidenceCase,
} from "../../services/moodleEvidenceService";

function Decision({ item }: { item: MoodleEvidenceCase }) {
  const [practice, setPractice] = useState("");
  const [reason, setReason] = useState("");
  const [grade, setGrade] = useState("");
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (action: "allocate" | "revoke") =>
      decideMoodleEvidence(
        item,
        practice,
        action,
        reason.trim(),
        action === "allocate" && grade.trim() ? Number(grade.replace(",", ".")) : null
      ),
    onSuccess: async () => {
      setReason("");
      setGrade("");
      await queryClient.invalidateQueries({ queryKey: ["moodle-evidence-inbox"] });
    },
  });
  const latest = item.decisions.find((d) => d.practica_id === practice);
  const number = Number(grade.replace(",", "."));
  const valid =
    !!practice &&
    reason.trim().length >= 8 &&
    (!grade.trim() || (Number.isFinite(number) && number >= 0 && number <= 10));
  const field =
    "w-full rounded border border-slate-300 bg-white p-2 text-sm dark:border-slate-600 dark:bg-slate-900";
  return (
    <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
      <label className="block text-sm">
        PPS del estudiante
        <select
          className={field}
          value={practice}
          onChange={(e) => setPractice(e.target.value)}
          disabled={mutation.isPending}
        >
          <option value="">Elegir la PPS que corresponde</option>
          {item.practices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name || "Actividad directa"} · {p.area || "Sin orientación"} ·{" "}
              {p.start || "Sin fecha"}
              {p.exactLink ? " · Vínculo confirmado" : ""}
            </option>
          ))}
        </select>
      </label>
      {practice && (
        <>
          <p className="text-sm">
            Nota académica actual:{" "}
            {item.practices.find((p) => p.id === practice)?.grade || "Sin nota"}. La decisión queda
            en revisión y todavía no modifica esa nota.
          </p>
          {latest && (
            <p className="text-sm">
              Última decisión: {latest.action === "allocate" ? "Asociada" : "Revocada"}
              {latest.evidence_id !== item.evidenceId
                ? ". Hay evidencia posterior por revisar."
                : "."}
            </p>
          )}
          <label className="block text-sm">
            Nota propuesta para esta PPS (opcional, de 0 a 10)
            <input
              className={field}
              inputMode="decimal"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              maxLength={5}
              disabled={mutation.isPending}
            />
          </label>
          <label className="block text-sm">
            Fundamento de la decisión
            <textarea
              className={field}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={8}
              maxLength={2000}
              rows={2}
              disabled={mutation.isPending}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
              disabled={!valid || mutation.isPending}
              onClick={() => mutation.mutate("allocate")}
            >
              {mutation.isPending ? "Guardando…" : "Registrar asociación"}
            </button>
            {latest?.action === "allocate" && (
              <button
                type="button"
                className="px-3 py-2 text-sm underline disabled:opacity-40"
                disabled={!valid || mutation.isPending}
                onClick={() => mutation.mutate("revoke")}
              >
                Revocar asociación
              </button>
            )}
          </div>
        </>
      )}
      {mutation.isError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          No se guardó la decisión. Puede haber evidencia nueva; actualizá la bandeja y revisá el
          caso antes de reintentar.
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="text-sm">
          Decisión registrada en el historial.
        </p>
      )}
    </div>
  );
}

export default function MoodleEvidenceInbox({ enabled }: { enabled: boolean }) {
  const [offset, setOffset] = useState(0);
  const query = useQuery({
    queryKey: ["moodle-evidence-inbox", offset],
    queryFn: () => fetchMoodleEvidenceInbox(offset),
    enabled,
    staleTime: 30_000,
  });
  if (!enabled) return null;
  return (
    <section
      aria-label="Bandeja de evidencia de Campus"
      className="space-y-4 border-t border-slate-200 pt-5 text-slate-800 dark:border-slate-700 dark:text-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-semibold">Evidencia de Campus · revisión de asociaciones</h3>
        <button
          type="button"
          className="text-sm underline disabled:opacity-40"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Actualizando…" : "Actualizar"}
        </button>
      </div>
      <p className="max-w-3xl text-sm text-slate-600 dark:text-slate-300">
        Una tarea compartida puede contener varios informes: revisá el comentario docente y registrá
        una decisión por PPS. Durante la validación, las asociaciones y notas propuestas no cambian
        la acreditación.
      </p>
      {query.isLoading && <p role="status">Cargando evidencia…</p>}
      {query.isError && (
        <p role="alert">No pudimos cargar la bandeja. Usá Actualizar para reintentar.</p>
      )}
      {query.data && (
        <>
          <p className="text-sm">
            {query.data.total} casos conservados · {offset + (query.data.cases.length ? 1 : 0)}–
            {offset + query.data.cases.length}
          </p>
          {!query.data.cases.length && <p>No hay evidencia registrada en esta página.</p>}
          {query.data.cases.map((item) => (
            <details key={item.id} className="border-b border-slate-200 pb-3 dark:border-slate-700">
              <summary className="cursor-pointer py-2 text-sm">
                <strong>{item.studentName || "Identidad pendiente"}</strong> ·{" "}
                {item.taskName || `Tarea ${item.cmid}`} ·{" "}
                {item.content.gradeDisplay ||
                  (item.content.status === "submitted"
                    ? "Entregado"
                    : item.content.status === "not_submitted"
                      ? "Sin entrega en esta lectura"
                      : "Revisar lectura")}
              </summary>
              <div className="space-y-3 py-3">
                <p className="text-sm">
                  Leído el {new Date(item.observedAt).toLocaleString("es-AR")} · {item.versionCount}{" "}
                  versiones ·{" "}
                  <a
                    className="underline"
                    target="_blank"
                    rel="noreferrer"
                    href={`https://campus.uflo.edu.ar/mod/assign/view.php?id=${item.cmid}`}
                  >
                    Abrir tarea en Campus
                  </a>
                </p>
                <p className="whitespace-pre-wrap break-words text-sm">
                  {item.content.feedbackComment ||
                    "Sin comentario docente conservado en esta lectura."}
                </p>
                <details>
                  <summary className="cursor-pointer text-sm underline">
                    Últimas lecturas conservadas ({item.history.length} de {item.versionCount})
                  </summary>
                  <ol className="space-y-2 py-2 text-sm">
                    {item.history.map((version) => (
                      <li key={version.id}>
                        {new Date(version.observed_at).toLocaleString("es-AR")} · {version.source} ·{" "}
                        {version.content.gradeDisplay || version.content.status}
                        {version.legacy_practica_id && (
                          <span>
                            {" "}
                            · PPS original:{" "}
                            {item.practices.find((p) => p.id === version.legacy_practica_id)
                              ?.name || version.legacy_practica_id}
                          </span>
                        )}
                        <p className="whitespace-pre-wrap break-words">
                          {version.content.feedbackComment}
                        </p>
                      </li>
                    ))}
                  </ol>
                </details>
                {item.decisions.length > 0 && (
                  <details>
                    <summary className="cursor-pointer text-sm underline">
                      Historial de decisiones ({item.decisions.length})
                    </summary>
                    <ol className="space-y-2 py-2 text-sm">
                      {item.decisions.map((d) => (
                        <li key={d.id}>
                          {new Date(d.created_at).toLocaleString("es-AR")} ·{" "}
                          {d.action === "allocate" ? "Asociación" : "Revocación"} ·{" "}
                          {item.practices.find((p) => p.id === d.practica_id)?.name || "PPS"}
                          {d.grade !== null ? ` · Nota propuesta: ${d.grade}` : ""}
                          <p className="break-words">{d.reason}</p>
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
                {item.studentId ? (
                  <Decision item={item} />
                ) : (
                  <p className="text-sm">
                    Hay que verificar la identidad del estudiante antes de asociar esta evidencia.
                  </p>
                )}
              </div>
            </details>
          ))}
          <nav aria-label="Páginas de evidencia" className="flex gap-4">
            <button
              type="button"
              disabled={offset === 0 || query.isFetching}
              className="text-sm underline disabled:opacity-40"
              onClick={() => setOffset(Math.max(0, offset - 30))}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={offset + 30 >= query.data.total || query.isFetching}
              className="text-sm underline disabled:opacity-40"
              onClick={() => setOffset(offset + 30)}
            >
              Siguiente
            </button>
          </nav>
        </>
      )}
    </section>
  );
}
