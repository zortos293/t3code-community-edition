import { describe, expect, it } from "vitest";

import { GIT_TEXT_GENERATION_PROVIDERS } from "./model.ts";

describe("GIT_TEXT_GENERATION_PROVIDERS", () => {
  it("includes current direct git text generation providers and excludes copilot", () => {
    expect(GIT_TEXT_GENERATION_PROVIDERS).toEqual(["codex", "claudeAgent", "opencode", "cursor"]);
  });
});
