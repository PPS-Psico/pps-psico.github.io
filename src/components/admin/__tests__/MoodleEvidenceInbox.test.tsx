import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import MoodleEvidenceInbox from "../MoodleEvidenceInbox";
import {
  decideMoodleEvidence,
  fetchMoodleEvidenceInbox,
} from "../../../services/moodleEvidenceService";

jest.mock("../../../services/moodleEvidenceService", () => ({
  decideMoodleEvidence: jest.fn(),
  fetchMoodleEvidenceInbox: jest.fn(),
}));
const item = {
  id: "case-a",
  revision: 2,
  cmid: 55,
  studentId: "student",
  studentName: "Estudiante de prueba",
  taskName: "Tarea compartida",
  evidenceId: "version-a",
  observedAt: "2026-09-05T12:00:00Z",
  source: "jefe",
  versionCount: 1,
  history: [],
  content: { status: "graded", gradeDisplay: "80/100", feedbackComment: "PPS A: 7; PPS B: 9" },
  decisions: [],
  practices: [
    {
      id: "pps-a",
      name: "PPS A",
      area: "Clínica",
      grade: "6",
      start: "2025",
      state: "Finalizada",
      exactLink: true,
    },
    {
      id: "pps-b",
      name: "PPS B",
      area: "Clínica",
      grade: null,
      start: "2026",
      state: "En curso",
      exactLink: true,
    },
  ],
};
function mount() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MoodleEvidenceInbox enabled />
    </QueryClientProvider>
  );
}
beforeEach(() => {
  jest.clearAllMocks();
  jest
    .mocked(fetchMoodleEvidenceInbox)
    .mockResolvedValue({ total: 1, mode: "shadow", cases: [item] });
});

it("registra una nota por PPS y no copia la nota global automáticamente", async () => {
  jest.mocked(decideMoodleEvidence).mockResolvedValue(undefined);
  mount();
  await screen.findByText("Estudiante de prueba");
  fireEvent.click(screen.getByText("Estudiante de prueba"));
  fireEvent.change(screen.getByLabelText("PPS del estudiante"), { target: { value: "pps-a" } });
  expect(screen.getByLabelText(/Nota propuesta/)).toHaveValue("");
  expect(screen.getByRole("button", { name: "Registrar asociación" })).toBeDisabled();
  fireEvent.change(screen.getByLabelText(/Nota propuesta/), { target: { value: "7" } });
  fireEvent.change(screen.getByLabelText("Fundamento de la decisión"), {
    target: { value: "Revisado el comentario para PPS A" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar asociación" }));
  await waitFor(() =>
    expect(decideMoodleEvidence).toHaveBeenCalledWith(
      item,
      "pps-a",
      "allocate",
      "Revisado el comentario para PPS A",
      7
    )
  );
});

it("un conflicto de versión se muestra sin anunciar éxito", async () => {
  jest.mocked(decideMoodleEvidence).mockRejectedValue(new Error("40001"));
  mount();
  await screen.findByText("Estudiante de prueba");
  fireEvent.click(screen.getByText("Estudiante de prueba"));
  fireEvent.change(screen.getByLabelText("PPS del estudiante"), { target: { value: "pps-b" } });
  fireEvent.change(screen.getByLabelText("Fundamento de la decisión"), {
    target: { value: "Revisado el comentario para PPS B" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Registrar asociación" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("No se guardó la decisión");
  expect(screen.queryByText("Decisión registrada en el historial.")).not.toBeInTheDocument();
});
