import {
  DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER,
  type ModelSelection,
  type ProviderKind,
  type ServerProvider,
} from "@t3tools/contracts";
import { normalizeModelSlug, resolveSelectableModel } from "@t3tools/shared/model";
import { getComposerProviderState } from "./components/chat/composerProviderRegistry";
import { UnifiedSettings } from "@t3tools/contracts/settings";
import {
  getDefaultServerModel,
  getProviderModels,
  resolveSelectableProvider,
} from "./providerModels";

const MAX_CUSTOM_MODEL_COUNT = 32;
export const MAX_CUSTOM_MODEL_LENGTH = 256;

export type ProviderCustomModelConfig = {
  provider: ProviderKind;
  title: string;
  description: string;
  placeholder: string;
  example: string;
};

export interface AppModelOption {
  slug: string;
  name: string;
  isCustom: boolean;
}

const PROVIDER_CUSTOM_MODEL_CONFIG: Record<ProviderKind, ProviderCustomModelConfig> = {
  codex: {
    provider: "codex",
    title: "Codex",
    description: "Save additional Codex model slugs for the picker and `/model` command.",
    placeholder: "your-codex-model-slug",
    example: "gpt-6.7-codex-ultra-preview",
  },
  copilot: {
    provider: "copilot",
    title: "GitHub Copilot",
    description: "Save additional GitHub Copilot model slugs for the picker and `/model` command.",
    placeholder: "your-copilot-model-slug",
    example: "gpt-5",
  },
  claudeAgent: {
    provider: "claudeAgent",
    title: "Claude",
    description: "Save additional Claude model slugs for the picker and `/model` command.",
    placeholder: "your-claude-model-slug",
    example: "claude-sonnet-5-0",
  },
};

export const MODEL_PROVIDER_SETTINGS = Object.values(PROVIDER_CUSTOM_MODEL_CONFIG);

type ModelSelectionForProvider<P extends ProviderKind> = Extract<ModelSelection, { provider: P }>;
type ModelSelectionOptionsForProvider<P extends ProviderKind> = NonNullable<
  ModelSelectionForProvider<P>["options"]
>;

export function createModelSelection(
  provider: "codex",
  model: string,
  options?: ModelSelectionOptionsForProvider<"codex">,
): ModelSelectionForProvider<"codex">;
export function createModelSelection(
  provider: "copilot",
  model: string,
  options?: ModelSelectionOptionsForProvider<"copilot">,
): ModelSelectionForProvider<"copilot">;
export function createModelSelection(
  provider: "claudeAgent",
  model: string,
  options?: ModelSelectionOptionsForProvider<"claudeAgent">,
): ModelSelectionForProvider<"claudeAgent">;
export function createModelSelection(
  provider: ProviderKind,
  model: string,
  options?:
    | ModelSelectionOptionsForProvider<"codex">
    | ModelSelectionOptionsForProvider<"copilot">
    | ModelSelectionOptionsForProvider<"claudeAgent">,
): ModelSelection;
export function createModelSelection(
  provider: ProviderKind,
  model: string,
  options?:
    | ModelSelectionOptionsForProvider<"codex">
    | ModelSelectionOptionsForProvider<"copilot">
    | ModelSelectionOptionsForProvider<"claudeAgent">,
): ModelSelection {
  if (provider === "codex") {
    if (options === undefined) {
      return { provider, model } as ModelSelectionForProvider<"codex">;
    }
    return {
      provider,
      model,
      options: options as ModelSelectionOptionsForProvider<"codex">,
    } as ModelSelectionForProvider<"codex">;
  }
  if (provider === "copilot") {
    if (options === undefined) {
      return { provider, model } as ModelSelectionForProvider<"copilot">;
    }
    return {
      provider,
      model,
      options: options as ModelSelectionOptionsForProvider<"copilot">,
    } as ModelSelectionForProvider<"copilot">;
  }
  if (options === undefined) {
    return { provider, model } as ModelSelectionForProvider<"claudeAgent">;
  }
  return {
    provider,
    model,
    options: options as ModelSelectionOptionsForProvider<"claudeAgent">,
  } as ModelSelectionForProvider<"claudeAgent">;
}

export function normalizeCustomModelSlugs(
  models: Iterable<string | null | undefined>,
  builtInModelSlugs: ReadonlySet<string>,
  provider: ProviderKind = "codex",
): string[] {
  const normalizedModels: string[] = [];
  const seen = new Set<string>();

  for (const candidate of models) {
    const normalized = normalizeModelSlug(candidate, provider);
    if (
      !normalized ||
      normalized.length > MAX_CUSTOM_MODEL_LENGTH ||
      builtInModelSlugs.has(normalized) ||
      seen.has(normalized)
    ) {
      continue;
    }

    seen.add(normalized);
    normalizedModels.push(normalized);
    if (normalizedModels.length >= MAX_CUSTOM_MODEL_COUNT) {
      break;
    }
  }

  return normalizedModels;
}

export function getAppModelOptions(
  settings: UnifiedSettings,
  providers: ReadonlyArray<ServerProvider>,
  provider: ProviderKind,
  selectedModel?: string | null,
): AppModelOption[] {
  const options: AppModelOption[] = getProviderModels(providers, provider).map(
    ({ slug, name, isCustom }) => ({
      slug,
      name,
      isCustom,
    }),
  );
  const seen = new Set(options.map((option) => option.slug));
  const trimmedSelectedModel = selectedModel?.trim().toLowerCase();
  const builtInModelSlugs = new Set(
    getProviderModels(providers, provider)
      .filter((model) => !model.isCustom)
      .map((model) => model.slug),
  );

  const customModels = settings.providers[provider].customModels;
  for (const slug of normalizeCustomModelSlugs(customModels, builtInModelSlugs, provider)) {
    if (seen.has(slug)) {
      continue;
    }

    seen.add(slug);
    options.push({
      slug,
      name: slug,
      isCustom: true,
    });
  }

  const normalizedSelectedModel = normalizeModelSlug(selectedModel, provider);
  const selectedModelMatchesExistingName =
    typeof trimmedSelectedModel === "string" &&
    options.some((option) => option.name.toLowerCase() === trimmedSelectedModel);
  if (
    normalizedSelectedModel &&
    !seen.has(normalizedSelectedModel) &&
    !selectedModelMatchesExistingName
  ) {
    options.push({
      slug: normalizedSelectedModel,
      name: normalizedSelectedModel,
      isCustom: true,
    });
  }

  return options;
}

export function resolveAppModelSelection(
  provider: ProviderKind,
  settings: UnifiedSettings,
  providers: ReadonlyArray<ServerProvider>,
  selectedModel: string | null | undefined,
): string {
  const resolvedProvider = resolveSelectableProvider(providers, provider);
  const options = getAppModelOptions(settings, providers, resolvedProvider, selectedModel);
  return (
    resolveSelectableModel(resolvedProvider, selectedModel, options) ??
    getDefaultServerModel(providers, resolvedProvider)
  );
}

export function getCustomModelOptionsByProvider(
  settings: UnifiedSettings,
  providers: ReadonlyArray<ServerProvider>,
  selectedProvider?: ProviderKind | null,
  selectedModel?: string | null,
): Record<ProviderKind, ReadonlyArray<{ slug: string; name: string }>> {
  return {
    codex: getAppModelOptions(
      settings,
      providers,
      "codex",
      selectedProvider === "codex" ? selectedModel : undefined,
    ),
    copilot: getAppModelOptions(
      settings,
      providers,
      "copilot",
      selectedProvider === "copilot" ? selectedModel : undefined,
    ),
    claudeAgent: getAppModelOptions(
      settings,
      providers,
      "claudeAgent",
      selectedProvider === "claudeAgent" ? selectedModel : undefined,
    ),
  };
}

export function resolveAppModelSelectionState(
  settings: UnifiedSettings,
  providers: ReadonlyArray<ServerProvider>,
): ModelSelection {
  const selection = settings.textGenerationModelSelection ?? {
    provider: "codex" as const,
    model: DEFAULT_GIT_TEXT_GENERATION_MODEL_BY_PROVIDER.codex,
  };
  const provider = resolveSelectableProvider(providers, selection.provider);

  // When the provider changed due to fallback (e.g. selected provider was disabled),
  // don't carry over the old provider's model — use the fallback provider's default.
  const selectedModel = provider === selection.provider ? selection.model : null;
  const model = resolveAppModelSelection(provider, settings, providers, selectedModel);
  const { modelOptionsForDispatch } = getComposerProviderState({
    provider,
    model,
    models: getProviderModels(providers, provider),
    prompt: "",
    modelOptions: {
      [provider]: provider === selection.provider ? selection.options : undefined,
    },
  });

  if (provider === "codex") {
    return createModelSelection(provider, model, modelOptionsForDispatch);
  }
  if (provider === "copilot") {
    return createModelSelection(provider, model, modelOptionsForDispatch);
  }
  return createModelSelection(provider, model, modelOptionsForDispatch);
}
