import { ThreadId } from "@t3tools/contracts";

export const MAX_SPLIT_PANES = 3;

export interface SplitViewRouteSearch {
  split?: string;
}

// Responsive pane capacity breakpoints (min-width)
export const PANE_CAPACITY_BREAKPOINTS = {
  triple: "(min-width: 1400px)",
  double: "(min-width: 900px)",
} as const;

/**
 * Returns the max number of visible panes for the given viewport width.
 * - < 900px  → 1 pane
 * - 900-1399 → 2 panes
 * - ≥ 1400px → 3 panes
 */
export function getMaxPaneCount(viewportWidth: number): number {
  if (viewportWidth >= 1400) return 3;
  if (viewportWidth >= 900) return 2;
  return 1;
}

export function parseSplitViewRouteSearch(
  search: Record<string, unknown>,
): SplitViewRouteSearch {
  const raw = search.split;
  if (typeof raw !== "string") return {};
  const trimmed = raw.trim();
  return trimmed.length > 0 ? { split: trimmed } : {};
}

export function stripSplitSearchParams<T extends Record<string, unknown>>(
  params: T,
): Omit<T, "split"> {
  const { split: _split, ...rest } = params;
  return rest as Omit<T, "split">;
}

/** Parse the `split` URL param into an array of ThreadIds. */
export function parseSplitPaneIds(split: string | undefined): ThreadId[] {
  if (!split) return [];
  return split
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => ThreadId.makeUnsafe(s));
}

/** Encode a ThreadId array back to the `split` URL param (undefined if empty). */
export function encodeSplitPaneIds(ids: ThreadId[]): string | undefined {
  if (ids.length === 0) return undefined;
  return ids.join(",");
}

/**
 * Build the ordered list of all active pane IDs from route state.
 * - Primary is always first.
 * - Deduplicates (primary wins).
 * - Clamps to maxPanes.
 */
export function buildPaneIds(
  primaryId: ThreadId,
  splitParam: string | undefined,
  maxPanes: number,
): ThreadId[] {
  const extras = parseSplitPaneIds(splitParam);
  const seen = new Set<string>([primaryId]);
  const unique: ThreadId[] = [];
  for (const id of extras) {
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(id);
    }
  }
  return [primaryId, ...unique].slice(0, maxPanes);
}

/**
 * Append a thread to the split view. Returns the new `split` param value
 * (undefined if the result has no additional panes beyond primary).
 * No-ops if the thread is already present.
 */
export function appendSplitPane(
  primaryId: ThreadId,
  splitParam: string | undefined,
  newId: ThreadId,
  maxPanes: number,
): string | undefined {
  const current = buildPaneIds(primaryId, splitParam, maxPanes);
  if (current.some((id) => id === newId)) {
    return encodeSplitPaneIds(current.slice(1));
  }
  const next = [...current, newId].slice(0, maxPanes);
  return encodeSplitPaneIds(next.slice(1));
}

/**
 * Remove a pane from split view.
 * - If removing a secondary pane, primary is unchanged.
 * - If removing the primary pane, promotes the first secondary to primary.
 */
export function removeSplitPane(
  primaryId: ThreadId,
  splitParam: string | undefined,
  removeId: ThreadId,
): { primaryId: ThreadId; splitParam: string | undefined } {
  const splitIds = parseSplitPaneIds(splitParam);

  if (removeId === primaryId) {
    const [newPrimary, ...rest] = splitIds;
    if (!newPrimary) {
      return { primaryId, splitParam: undefined };
    }
    return { primaryId: newPrimary, splitParam: encodeSplitPaneIds(rest) };
  }

  const next = splitIds.filter((id) => id !== removeId);
  return { primaryId, splitParam: encodeSplitPaneIds(next) };
}

/**
 * Promote a secondary pane to the primary position.
 * The current primary moves to the front of the secondary list.
 */
export function promoteSplitPane(
  primaryId: ThreadId,
  splitParam: string | undefined,
  promoteId: ThreadId,
): { primaryId: ThreadId; splitParam: string | undefined } {
  if (promoteId === primaryId) {
    return { primaryId, splitParam };
  }
  const splitIds = parseSplitPaneIds(splitParam);
  const others = [primaryId, ...splitIds].filter((id) => id !== promoteId);
  return {
    primaryId: promoteId,
    splitParam: encodeSplitPaneIds(others),
  };
}

export function reorderSplitPane(
  primaryId: ThreadId,
  splitParam: string | undefined,
  draggedId: ThreadId,
  targetId: ThreadId,
): { primaryId: ThreadId; splitParam: string | undefined } {
  if (draggedId === targetId) {
    return { primaryId, splitParam };
  }

  const paneIds = [primaryId, ...parseSplitPaneIds(splitParam)];
  const draggedIndex = paneIds.findIndex((id) => id === draggedId);
  const targetIndex = paneIds.findIndex((id) => id === targetId);
  if (draggedIndex < 0 || targetIndex < 0) {
    return { primaryId, splitParam };
  }

  const nextPaneIds = [...paneIds];
  const [draggedPaneId] = nextPaneIds.splice(draggedIndex, 1);
  if (!draggedPaneId) {
    return { primaryId, splitParam };
  }
  nextPaneIds.splice(targetIndex, 0, draggedPaneId);

  const [nextPrimaryId, ...nextSplitIds] = nextPaneIds;
  if (!nextPrimaryId) {
    return { primaryId, splitParam };
  }

  return {
    primaryId: nextPrimaryId,
    splitParam: encodeSplitPaneIds(nextSplitIds),
  };
}
