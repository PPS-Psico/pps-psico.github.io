import { act, renderHook } from "@testing-library/react";
import {
  FIELD_ESTADO_GESTION_LANZAMIENTOS,
  FIELD_HISTORIAL_GESTION_LANZAMIENTOS,
  FIELD_NOTAS_GESTION_LANZAMIENTOS,
} from "../../../../constants";
import type { LanzamientoPPS } from "../../../../types";
import { useGestionInstitutionController } from "../useGestionInstitutionController";
import type { InstitutionVM } from "../gestionTypes";

const launch = {
  id: "launch-1",
  [FIELD_HISTORIAL_GESTION_LANZAMIENTOS]: null,
  [FIELD_NOTAS_GESTION_LANZAMIENTOS]: "Nota previa",
} as LanzamientoPPS;

const institution: InstitutionVM = {
  key: "institucion-demo",
  id: "institution-1",
  nombre: "Institución Demo",
  state: "porContactar",
  orientaciones: [],
  phone: "+5492991234567",
  referente: null,
  localidad: null,
  convenio: null,
  notas: null,
  historial: null,
  proximo: null,
  lastActivity: 0,
  lastActivityLabel: null,
  launches: [launch],
  flags: [],
  itemState: "porContactar",
};

describe("useGestionInstitutionController", () => {
  const setup = () => {
    const saveLaunch = jest.fn().mockResolvedValue(true);
    const updateInstitution = jest.fn().mockResolvedValue(true);
    const showToast = jest.fn();
    const institutionsByKey = new Map([[institution.key, institution]]);
    const hook = renderHook(() =>
      useGestionInstitutionController({
        institutionsByKey,
        saveLaunch,
        updateInstitution,
        showToast,
      })
    );
    return { ...hook, saveLaunch, updateInstitution, showToast };
  };

  it("records a real contact before moving the institution to waiting", async () => {
    const { result, saveLaunch, showToast } = setup();

    act(() => result.current.openContact(institution));
    expect(result.current.contactVm).toBe(institution);

    await act(async () => result.current.markWaiting(institution));

    expect(saveLaunch).toHaveBeenCalledWith(
      launch.id,
      expect.objectContaining({
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Esperando Respuesta",
        [FIELD_HISTORIAL_GESTION_LANZAMIENTOS]: expect.stringContaining(
          "Contactada · esperando respuesta"
        ),
      })
    );
    expect(result.current.contactVm).toBeNull();
    expect(showToast).toHaveBeenCalledWith("Marcada como “Esperando respuesta”", "schedule_send");
  });

  it("keeps state, notes and history in one atomic launch update", async () => {
    const { result, saveLaunch, showToast } = setup();

    act(() =>
      result.current.setPendingChange({
        vm: institution,
        newState: "confirmada",
      })
    );
    await act(async () => result.current.confirmChange("Aceptó continuar"));

    expect(saveLaunch).toHaveBeenCalledWith(
      launch.id,
      expect.objectContaining({
        [FIELD_ESTADO_GESTION_LANZAMIENTOS]: "Relanzamiento Confirmado",
        [FIELD_NOTAS_GESTION_LANZAMIENTOS]: expect.stringContaining("Aceptó continuar"),
        [FIELD_HISTORIAL_GESTION_LANZAMIENTOS]: expect.stringContaining(
          "Confirmada · Aceptó continuar"
        ),
      })
    );
    expect(result.current.pendingChange).toBeNull();
    expect(showToast).toHaveBeenCalledWith("Confirmada · cambio registrado", "flag");
  });
});
