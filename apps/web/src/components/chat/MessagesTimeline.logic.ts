import {
  BotIcon,
  CheckIcon,
  DatabaseIcon,
  EyeIcon,
  FileIcon,
  FolderIcon,
  GlobeIcon,
  HammerIcon,
  type LucideIcon,
  ListTodoIcon,
  SearchIcon,
  SquarePenIcon,
  TargetIcon,
  TerminalIcon,
  WrenchIcon,
  ZapIcon,
} from "lucide-react";

export interface TimelineDurationMessage {
  id: string;
  role: "user" | "assistant" | "system";
  createdAt: string;
  completedAt?: string | undefined;
}

export function computeMessageDurationStart(
  messages: ReadonlyArray<TimelineDurationMessage>,
): Map<string, string> {
  const result = new Map<string, string>();
  let lastBoundary: string | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      lastBoundary = message.createdAt;
    }
    result.set(message.id, lastBoundary ?? message.createdAt);
    if (message.role === "assistant" && message.completedAt) {
      lastBoundary = message.completedAt;
    }
  }

  return result;
}

export function normalizeCompactToolLabel(value: string): string {
  return value.replace(/\s+(?:complete|completed)\s*$/i, "").trim();
}

export interface WorkEntryIconInput {
  tone: "thinking" | "tool" | "info" | "error";
  activityKind?: string;
  itemType?:
    | "command_execution"
    | "file_change"
    | "mcp_tool_call"
    | "dynamic_tool_call"
    | "collab_agent_tool_call"
    | "web_search"
    | "image_view";
  requestKind?: "command" | "file-read" | "file-change";
  label?: string;
  toolTitle?: string;
  detail?: string;
  output?: string;
  command?: string;
  changedFiles?: ReadonlyArray<string>;
}

export function resolveWorkEntryIcon(workEntry: WorkEntryIconInput): LucideIcon {
  if (workEntry.requestKind === "command") return TerminalIcon;
  if (workEntry.requestKind === "file-read") return EyeIcon;
  if (workEntry.requestKind === "file-change") return SquarePenIcon;

  if (workEntry.itemType === "command_execution" || workEntry.command) {
    return TerminalIcon;
  }
  if (workEntry.itemType === "file_change" || (workEntry.changedFiles?.length ?? 0) > 0) {
    return SquarePenIcon;
  }
  if (workEntry.itemType === "web_search") return GlobeIcon;
  if (workEntry.itemType === "image_view") return EyeIcon;
  if (workEntry.itemType === "mcp_tool_call") return WrenchIcon;

  const haystack = [
    workEntry.label,
    workEntry.toolTitle,
    workEntry.detail,
    workEntry.output,
    workEntry.command,
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ")
    .toLowerCase();

  if (haystack.includes("report_intent") || haystack.includes("intent logged")) {
    return TargetIcon;
  }
  if (
    haystack.includes("bash") ||
    haystack.includes("read_bash") ||
    haystack.includes("write_bash") ||
    haystack.includes("stop_bash") ||
    haystack.includes("list_bash")
  ) {
    return TerminalIcon;
  }
  if (haystack.includes("sql")) return DatabaseIcon;
  if (haystack.includes("view")) return EyeIcon;
  if (haystack.includes("apply_patch")) return SquarePenIcon;
  if (haystack.includes("rg") || haystack.includes("glob") || haystack.includes("search")) {
    return SearchIcon;
  }
  if (haystack.includes("skill")) return ZapIcon;
  if (haystack.includes("ask_user") || haystack.includes("approval")) return BotIcon;
  if (haystack.includes("store_memory")) return FolderIcon;
  if (haystack.includes("edit") || haystack.includes("patch")) return WrenchIcon;
  if (haystack.includes("file")) return FileIcon;
  if (haystack.includes("task")) return HammerIcon;

  if (workEntry.activityKind === "turn.plan.updated") return ListTodoIcon;
  if (workEntry.activityKind === "task.progress") return HammerIcon;
  if (workEntry.activityKind === "approval.requested") return BotIcon;
  if (workEntry.activityKind === "approval.resolved") return CheckIcon;
  if (workEntry.itemType === "dynamic_tool_call") return WrenchIcon;
  if (workEntry.itemType === "collab_agent_tool_call") return BotIcon;

  return workEntry.tone === "info" ? CheckIcon : ZapIcon;
}
