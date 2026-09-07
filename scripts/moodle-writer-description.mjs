const esc = (s) =>
  String(s ?? "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);

export function buildDescriptionHtml(row) {
  const periodo = [row.fecha_inicio, row.fecha_finalizacion]
    .filter(Boolean)
    .map((d) =>
      new Date(d + "T12:00:00Z").toLocaleDateString("es-AR", { day: "numeric", month: "short" })
    )
    .join(" — ");
  return [
    '<div style="border:1px solid #DCE3EC;border-radius:6px;overflow:hidden;font-family:Arial,Helvetica,sans-serif">',
    '<div style="background:#203B73;color:#ffffff;padding:14px 18px">',
    `<div style="font-size:12px;letter-spacing:.1em;opacity:.85">PPS · ${esc(row.orientacion_key).toUpperCase()}</div>`,
    `<div style="font-size:19px;font-weight:700">${esc(row.nombre_pps)}</div></div>`,
    '<table style="width:100%;border-collapse:collapse;font-size:14px">',
    `<tr><td style="padding:9px 18px;color:#4E5766;width:150px">Período</td><td style="padding:9px 18px">${esc(periodo)} (estimado)</td></tr>`,
    `<tr><td style="padding:9px 18px;color:#4E5766">Horas</td><td style="padding:9px 18px">${esc(row.horas_acreditadas ?? "—")} h</td></tr>`,
    "</table>",
    '<div style="padding:14px 18px;background:#F7E7DE;font-size:13px">',
    "La fecha de cierre de la PPS es estimada. Tenés 30 días corridos desde que termina para subir el informe.",
    "</div></div>",
  ].join("");
}
