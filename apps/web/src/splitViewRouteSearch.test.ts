import { ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vitest";

import {
  appendSplitPane,
  buildPaneIds,
  encodeSplitPaneIds,
  getMaxPaneCount,
  parseSplitPaneIds,
  parseSplitViewRouteSearch,
  promoteSplitPane,
  reorderSplitPane,
  removeSplitPane,
  stripSplitSearchParams,
} from "./splitViewRouteSearch";

const id = (s: string) => ThreadId.makeUnsafe(s);

describe("parseSplitViewRouteSearch", () => {
  it("returns empty for missing split param", () => {
    expect(parseSplitViewRouteSearch({})).toEqual({});
  });

  it("returns empty for non-string split param", () => {
    expect(parseSplitViewRouteSearch({ split: 123 })).toEqual({});
    expect(parseSplitViewRouteSearch({ split: null })).toEqual({});
  });

  it("returns empty for whitespace-only split param", () => {
    expect(parseSplitViewRouteSearch({ split: "   " })).toEqual({});
  });

  it("returns split for valid string", () => {
    expect(parseSplitViewRouteSearch({ split: "thread-a,thread-b" })).toEqual({
      split: "thread-a,thread-b",
    });
  });
});

describe("stripSplitSearchParams", () => {
  it("removes split while preserving other params", () => {
    const result = stripSplitSearchParams({ split: "x", diff: "1", other: "y" });
    expect(result).toEqual({ diff: "1", other: "y" });
    expect("split" in result).toBe(false);
  });
});

describe("parseSplitPaneIds", () => {
  it("returns empty array for undefined", () => {
    expect(parseSplitPaneIds(undefined)).toEqual([]);
  });

  it("parses comma-separated IDs", () => {
    expect(parseSplitPaneIds("a,b,c")).toEqual([id("a"), id("b"), id("c")]);
  });

  it("trims whitespace around IDs", () => {
    expect(parseSplitPaneIds(" a , b ")).toEqual([id("a"), id("b")]);
  });

  it("filters empty segments", () => {
    expect(parseSplitPaneIds(",a,,b,")).toEqual([id("a"), id("b")]);
  });
});

describe("encodeSplitPaneIds", () => {
  it("returns undefined for empty array", () => {
    expect(encodeSplitPaneIds([])).toBeUndefined();
  });

  it("joins IDs with commas", () => {
    expect(encodeSplitPaneIds([id("a"), id("b")])).toBe("a,b");
  });
});

describe("getMaxPaneCount", () => {
  it("returns 1 for narrow viewports", () => {
    expect(getMaxPaneCount(0)).toBe(1);
    expect(getMaxPaneCount(500)).toBe(1);
    expect(getMaxPaneCount(899)).toBe(1);
  });

  it("returns 2 for medium viewports", () => {
    expect(getMaxPaneCount(900)).toBe(2);
    expect(getMaxPaneCount(1000)).toBe(2);
    expect(getMaxPaneCount(1399)).toBe(2);
  });

  it("returns 3 for wide viewports", () => {
    expect(getMaxPaneCount(1400)).toBe(3);
    expect(getMaxPaneCount(2560)).toBe(3);
  });
});

describe("buildPaneIds", () => {
  it("returns only primary when no split param", () => {
    expect(buildPaneIds(id("a"), undefined, 3)).toEqual([id("a")]);
  });

  it("appends split IDs after primary", () => {
    expect(buildPaneIds(id("a"), "b,c", 3)).toEqual([id("a"), id("b"), id("c")]);
  });

  it("deduplicates: primary takes precedence", () => {
    expect(buildPaneIds(id("a"), "b,a,c", 3)).toEqual([id("a"), id("b"), id("c")]);
  });

  it("deduplicates: split IDs deduplicated among themselves", () => {
    expect(buildPaneIds(id("a"), "b,b,c", 3)).toEqual([id("a"), id("b"), id("c")]);
  });

  it("clamps to maxPanes", () => {
    expect(buildPaneIds(id("a"), "b,c,d", 2)).toEqual([id("a"), id("b")]);
    expect(buildPaneIds(id("a"), "b,c,d", 1)).toEqual([id("a")]);
  });
});

describe("appendSplitPane", () => {
  it("appends a new ID to split view", () => {
    expect(appendSplitPane(id("a"), undefined, id("b"), 3)).toBe("b");
  });

  it("appends to existing split", () => {
    expect(appendSplitPane(id("a"), "b", id("c"), 3)).toBe("b,c");
  });

  it("no-ops if ID is already present (primary)", () => {
    expect(appendSplitPane(id("a"), "b", id("a"), 3)).toBe("b");
  });

  it("no-ops if ID is already present (secondary)", () => {
    expect(appendSplitPane(id("a"), "b,c", id("b"), 3)).toBe("b,c");
  });

  it("respects max panes limit", () => {
    expect(appendSplitPane(id("a"), "b,c", id("d"), 3)).toBe("b,c");
  });

  it("returns undefined when result has no secondaries", () => {
    // primary is already in list, nothing extra
    expect(appendSplitPane(id("a"), undefined, id("a"), 3)).toBeUndefined();
  });
});

describe("removeSplitPane", () => {
  it("removes a secondary pane, keeps primary", () => {
    expect(removeSplitPane(id("a"), "b,c", id("b"))).toEqual({
      primaryId: id("a"),
      splitParam: "c",
    });
  });

  it("removes last secondary, returns undefined split", () => {
    expect(removeSplitPane(id("a"), "b", id("b"))).toEqual({
      primaryId: id("a"),
      splitParam: undefined,
    });
  });

  it("removing primary promotes first secondary", () => {
    expect(removeSplitPane(id("a"), "b,c", id("a"))).toEqual({
      primaryId: id("b"),
      splitParam: "c",
    });
  });

  it("removing primary with single secondary collapses to single pane", () => {
    expect(removeSplitPane(id("a"), "b", id("a"))).toEqual({
      primaryId: id("b"),
      splitParam: undefined,
    });
  });

  it("removing only pane (primary, no split) is a no-op", () => {
    expect(removeSplitPane(id("a"), undefined, id("a"))).toEqual({
      primaryId: id("a"),
      splitParam: undefined,
    });
  });
});

describe("promoteSplitPane", () => {
  it("no-op when promoting current primary", () => {
    expect(promoteSplitPane(id("a"), "b,c", id("a"))).toEqual({
      primaryId: id("a"),
      splitParam: "b,c",
    });
  });

  it("promotes secondary to primary, old primary becomes first secondary", () => {
    expect(promoteSplitPane(id("a"), "b,c", id("b"))).toEqual({
      primaryId: id("b"),
      splitParam: "a,c",
    });
  });

  it("promotes last secondary", () => {
    expect(promoteSplitPane(id("a"), "b,c", id("c"))).toEqual({
      primaryId: id("c"),
      splitParam: "a,b",
    });
  });
});

describe("reorderSplitPane", () => {
  it("moves a pane onto another pane slot", () => {
    expect(reorderSplitPane(id("a"), "b,c", id("b"), id("c"))).toEqual({
      primaryId: id("a"),
      splitParam: "c,b",
    });
  });

  it("can move a secondary pane into the primary slot", () => {
    expect(reorderSplitPane(id("a"), "b,c", id("c"), id("a"))).toEqual({
      primaryId: id("c"),
      splitParam: "a,b",
    });
  });

  it("keeps state unchanged for no-op reorder inputs", () => {
    expect(reorderSplitPane(id("a"), "b,c", id("b"), id("b"))).toEqual({
      primaryId: id("a"),
      splitParam: "b,c",
    });
    expect(reorderSplitPane(id("a"), "b,c", id("missing"), id("b"))).toEqual({
      primaryId: id("a"),
      splitParam: "b,c",
    });
  });
});
