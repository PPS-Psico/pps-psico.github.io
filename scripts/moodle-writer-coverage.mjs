/** Coverage is independent of queue readiness and administrative launch state. */
export function orientationKey(value) {
  const text = String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const keys = [
    ["clinica", /clinic/],
    ["educacional", /educ/],
    ["comunitaria", /comunit/],
    ["laboral", /labor|organiz/],
  ]
    .filter(([, pattern]) => pattern.test(text))
    .map(([key]) => key);
  return keys.length === 1 ? keys[0] : null;
}

// Stable pagination: never treat the API's first 1000 records as a full audit.
export async function readAll(queryFactory) {
  const rows = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await queryFactory()
      .order("id")
      .range(offset, offset + 499);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Lectura de cobertura incompleta");
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}

export function assessCoverage({ practices, launches, links, practiceLinks, catalog, intents }) {
  const launchById = new Map(launches.map((l) => [l.id, l]));
  const validTasks = new Set(
    catalog
      .filter((a) => a.activo && a.course_id === 3615 && /^\d+$/.test(String(a.moodle_id ?? "")))
      .map((a) => a.id)
  );
  const confirmed = (rows) =>
    rows.filter((l) => l.validation_status === "confirmed" && validTasks.has(l.aula_entrega_id));
  const validLinks = confirmed(links),
    validPracticeLinks = confirmed(practiceLinks);
  const groups = new Map();
  const summary = {
    scopedPractices: 0,
    linkedPractices: 0,
    uncoveredPractices: 0,
    excludedSpecial: 0,
    excludedWithdrawn: 0,
    historicalBefore2024: 0,
  };
  for (const p of practices) {
    if (p.tipo_actividad === "actividad_especial") {
      summary.excludedSpecial++;
      continue;
    }
    if (/^(cancelad[ao]|abandonad[ao]|desaprobad[ao])$/i.test(p.estado ?? "")) {
      summary.excludedWithdrawn++;
      continue;
    }
    const launch = launchById.get(p.lanzamiento_id);
    const year = Number(/^(\d{4})-/.exec(p.fecha_inicio || launch?.fecha_inicio || "")?.[1]);
    if (year && year < 2024) {
      summary.historicalBefore2024++;
      continue;
    }
    summary.scopedPractices++;
    const orientation = orientationKey(p.especialidad);
    const direct = validPracticeLinks.filter((l) => l.practica_id === p.id);
    const unit = validLinks.filter(
      (l) =>
        l.lanzamiento_id === p.lanzamiento_id && (!orientation || l.orientacion_key === orientation)
    );
    const candidates = direct.length ? direct : unit;
    if (candidates.length === 1) {
      summary.linkedPractices++;
      continue;
    }
    summary.uncoveredPractices++;
    const intent = intents.filter(
      (i) =>
        i.lanzamiento_id === p.lanzamiento_id &&
        i.provisioning_status !== "cancelled" &&
        (!orientation || i.orientacion_key === orientation)
    );
    const error =
      candidates.length > 1
        ? "AMBIGUOUS_TASK_LINK"
        : !p.lanzamiento_id
          ? "PRACTICE_WITHOUT_LAUNCH"
          : intent.length === 1
            ? "TASK_NOT_LINKED"
            : "PRACTICE_OUTSIDE_QUEUE";
    const key = `${p.lanzamiento_id || p.nombre_institucion}:${orientation}:${year || "undated"}:${error}`;
    if (!groups.has(key))
      groups.set(key, {
        launchId: p.lanzamiento_id,
        name: p.nombre_institucion || launch?.nombre_pps,
        orientation,
        year: year || null,
        policy: launch?.moodle_task_policy ?? null,
        status: "coverage_gap",
        error,
        practiceIds: [],
        intentId: intent.length === 1 ? intent[0].id : null,
        action:
          intent.length === 1 && intent[0].mode === "dedicated"
            ? "complete_writer_verification"
            : "review_historical_mapping",
      });
    groups.get(key).practiceIds.push(p.id);
  }
  return {
    summary,
    attention: [...groups.values()].map((g) => ({ ...g, practiceCount: g.practiceIds.length })),
  };
}

export async function practiceCoverage(client) {
  const definitions = {
    practices: [
      "practicas",
      "id,lanzamiento_id,nombre_institucion,especialidad,fecha_inicio,estado,tipo_actividad",
    ],
    launches: ["lanzamientos_pps", "id,nombre_pps,fecha_inicio,moodle_task_policy"],
    links: [
      "lanzamiento_moodle_tareas",
      "id,lanzamiento_id,orientacion_key,aula_entrega_id,validation_status",
    ],
    practiceLinks: ["practica_moodle_tareas", "id,practica_id,aula_entrega_id,validation_status"],
    catalog: ["aula_entregas", "id,activo,course_id,moodle_id"],
    intents: ["moodle_task_intents", "id,lanzamiento_id,orientacion_key,mode,provisioning_status"],
  };
  const entries = await Promise.all(
    Object.entries(definitions).map(async ([key, [table, columns]]) => [
      key,
      await readAll(() => client.from(table).select(columns)),
    ])
  );
  return assessCoverage(Object.fromEntries(entries));
}
