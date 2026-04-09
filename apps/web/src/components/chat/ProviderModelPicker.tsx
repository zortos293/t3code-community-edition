import { type ProviderKind, type ServerProvider } from "@t3tools/contracts";
import { resolveSelectableModel } from "@t3tools/shared/model";
import { memo, useState } from "react";
import type { VariantProps } from "class-variance-authority";
import { type ProviderPickerKind, PROVIDER_OPTIONS } from "../../session-logic";
import { ChevronDownIcon } from "lucide-react";
import { Button, buttonVariants } from "../ui/button";
import {
  Menu,
  MenuGroup,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator as MenuDivider,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "../ui/menu";
import { ClaudeAI, CursorIcon, Gemini, GitHubIcon, Icon, OpenAI, OpenCodeIcon } from "../Icons";
import { cn } from "~/lib/utils";
import { getProviderSnapshot } from "../../providerModels";
import {
  deriveCopilotQuotaSummary,
  findServerProviderModel,
  formatCopilotBillingMultiplier,
} from "./copilotQuota";

function isAvailableProviderOption(option: (typeof PROVIDER_OPTIONS)[number]): option is {
  value: ProviderKind;
  label: string;
  available: true;
} {
  return option.available;
}

const PROVIDER_ICON_BY_PROVIDER: Record<ProviderPickerKind, Icon> = {
  codex: OpenAI,
  copilot: GitHubIcon,
  claudeAgent: ClaudeAI,
  cursor: CursorIcon,
};

export const AVAILABLE_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter(isAvailableProviderOption);
const UNAVAILABLE_PROVIDER_OPTIONS = PROVIDER_OPTIONS.filter((option) => !option.available);
const COMING_SOON_PROVIDER_OPTIONS = [
  { id: "opencode", label: "OpenCode", icon: OpenCodeIcon },
  { id: "gemini", label: "Gemini", icon: Gemini },
] as const;

function formatQuotaResetDate(value: string | null): string | null {
  if (!value) return null;
  return new Date(value).toLocaleDateString();
}

function providerIconClassName(
  provider: ProviderKind | ProviderPickerKind,
  fallbackClassName: string,
): string {
  if (provider === "claudeAgent") return "text-[#d97757]";
  if (provider === "copilot") return "text-foreground/80";
  return fallbackClassName;
}

export const ProviderModelPicker = memo(function ProviderModelPicker(props: {
  provider: ProviderKind;
  model: string;
  lockedProvider: ProviderKind | null;
  providers?: ReadonlyArray<ServerProvider>;
  modelOptionsByProvider: Record<ProviderKind, ReadonlyArray<{ slug: string; name: string }>>;
  activeProviderIconClassName?: string;
  compact?: boolean;
  disabled?: boolean;
  triggerVariant?: VariantProps<typeof buttonVariants>["variant"];
  triggerClassName?: string;
  onProviderModelChange: (provider: ProviderKind, model: string) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const activeProvider = props.lockedProvider ?? props.provider;
  const selectedProviderOptions = props.modelOptionsByProvider[activeProvider];
  const selectedModelLabel =
    selectedProviderOptions.find((option) => option.slug === props.model)?.name ?? props.model;
  const ProviderIcon = PROVIDER_ICON_BY_PROVIDER[activeProvider];
  const copilotProvider = props.providers
    ? (getProviderSnapshot(props.providers, "copilot") ?? null)
    : null;
  const selectedCopilotModel =
    activeProvider === "copilot" && copilotProvider
      ? findServerProviderModel(copilotProvider.models, props.model)
      : null;
  const copilotQuotaSummary = deriveCopilotQuotaSummary(copilotProvider?.quotaSnapshots);
  const triggerSecondaryLabel =
    activeProvider === "copilot"
      ? selectedCopilotModel?.billingMultiplier != null
        ? `${selectedModelLabel} — ${formatCopilotBillingMultiplier(selectedCopilotModel.billingMultiplier)}`
        : selectedModelLabel
      : selectedModelLabel;
  const handleModelChange = (provider: ProviderKind, value: string) => {
    if (props.disabled) return;
    if (!value) return;
    const resolvedModel = resolveSelectableModel(
      provider,
      value,
      props.modelOptionsByProvider[provider],
    );
    if (!resolvedModel) return;
    props.onProviderModelChange(provider, resolvedModel);
    setIsMenuOpen(false);
  };

  return (
    <Menu
      open={isMenuOpen}
      onOpenChange={(open) => {
        if (props.disabled) {
          setIsMenuOpen(false);
          return;
        }
        setIsMenuOpen(open);
      }}
    >
      <MenuTrigger
        render={
          <Button
            size="sm"
            variant={props.triggerVariant ?? "ghost"}
            data-chat-provider-model-picker="true"
            className={cn(
              "min-w-0 justify-start overflow-hidden whitespace-nowrap px-2 text-muted-foreground/70 hover:text-foreground/80 [&_svg]:mx-0",
              props.compact ? "max-w-42 shrink-0" : "max-w-48 shrink sm:max-w-56 sm:px-3",
              props.triggerClassName,
            )}
            disabled={props.disabled}
          />
        }
      >
        <span
          className={cn(
            "flex min-w-0 w-full box-border items-center gap-2 overflow-hidden",
            props.compact ? "max-w-36 sm:pl-1" : undefined,
          )}
        >
          <ProviderIcon
            aria-hidden="true"
            className={cn(
              "size-4 shrink-0",
              providerIconClassName(activeProvider, "text-muted-foreground/70"),
              props.activeProviderIconClassName,
            )}
          />
          <span className="min-w-0 flex-1 truncate">
            {props.compact || activeProvider !== "copilot"
              ? selectedModelLabel
              : triggerSecondaryLabel}
          </span>
          {activeProvider === "copilot" && copilotQuotaSummary && !props.compact ? (
            <span className="shrink-0 text-[10px] text-muted-foreground/70">
              {copilotQuotaSummary.remainingRequests === null
                ? "Unlimited"
                : `${copilotQuotaSummary.remainingRequests} left`}
            </span>
          ) : null}
          <ChevronDownIcon aria-hidden="true" className="size-3 shrink-0 opacity-60" />
        </span>
      </MenuTrigger>
      <MenuPopup align="start">
        {activeProvider === "copilot" && copilotQuotaSummary ? (
          <>
            <div className="px-2.5 py-2">
              <div className="flex min-w-[16rem] flex-col gap-2 rounded-lg border border-border/70 bg-muted/20 p-2.5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                      Copilot premium usage
                    </div>
                    <div className="mt-0.5 text-sm font-medium text-foreground">
                      {copilotQuotaSummary.remainingRequests === null
                        ? "Unlimited remaining"
                        : `${copilotQuotaSummary.remainingRequests} left`}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      {copilotQuotaSummary.entitlementRequests > 0 ? (
                        <span>
                          {copilotQuotaSummary.usedRequests} /{" "}
                          {copilotQuotaSummary.entitlementRequests} used
                        </span>
                      ) : null}
                      {selectedCopilotModel?.billingMultiplier != null ? (
                        <span>
                          {selectedModelLabel} —{" "}
                          {formatCopilotBillingMultiplier(selectedCopilotModel.billingMultiplier)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-muted-foreground">
                    <div>{copilotQuotaSummary.label}</div>
                    {copilotQuotaSummary.remainingPercentage !== null ? (
                      <div>{Math.round(copilotQuotaSummary.remainingPercentage)}% remaining</div>
                    ) : null}
                  </div>
                </div>
                {copilotQuotaSummary.remainingPercentage !== null ? (
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-foreground/75 transition-[width] duration-500 ease-out motion-reduce:transition-none"
                      style={{
                        width: `${Math.max(0, Math.min(100, copilotQuotaSummary.remainingPercentage))}%`,
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  {formatQuotaResetDate(copilotQuotaSummary.resetDate) ? (
                    <span>Resets {formatQuotaResetDate(copilotQuotaSummary.resetDate)}</span>
                  ) : null}
                  {copilotQuotaSummary.overage > 0 ? (
                    <span>{copilotQuotaSummary.overage} overage requests</span>
                  ) : null}
                  {copilotQuotaSummary.overageAllowedWithExhaustedQuota ||
                  copilotQuotaSummary.usageAllowedWithExhaustedQuota ? (
                    <span>Pay-per-request available after quota exhaustion</span>
                  ) : null}
                </div>
              </div>
            </div>
            <MenuDivider />
          </>
        ) : null}
        {props.lockedProvider !== null ? (
          <MenuGroup>
            <MenuRadioGroup
              value={props.model}
              onValueChange={(value) => handleModelChange(props.lockedProvider!, value)}
            >
              {props.modelOptionsByProvider[props.lockedProvider].map((modelOption) => (
                <MenuRadioItem
                  key={`${props.lockedProvider}:${modelOption.slug}`}
                  value={modelOption.slug}
                  onClick={() => setIsMenuOpen(false)}
                >
                  {modelOption.name}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuGroup>
        ) : (
          <>
            {AVAILABLE_PROVIDER_OPTIONS.map((option) => {
              const OptionIcon = PROVIDER_ICON_BY_PROVIDER[option.value];
              const liveProvider = props.providers
                ? getProviderSnapshot(props.providers, option.value)
                : undefined;
              if (liveProvider && liveProvider.status !== "ready") {
                const unavailableLabel = !liveProvider.enabled
                  ? "Disabled"
                  : !liveProvider.installed
                    ? "Not installed"
                    : "Unavailable";
                return (
                  <MenuItem key={option.value} disabled>
                    <OptionIcon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0 opacity-80",
                        providerIconClassName(option.value, "text-muted-foreground/85"),
                      )}
                    />
                    <span>{option.label}</span>
                    <span className="ms-auto text-[11px] text-muted-foreground/80 uppercase tracking-[0.08em]">
                      {unavailableLabel}
                    </span>
                  </MenuItem>
                );
              }
              return (
                <MenuSub key={option.value}>
                  <MenuSubTrigger>
                    <OptionIcon
                      aria-hidden="true"
                      className={cn(
                        "size-4 shrink-0",
                        providerIconClassName(option.value, "text-muted-foreground/85"),
                      )}
                    />
                    {option.label}
                  </MenuSubTrigger>
                  <MenuSubPopup className="[--available-height:min(24rem,70vh)]" sideOffset={4}>
                    <MenuGroup>
                      <MenuRadioGroup
                        value={props.provider === option.value ? props.model : ""}
                        onValueChange={(value) => handleModelChange(option.value, value)}
                      >
                        {props.modelOptionsByProvider[option.value].map((modelOption) => (
                          <MenuRadioItem
                            key={`${option.value}:${modelOption.slug}`}
                            value={modelOption.slug}
                            onClick={() => setIsMenuOpen(false)}
                          >
                            {modelOption.name}
                          </MenuRadioItem>
                        ))}
                      </MenuRadioGroup>
                    </MenuGroup>
                  </MenuSubPopup>
                </MenuSub>
              );
            })}
            {UNAVAILABLE_PROVIDER_OPTIONS.length > 0 && <MenuDivider />}
            {UNAVAILABLE_PROVIDER_OPTIONS.map((option) => {
              const OptionIcon = PROVIDER_ICON_BY_PROVIDER[option.value];
              return (
                <MenuItem key={option.value} disabled>
                  <OptionIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-muted-foreground/85 opacity-80"
                  />
                  <span>{option.label}</span>
                  <span className="ms-auto text-[11px] text-muted-foreground/80 uppercase tracking-[0.08em]">
                    Coming soon
                  </span>
                </MenuItem>
              );
            })}
            {UNAVAILABLE_PROVIDER_OPTIONS.length === 0 && <MenuDivider />}
            {COMING_SOON_PROVIDER_OPTIONS.map((option) => {
              const OptionIcon = option.icon;
              return (
                <MenuItem key={option.id} disabled>
                  <OptionIcon aria-hidden="true" className="size-4 shrink-0 opacity-80" />
                  <span>{option.label}</span>
                  <span className="ms-auto text-[11px] text-muted-foreground/80 uppercase tracking-[0.08em]">
                    Coming soon
                  </span>
                </MenuItem>
              );
            })}
          </>
        )}
      </MenuPopup>
    </Menu>
  );
});
