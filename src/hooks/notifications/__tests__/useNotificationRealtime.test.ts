import { act, renderHook } from "@testing-library/react";
import {
  FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS,
  FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS,
  FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS,
  TABLE_NAME_CONVOCATORIAS,
  TABLE_NAME_LANZAMIENTOS_PPS,
  TABLE_NAME_PPS,
} from "../../../constants";
import { supabase } from "../../../lib/supabaseClient";
import { useNotificationRealtime } from "../useNotificationRealtime";

jest.mock("../../../lib/supabaseClient", () => ({
  supabase: {
    channel: jest.fn(),
    removeChannel: jest.fn(),
  },
}));

interface Subscription {
  filter: { event: string; schema: string; table: string };
  callback: (payload: Record<string, unknown>) => void;
}

interface MockChannel {
  on: jest.Mock;
  subscribe: jest.Mock;
}

const channelMock = supabase.channel as unknown as jest.Mock;
const removeChannelMock = supabase.removeChannel as unknown as jest.Mock;

describe("useNotificationRealtime", () => {
  const subscriptions: Subscription[] = [];
  const channel: MockChannel = {
    on: jest.fn(
      (
        _kind: string,
        filter: Subscription["filter"],
        callback: Subscription["callback"]
      ): MockChannel => {
        subscriptions.push({ filter, callback });
        return channel;
      }
    ),
    subscribe: jest.fn((): MockChannel => channel),
  };

  beforeEach(() => {
    subscriptions.length = 0;
    jest.clearAllMocks();
    channelMock.mockReturnValue(channel);
  });

  it("registers the full channel and disposes it with the provider", () => {
    const onNotification = jest.fn();
    const { unmount } = renderHook(() =>
      useNotificationRealtime({
        userId: "admin-1",
        isAdmin: true,
        isStudent: false,
        onNotification,
      })
    );

    expect(channelMock).toHaveBeenCalledWith("notifications-admin-1");
    expect(subscriptions).toHaveLength(6);
    expect(channel.subscribe).toHaveBeenCalledTimes(1);

    const ppsInsert = subscriptions.find(({ filter }) => filter.table === TABLE_NAME_PPS);
    act(() => ppsInsert?.callback({ new: { id: "request-1" }, eventType: "INSERT" }));

    expect(onNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "pps-request-1",
        type: "solicitud_pps",
        link: "/admin/solicitudes?tab=ingreso",
      })
    );

    unmount();
    expect(removeChannelMock).toHaveBeenCalledWith(channel);
  });

  it("emits only student events that belong to the authenticated user", () => {
    const onNotification = jest.fn();
    renderHook(() =>
      useNotificationRealtime({
        userId: "student-1",
        isAdmin: false,
        isStudent: true,
        onNotification,
      })
    );

    const launchChange = subscriptions.find(
      ({ filter }) => filter.table === TABLE_NAME_LANZAMIENTOS_PPS
    );
    const enrollmentChange = subscriptions.find(
      ({ filter }) => filter.table === TABLE_NAME_CONVOCATORIAS
    );

    act(() =>
      launchChange?.callback({
        eventType: "INSERT",
        new: {
          id: "launch-1",
          [FIELD_ESTADO_CONVOCATORIA_LANZAMIENTOS]: "Abierta",
          nombre_pps: "Clínica",
        },
        old: {},
      })
    );
    act(() =>
      enrollmentChange?.callback({
        eventType: "UPDATE",
        new: {
          id: "enrollment-other",
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: "student-2",
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
        },
        old: { [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto" },
      })
    );
    act(() =>
      enrollmentChange?.callback({
        eventType: "UPDATE",
        new: {
          id: "enrollment-1",
          [FIELD_ESTUDIANTE_INSCRIPTO_CONVOCATORIAS]: "student-1",
          [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Seleccionado",
        },
        old: { [FIELD_ESTADO_INSCRIPCION_CONVOCATORIAS]: "Inscripto" },
      })
    );

    expect(onNotification).toHaveBeenCalledTimes(2);
    expect(onNotification).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "estado",
        message: "¡Felicitaciones! Has sido Seleccionado para la PPS.",
      })
    );
  });
});
