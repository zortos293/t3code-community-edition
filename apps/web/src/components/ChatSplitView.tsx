import { type ThreadId } from "@t3tools/contracts";
import { ArrowLeftIcon, XIcon } from "lucide-react";
import { useState, type DragEvent } from "react";

import { useComposerDraftStore } from "../composerDraftStore";
import { useStore } from "../store";
import ChatView from "./ChatView";

function handlePaneDragOver(event: DragEvent<HTMLDivElement>) {
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

interface PaneHeaderProps {
  threadId: ThreadId;
  isPrimary: boolean;
  onClose: () => void;
  onPromote: () => void;
  onPaneDragStart: (threadId: ThreadId) => void;
  onPaneDragEnd: () => void;
}

function useThreadDisplayTitle(threadId: ThreadId): string {
  const threadTitle = useStore((store) =>
    store.threads.find((t) => t.id === threadId)?.title,
  );
  const isDraft = useComposerDraftStore((store) =>
    Object.hasOwn(store.draftThreadsByThreadId, threadId),
  );
  return threadTitle ?? (isDraft ? "New thread" : threadId);
}

function PaneHeader({
  threadId,
  isPrimary,
  onClose,
  onPromote,
  onPaneDragStart,
  onPaneDragEnd,
}: PaneHeaderProps) {
  const title = useThreadDisplayTitle(threadId);
  const onDragStart = (event: DragEvent<HTMLDivElement>) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(threadId));
    onPaneDragStart(threadId);
  };

  return (
    <div
      draggable
      className="flex h-8 shrink-0 cursor-grab items-center gap-1 border-b border-border bg-card/50 px-2"
      onDragStart={onDragStart}
      onDragEnd={onPaneDragEnd}
    >
      {!isPrimary && (
        <button
          type="button"
          title="Make primary pane"
          aria-label="Make primary pane"
          className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-accent hover:text-foreground"
          onClick={onPromote}
        >
          <ArrowLeftIcon className="size-3" />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate text-[10px] font-medium text-muted-foreground/70">
        {title}
      </span>
      {isPrimary && (
        <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary/70">
          primary
        </span>
      )}
      <button
        type="button"
        title="Close pane"
        aria-label="Close pane"
        className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/60 hover:bg-accent hover:text-foreground"
        onClick={onClose}
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}

interface ChatSplitViewProps {
  paneIds: ThreadId[];
  primaryId: ThreadId;
  onClosePane: (id: ThreadId) => void;
  onPromotePane: (id: ThreadId) => void;
  onReorderPane: (draggedId: ThreadId, targetId: ThreadId) => void;
}

export default function ChatSplitView({
  paneIds,
  primaryId,
  onClosePane,
  onPromotePane,
  onReorderPane,
}: ChatSplitViewProps) {
  const [draggedPaneId, setDraggedPaneId] = useState<ThreadId | null>(null);
  const [dropTargetPaneId, setDropTargetPaneId] = useState<ThreadId | null>(null);
  const handlePaneDragEnter = (targetId: ThreadId) => {
    if (draggedPaneId && draggedPaneId !== targetId) {
      setDropTargetPaneId(targetId);
    }
  };
  const handlePaneDragLeave = (event: DragEvent<HTMLDivElement>, targetId: ThreadId) => {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
      return;
    }
    setDropTargetPaneId((current) => (current === targetId ? null : current));
  };
  const handlePaneDrop = (targetId: ThreadId) => {
    if (draggedPaneId && draggedPaneId !== targetId) {
      onReorderPane(draggedPaneId, targetId);
    }
    setDraggedPaneId(null);
    setDropTargetPaneId(null);
  };

  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden">
      {paneIds.map((id) => (
        <div
          key={id}
          className="relative flex min-w-0 flex-1 flex-col border-l border-border first:border-l-0"
          onDragEnter={(event) => {
            event.preventDefault();
            handlePaneDragEnter(id);
          }}
          onDragLeave={(event) => {
            handlePaneDragLeave(event, id);
          }}
          onDragOver={handlePaneDragOver}
          onDrop={(event) => {
            event.preventDefault();
            handlePaneDrop(id);
          }}
        >
          <div
            className={`pointer-events-none absolute inset-0 z-10 transition-all duration-200 ${
              draggedPaneId === id
                ? "border-2 border-primary/50 bg-primary/8"
                : dropTargetPaneId === id
                  ? "border-2 border-primary bg-primary/12 animate-pulse"
                  : "border-2 border-transparent bg-transparent"
            }`}
          />
          <PaneHeader
            threadId={id}
            isPrimary={id === primaryId}
            onClose={() => onClosePane(id)}
            onPromote={() => onPromotePane(id)}
            onPaneDragStart={(threadId) => {
              setDraggedPaneId(threadId);
              setDropTargetPaneId(null);
            }}
            onPaneDragEnd={() => {
              setDraggedPaneId(null);
              setDropTargetPaneId(null);
            }}
          />
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
            <ChatView key={id} threadId={id} />
          </div>
        </div>
      ))}
    </div>
  );
}
