import {
  sanitizeMonitoringEvent,
  reportUnexpectedError,
  startErrorMonitoring,
} from "../errorMonitoring";

test("elimina datos personales, contenido del error y contexto de navegación", () => {
  const sanitized = sanitizeMonitoringEvent({
    type: undefined,
    event_id: "event-123",
    release: "commit-abc",
    environment: "production",
    message: "Error de alumno@example.com",
    user: { email: "alumno@example.com", id: "legajo-123" },
    request: { url: "https://panel.test/#/student?token=secret", cookies: { session: "secret" } },
    breadcrumbs: [{ message: "Inscripción de Alumno" }],
    extra: { formulario: { nombre: "Alumno", dni: "12345678" } },
    exception: {
      values: [
        {
          type: "Error con datos del alumno",
          value: "alumno@example.com token=secret",
          stacktrace: {
            frames: [
              {
                filename: "https://panel.test/assets/main-abc.js?token=secret#Alumno",
                lineno: 12,
                colno: 4,
                vars: { dni: "12345678" },
                function: "Alumno",
              },
              { filename: "https://panel.test/student/Alumno" },
            ],
          },
        },
      ],
    },
  });
  expect(sanitized.release).toBe("commit-abc");
  expect(sanitized.exception?.values?.[0].stacktrace?.frames).toEqual([
    { filename: "/assets/main-abc.js", lineno: 12, colno: 4 },
  ]);
  expect(JSON.stringify(sanitized)).not.toMatch(/alumno|secret|12345678|legajo|formulario/i);
  expect(sanitized.user).toBeUndefined();
  expect(sanitized.request).toBeUndefined();
  expect(sanitized.breadcrumbs).toBeUndefined();
});

test("sin configuración reportar o iniciar monitoreo no afecta a la aplicación", async () => {
  expect(() => reportUnexpectedError(new Error("fallo local"))).not.toThrow();
  await expect(startErrorMonitoring()).resolves.toBeUndefined();
});
