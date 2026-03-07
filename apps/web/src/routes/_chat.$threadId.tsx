import { ThreadId } from "@t3tools/contracts";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, type ReactNode, useCallback, useEffect, useMemo } from "react";

import ChatView from "../components/ChatView";
import ChatSplitView from "../components/ChatSplitView";
import { useComposerDraftStore } from "../composerDraftStore";
import { parseDiffRouteSearch, stripDiffSearchParams } from "../diffRouteSearch";
import { useMediaQuery } from "../hooks/useMediaQuery";
import {
  MAX_SPLIT_PANES,
  PANE_CAPACITY_BREAKPOINTS,
  buildPaneIds,
  parseSplitViewRouteSearch,
  promoteSplitPane,
  reorderSplitPane,
  removeSplitPane,
  stripSplitSearchParams,
} from "../splitViewRouteSearch";
import { useStore } from "../store";
import { Sheet, SheetPopup } from "../components/ui/sheet";
import { Sidebar, SidebarInset, SidebarProvider, SidebarRail } from "~/components/ui/sidebar";

const DiffPanel = lazy(() => import("../components/DiffPanel"));
const DIFF_INLINE_LAYOUT_MEDIA_QUERY = "(max-width: 1180px)";
const DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY = "chat_diff_sidebar_width";
const DIFF_INLINE_DEFAULT_WIDTH = "clamp(28rem,48vw,44rem)";
const DIFF_INLINE_SIDEBAR_MIN_WIDTH = 26 * 16;

const DiffPanelSheet = (props: {
  children: ReactNode;
  diffOpen: boolean;
  onCloseDiff: () => void;
}) => {
  return (
    <Sheet
      open={props.diffOpen}
      onOpenChange={(open) => {
        if (!open) {
          props.onCloseDiff();
        }
      }}
    >
      <SheetPopup
        side="right"
        showCloseButton={false}
        keepMounted
        className="w-[min(88vw,820px)] max-w-[820px] p-0"
      >
        {props.children}
      </SheetPopup>
    </Sheet>
  );
};

const DiffLoadingFallback = (props: { inline: boolean }) => {
  if (props.inline) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-4 text-center text-xs text-muted-foreground/70">
        Loading diff viewer...
      </div>
    );
  }

  return (
    <aside className="flex h-full w-[560px] shrink-0 items-center justify-center border-l border-border bg-card px-4 text-center text-xs text-muted-foreground/70">
      Loading diff viewer...
    </aside>
  );
};

const DiffPanelInlineSidebar = (props: {
  diffOpen: boolean;
  onCloseDiff: () => void;
  onOpenDiff: () => void;
}) => {
  const { diffOpen, onCloseDiff, onOpenDiff } = props;
  const onOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpenDiff();
        return;
      }
      onCloseDiff();
    },
    [onCloseDiff, onOpenDiff],
  );
  const shouldAcceptInlineSidebarWidth = useCallback(
    ({ nextWidth, wrapper }: { nextWidth: number; wrapper: HTMLElement }) => {
      const composerForm = document.querySelector<HTMLElement>("[data-chat-composer-form='true']");
      if (!composerForm) return true;
      const composerViewport = composerForm.parentElement;
      if (!composerViewport) return true;
      const previousSidebarWidth = wrapper.style.getPropertyValue("--sidebar-width");
      wrapper.style.setProperty("--sidebar-width", `${nextWidth}px`);

      const viewportStyle = window.getComputedStyle(composerViewport);
      const viewportPaddingLeft = Number.parseFloat(viewportStyle.paddingLeft) || 0;
      const viewportPaddingRight = Number.parseFloat(viewportStyle.paddingRight) || 0;
      const viewportContentWidth = Math.max(
        0,
        composerViewport.clientWidth - viewportPaddingLeft - viewportPaddingRight,
      );
      const formRect = composerForm.getBoundingClientRect();
      const hasComposerOverflow = composerForm.scrollWidth > composerForm.clientWidth + 0.5;
      const overflowsViewport = formRect.width > viewportContentWidth + 0.5;

      if (previousSidebarWidth.length > 0) {
        wrapper.style.setProperty("--sidebar-width", previousSidebarWidth);
      } else {
        wrapper.style.removeProperty("--sidebar-width");
      }

      return !hasComposerOverflow && !overflowsViewport;
    },
    [],
  );

  return (
    <SidebarProvider
      defaultOpen={false}
      open={diffOpen}
      onOpenChange={onOpenChange}
      className="w-auto min-h-0 flex-none bg-transparent"
      style={{ "--sidebar-width": DIFF_INLINE_DEFAULT_WIDTH } as React.CSSProperties}
    >
      <Sidebar
        side="right"
        collapsible="offcanvas"
        className="border-l border-border bg-card text-foreground"
        resizable={{
          minWidth: DIFF_INLINE_SIDEBAR_MIN_WIDTH,
          shouldAcceptWidth: shouldAcceptInlineSidebarWidth,
          storageKey: DIFF_INLINE_SIDEBAR_WIDTH_STORAGE_KEY,
        }}
      >
        <Suspense fallback={<DiffLoadingFallback inline />}>
          <DiffPanel mode="sidebar" />
        </Suspense>
        <SidebarRail />
      </Sidebar>
    </SidebarProvider>
  );
};

function ChatThreadRouteView() {
  const threadsHydrated = useStore((store) => store.threadsHydrated);
  const threads = useStore((store) => store.threads);
  const navigate = useNavigate();
  const threadId = Route.useParams({
    select: (params) => ThreadId.makeUnsafe(params.threadId),
  });
  const search = Route.useSearch();
  const draftThreadsByThreadId = useComposerDraftStore((store) => store.draftThreadsByThreadId);
  const threadExists = useMemo(
    () => threads.some((thread) => thread.id === threadId),
    [threadId, threads],
  );
  const draftThreadExists = useMemo(
    () => Object.hasOwn(draftThreadsByThreadId, threadId),
    [draftThreadsByThreadId, threadId],
  );
  const routeThreadExists = threadExists || draftThreadExists;
  const diffOpen = search.diff === "1";

  // Responsive pane capacity
  const isDoubleCapacity = useMediaQuery(PANE_CAPACITY_BREAKPOINTS.double);
  const isTripleCapacity = useMediaQuery(PANE_CAPACITY_BREAKPOINTS.triple);
  const maxPanes = isTripleCapacity ? 3 : isDoubleCapacity ? 2 : 1;

  // Resolve effective pane IDs: validate split IDs against known threads/drafts
  const validIds = useMemo(
    () => new Set([...threads.map((thread) => thread.id), ...Object.keys(draftThreadsByThreadId)]),
    [draftThreadsByThreadId, threads],
  );
  const rawPaneIds = buildPaneIds(threadId, search.split, MAX_SPLIT_PANES);
  const paneIds = rawPaneIds.filter(
    (id, index) => index === 0 || validIds.has(id),
  ).slice(0, maxPanes);

  const isSplitActive = paneIds.length > 1;

  // When split view is active, always use sheet for diff (simpler and avoids layout conflicts)
  const shouldUseDiffSheet = useMediaQuery(DIFF_INLINE_LAYOUT_MEDIA_QUERY) || isSplitActive;

  const closeDiff = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: (previous) => {
        return stripDiffSearchParams(previous);
      },
    });
  }, [navigate, threadId]);

  const openDiff = useCallback(() => {
    void navigate({
      to: "/$threadId",
      params: { threadId },
      search: (previous) => {
        const rest = stripDiffSearchParams(previous);
        return { ...rest, diff: "1" };
      },
    });
  }, [navigate, threadId]);

  const closePane = useCallback(
    (closeId: ThreadId) => {
      const { primaryId: newPrimary, splitParam: newSplit } = removeSplitPane(
        threadId,
        search.split,
        closeId,
      );
      const isChangingPrimary = newPrimary !== threadId;
      void navigate({
        to: "/$threadId",
        params: { threadId: newPrimary },
        search: (previous) => {
          const withoutSplit = stripSplitSearchParams(previous);
          // Strip diff when primary changes (diff was bound to old primary)
          const base = isChangingPrimary ? stripDiffSearchParams(withoutSplit) : withoutSplit;
          return newSplit ? { ...base, split: newSplit } : base;
        },
      });
    },
    [navigate, threadId, search.split],
  );

  const promotePane = useCallback(
    (promoteId: ThreadId) => {
      const { primaryId: newPrimary, splitParam: newSplit } = promoteSplitPane(
        threadId,
        search.split,
        promoteId,
      );
      void navigate({
        to: "/$threadId",
        params: { threadId: newPrimary },
        search: (previous) => {
          // Strip diff: it was bound to old primary thread
          const base = stripDiffSearchParams(stripSplitSearchParams(previous));
          return newSplit ? { ...base, split: newSplit } : base;
        },
      });
    },
    [navigate, threadId, search.split],
  );

  const reorderPane = useCallback(
    (draggedId: ThreadId, targetId: ThreadId) => {
      const { primaryId: newPrimary, splitParam: newSplit } = reorderSplitPane(
        threadId,
        search.split,
        draggedId,
        targetId,
      );
      const isChangingPrimary = newPrimary !== threadId;
      void navigate({
        to: "/$threadId",
        params: { threadId: newPrimary },
        search: (previous) => {
          const withoutSplit = stripSplitSearchParams(previous);
          const base = isChangingPrimary ? stripDiffSearchParams(withoutSplit) : withoutSplit;
          return newSplit ? { ...base, split: newSplit } : base;
        },
      });
    },
    [navigate, threadId, search.split],
  );

  useEffect(() => {
    if (!threadsHydrated) {
      return;
    }

    if (!routeThreadExists) {
      void navigate({ to: "/", replace: true });
      return;
    }
  }, [navigate, routeThreadExists, threadsHydrated, threadId]);

  if (!threadsHydrated || !routeThreadExists) {
    return null;
  }

  if (isSplitActive) {
    return (
      <>
        <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatSplitView
            paneIds={paneIds}
            primaryId={threadId}
            onClosePane={closePane}
            onPromotePane={promotePane}
            onReorderPane={reorderPane}
          />
        </SidebarInset>
        <DiffPanelSheet diffOpen={diffOpen} onCloseDiff={closeDiff}>
          <Suspense fallback={<DiffLoadingFallback inline={false} />}>
            <DiffPanel mode="sheet" />
          </Suspense>
        </DiffPanelSheet>
      </>
    );
  }

  if (!shouldUseDiffSheet) {
    return (
      <>
        <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
          <ChatView key={threadId} threadId={threadId} />
        </SidebarInset>
        <DiffPanelInlineSidebar diffOpen={diffOpen} onCloseDiff={closeDiff} onOpenDiff={openDiff} />
      </>
    );
  }

  return (
    <>
      <SidebarInset className="h-dvh min-h-0 overflow-hidden overscroll-y-none bg-background text-foreground">
        <ChatView key={threadId} threadId={threadId} />
      </SidebarInset>
      <DiffPanelSheet diffOpen={diffOpen} onCloseDiff={closeDiff}>
        <Suspense fallback={<DiffLoadingFallback inline={false} />}>
          <DiffPanel mode="sheet" />
        </Suspense>
      </DiffPanelSheet>
    </>
  );
}

export const Route = createFileRoute("/_chat/$threadId")({
  validateSearch: (search) => ({
    ...parseDiffRouteSearch(search),
    ...parseSplitViewRouteSearch(search),
  }),
  component: ChatThreadRouteView,
});
