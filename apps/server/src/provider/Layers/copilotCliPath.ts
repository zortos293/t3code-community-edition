import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

export function resolveBundledCopilotCliPath(): string | undefined {
  const localDependencyCliPath = join(CURRENT_DIR, "../../../node_modules/@github/copilot/npm-loader.js");
  if (existsSync(localDependencyCliPath)) {
    return localDependencyCliPath;
  }

  try {
    const sdkEntrypoint = require.resolve("@github/copilot-sdk");
    const cliPath = join(dirname(sdkEntrypoint), "..", "npm-loader.js");
    return existsSync(cliPath) ? cliPath : undefined;
  } catch {
    return undefined;
  }
}
