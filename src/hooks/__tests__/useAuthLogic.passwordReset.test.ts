import { getResetTokenFromUrl, removeResetTokenFromUrl } from "../useAuthLogic";

const TOKEN = "A".repeat(64);

describe("password reset URL handling", () => {
  afterEach(() => {
    window.history.replaceState(null, "", "/");
  });

  it("reads the exact token from the HashRouter login URL", () => {
    window.history.replaceState(null, "", `/#/login?reset_token=${TOKEN}`);

    expect(getResetTokenFromUrl()).toBe(TOKEN.toLowerCase());
  });

  it("removes the secret without discarding unrelated hash parameters", () => {
    window.history.replaceState(
      { preserved: true },
      "",
      `/?source=mail#/login?reset_token=${TOKEN}&campaign=recovery`
    );

    removeResetTokenFromUrl();

    expect(window.location.search).toBe("?source=mail");
    expect(window.location.hash).toBe("#/login?campaign=recovery");
    expect(window.location.href).not.toContain("reset_token");
    expect(window.history.state).toEqual({ preserved: true });
  });

  it("rejects malformed tokens instead of sanitizing them into a valid value", () => {
    window.history.replaceState(null, "", `/#/login?reset_token=${"a".repeat(63)}-`);

    expect(getResetTokenFromUrl()).toBeNull();
  });
});
