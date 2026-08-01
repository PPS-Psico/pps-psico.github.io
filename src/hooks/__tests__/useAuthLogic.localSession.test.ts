import { supabase } from "../../lib/supabaseClient";
import { clearLocalSessionBeforeLogin } from "../useAuthLogic";

jest.mock("../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      signOut: jest.fn(),
    },
  },
}));

const AUTH_STORAGE_KEY = "sb-qxnxtnhtbpsgzprqtrjl-auth-token";

describe("clearLocalSessionBeforeLogin", () => {
  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it("descarta un refresh token local inválido sin bloquear el nuevo login", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "stale-session");
    jest.mocked(supabase.auth.signOut).mockRejectedValueOnce(new Error("Refresh Token Not Found"));

    await expect(clearLocalSessionBeforeLogin()).resolves.toBeUndefined();

    expect(supabase.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });

  it("limpia la copia local aunque Supabase devuelva el error en el resultado", async () => {
    localStorage.setItem(AUTH_STORAGE_KEY, "stale-session");
    jest.mocked(supabase.auth.signOut).mockResolvedValueOnce({
      error: new Error("Refresh Token Not Found"),
    } as Awaited<ReturnType<typeof supabase.auth.signOut>>);

    await clearLocalSessionBeforeLogin();

    expect(localStorage.getItem(AUTH_STORAGE_KEY)).toBeNull();
  });
});
