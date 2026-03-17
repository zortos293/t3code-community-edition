import { EventId, ThreadId, TurnId, type OrchestrationThreadActivity } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  buildExpiredTerminalContextToastCopy,
  deriveComposerSendState,
  deriveVisibleThreadWorkLogEntries,
  orderCopilotBuiltInModelOptions,
  resolveProviderHealthBannerProvider,
} from "./ChatView.logic";

function makeActivity(overrides: {
  id?: string;
  createdAt?: string;
  kind?: string;
  summary?: string;
  tone?: OrchestrationThreadActivity["tone"];
  payload?: Record<string, unknown>;
  turnId?: string;
  sequence?: number;
}): OrchestrationThreadActivity {
  return {
    id: EventId.makeUnsafe(overrides.id ?? crypto.randomUUID()),
    createdAt: overrides.createdAt ?? "2026-02-23T00:00:00.000Z",
    kind: overrides.kind ?? "tool.started",
    summary: overrides.summary ?? "Tool call",
    tone: overrides.tone ?? "tool",
    payload: overrides.payload ?? {},
    turnId: overrides.turnId ? TurnId.makeUnsafe(overrides.turnId) : null,
    ...(overrides.sequence !== undefined ? { sequence: overrides.sequence } : {}),
  };
}

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

describe("orderCopilotBuiltInModelOptions", () => {
  it("reorders runtime copilot models to match the preferred built-in picker order", () => {
    expect(
      orderCopilotBuiltInModelOptions([
        { slug: "gpt-5.4", name: "GPT-5.4" },
        { slug: "gpt-5.3-codex", name: "GPT-5.3 Codex" },
        { slug: "gpt-5.4-mini", name: "GPT-5.4 mini" },
        { slug: "gpt-5.2", name: "GPT-5.2" },
      ]).map((option) => option.slug),
    ).toEqual(["gpt-5.4", "gpt-5.4-mini", "gpt-5.3-codex", "gpt-5.2"]);
  });

  it("keeps unknown runtime-only models after the preferred built-in models", () => {
    expect(
      orderCopilotBuiltInModelOptions([
        { slug: "gpt-5.4", name: "GPT-5.4" },
        { slug: "future-runtime-model", name: "Future Runtime Model" },
        { slug: "gpt-5.4-mini", name: "GPT-5.4 mini" },
      ]).map((option) => option.slug),
    ).toEqual(["gpt-5.4", "gpt-5.4-mini", "future-runtime-model"]);
  });
});

describe("deriveVisibleThreadWorkLogEntries", () => {
  it("keeps completed tool calls from previous turns visible in the thread timeline", () => {
    const activities: OrchestrationThreadActivity[] = [
      makeActivity({
        id: "tool-1",
        createdAt: "2026-02-23T00:00:01.000Z",
        turnId: "turn-1",
        kind: "tool.completed",
        summary: "First tool call",
      }),
      makeActivity({
        id: "tool-2",
        createdAt: "2026-02-23T00:00:03.000Z",
        turnId: "turn-2",
        kind: "tool.completed",
        summary: "Second tool call",
      }),
    ];

    expect(deriveVisibleThreadWorkLogEntries(activities).map((entry) => entry.id)).toEqual([
      "tool-1",
      "tool-2",
    ]);
  });
});

describe("deriveComposerSendState", () => {
  it("treats expired terminal pills as non-sendable content", () => {
    const state = deriveComposerSendState({
      prompt: "\uFFFC",
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("");
    expect(state.sendableTerminalContexts).toEqual([]);
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(false);
  });

  it("keeps text sendable while excluding expired terminal pills", () => {
    const state = deriveComposerSendState({
      prompt: `yoo \uFFFC waddup`,
      imageCount: 0,
      terminalContexts: [
        {
          id: "ctx-expired",
          threadId: ThreadId.makeUnsafe("thread-1"),
          terminalId: "default",
          terminalLabel: "Terminal 1",
          lineStart: 4,
          lineEnd: 4,
          text: "",
          createdAt: "2026-03-17T12:52:29.000Z",
        },
      ],
    });

    expect(state.trimmedPrompt).toBe("yoo  waddup");
    expect(state.expiredTerminalContextCount).toBe(1);
    expect(state.hasSendableContent).toBe(true);
  });
});

describe("buildExpiredTerminalContextToastCopy", () => {
  it("formats clear empty-state guidance", () => {
    expect(buildExpiredTerminalContextToastCopy(1, "empty")).toEqual({
      title: "Expired terminal context won't be sent",
      description: "Remove it or re-add it to include terminal output.",
    });
  });

  it("formats omission guidance for sent messages", () => {
    expect(buildExpiredTerminalContextToastCopy(2, "omitted")).toEqual({
      title: "Expired terminal contexts omitted from message",
      description: "Re-add it if you want that terminal output included.",
    });
  });
});
