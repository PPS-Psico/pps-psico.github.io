const mockMaybeSingle = jest.fn();
const mockInvoke = jest.fn();

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({ maybeSingle: mockMaybeSingle })),
      })),
    })),
    functions: { invoke: mockInvoke },
  },
}));

import { DISAPPROVAL_CC, sendSmartEmail } from "../emailService";

describe("correos de desaprobación PPS", () => {
  beforeEach(() => {
    localStorage.clear();
    mockMaybeSingle.mockReset().mockResolvedValue({ data: null, error: null });
    mockInvoke.mockReset().mockResolvedValue({ data: { success: true }, error: null });
  });

  it("envía el aviso fijo por inasistencia con copia visible a Agostina", async () => {
    const result = await sendSmartEmail("desaprobacion_inasistencia", {
      studentName: "Ana Pérez",
      studentEmail: "ana@example.com",
      ppsName: "Hospital Escuela",
      institution: "Hospital Escuela",
      cc: DISAPPROVAL_CC,
    });

    expect(result.success).toBe(true);
    expect(mockInvoke).toHaveBeenCalledWith(
      "send-email",
      expect.objectContaining({
        body: expect.objectContaining({
          to: "ana@example.com",
          cc: DISAPPROVAL_CC,
          subject: "Notificación sobre el resultado de tu PPS – Hospital Escuela",
          html: expect.stringContaining("80% de asistencia requerido"),
        }),
      })
    );

    const payload = mockInvoke.mock.calls[0][1].body;
    expect(payload.html).toContain("futuras convocatorias de PPS");
    expect(payload.html).not.toContain("podés responder a este correo");
  });

  it("incorpora el informe editado al correo de desaprobación institucional", async () => {
    const editedReport = "La institución informó incumplimientos reiterados del encuadre acordado.";

    const result = await sendSmartEmail("desaprobacion_institucion", {
      studentName: "Ana Pérez",
      studentEmail: "ana@example.com",
      ppsName: "Hospital Escuela",
      institution: "Hospital Escuela",
      publicReason: editedReport,
      cc: DISAPPROVAL_CC,
    });

    expect(result.success).toBe(true);
    const payload = mockInvoke.mock.calls[0][1].body;
    expect(payload.cc).toBe(DISAPPROVAL_CC);
    expect(payload.html).toContain(editedReport);
    expect(payload.html).toContain("informe institucional");
  });
});
