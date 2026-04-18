import { describe, expect, it } from "vitest";

import {
  normalizeTextGenerationModelSelection,
  resolveTextGenerationProvider,
} from "./RoutingTextGeneration.ts";

describe("resolveTextGenerationProvider", () => {
  it("falls back unsupported providers to codex", () => {
    expect(resolveTextGenerationProvider(undefined)).toBe("codex");
    expect(resolveTextGenerationProvider("copilot")).toBe("codex");
  });

  it("preserves supported git text generation providers", () => {
    expect(resolveTextGenerationProvider("codex")).toBe("codex");
    expect(resolveTextGenerationProvider("claudeAgent")).toBe("claudeAgent");
    expect(resolveTextGenerationProvider("cursor")).toBe("cursor");
    expect(resolveTextGenerationProvider("opencode")).toBe("opencode");
  });
});

describe("normalizeTextGenerationModelSelection", () => {
  it("normalizes copilot model selections to a valid codex selection", () => {
    expect(
      normalizeTextGenerationModelSelection({
        provider: "copilot",
        model: "gpt-5",
        options: { reasoningEffort: "medium" },
      }),
    ).toEqual({
      provider: "codex",
      model: "gpt-5.4-mini",
      options: { reasoningEffort: "medium" },
    });
  });

  it("keeps supported providers on their own normalized provider path", () => {
    expect(
      normalizeTextGenerationModelSelection({
        provider: "claudeAgent",
        model: "claude-haiku-4.5",
      }),
    ).toEqual({
      provider: "claudeAgent",
      model: "claude-haiku-4-5",
    });
  });
});
