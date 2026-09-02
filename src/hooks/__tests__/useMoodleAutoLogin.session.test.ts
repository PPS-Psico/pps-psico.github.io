import { supabase } from "../../lib/supabaseClient";
import { hasValidatedSupabaseSession } from "../useMoodleAutoLogin";

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: jest.fn(),
      getUser: jest.fn(),
      signOut: jest.fn(),
    },
  },
}));

jest.mock("../../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;

describe("hasValidatedSupabaseSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("reutiliza una sesión confirmada por Auth", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "valid" } },
      error: null,
    } as Awaited<ReturnType<typeof auth.getSession>>);
    auth.getUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    } as Awaited<ReturnType<typeof auth.getUser>>);

    await expect(hasValidatedSupabaseSession()).resolves.toBe(true);
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("limpia localmente una sesión revocada para permitir el autologin de Campus", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { access_token: "revoked" } },
      error: null,
    } as Awaited<ReturnType<typeof auth.getSession>>);
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("Session from session_id claim in JWT does not exist"),
    } as Awaited<ReturnType<typeof auth.getUser>>);
    auth.signOut.mockResolvedValue({ error: null });

    await expect(hasValidatedSupabaseSession()).resolves.toBe(false);
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("continúa con el autologin cuando no hay sesión guardada", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    } as Awaited<ReturnType<typeof auth.getSession>>);

    await expect(hasValidatedSupabaseSession()).resolves.toBe(false);
    expect(auth.getUser).not.toHaveBeenCalled();
    expect(auth.signOut).not.toHaveBeenCalled();
  });
});
