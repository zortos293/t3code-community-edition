import { describe, expect, it } from "vitest";
import { resolveProviderHealthBannerProvider } from "./ChatView.logic";

describe("resolveProviderHealthBannerProvider", () => {
  it("uses the active session provider when a session exists", () => {
    expect(
      resolveProviderHealthBannerProvider({
        sessionProvider: "codex",
        selectedProvider: "copilot",
      }),
    ).toBe("codex");
  });

  it("uses selected draft provider before session starts", () => {
    expect(
      resolveProviderHealthBannerProvider({
        sessionProvider: null,
        selectedProvider: "copilot",
      }),
    ).toBe("copilot");
  });
});
