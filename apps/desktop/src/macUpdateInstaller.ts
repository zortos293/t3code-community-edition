import * as FS from "node:fs";
import * as Path from "node:path";

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

export function resolveDownloadedMacUpdateZipPath(
  downloadedFiles: ReadonlyArray<string>,
): string | null {
  for (const file of downloadedFiles) {
    if (file.toLowerCase().endsWith(".zip")) {
      return file;
    }
  }
  return null;
}

export function findFirstAppBundlePath(rootDir: string): string | null {
  const queue = [rootDir];

  while (queue.length > 0) {
    const currentDir = queue.shift();
    if (!currentDir) {
      continue;
    }

    for (const entry of FS.readdirSync(currentDir, { withFileTypes: true })) {
      const entryPath = Path.join(currentDir, entry.name);
      if (entry.isDirectory() && entry.name.endsWith(".app")) {
        return entryPath;
      }
      if (entry.isDirectory()) {
        queue.push(entryPath);
      }
    }
  }

  return null;
}

export function buildMacManualUpdateInstallScript(args: {
  appPid: number;
  sourceAppPath: string;
  targetAppPath: string;
  stagingDir: string;
}): string {
  const sourceAppPath = shellQuote(args.sourceAppPath);
  const targetAppPath = shellQuote(args.targetAppPath);
  const stagingDir = shellQuote(args.stagingDir);

  return `#!/bin/sh
set -eu
APP_PID=${args.appPid}
SOURCE_APP=${sourceAppPath}
TARGET_APP=${targetAppPath}
STAGING_DIR=${stagingDir}

cleanup() {
  /bin/rm -rf "$STAGING_DIR"
}

trap cleanup EXIT

wait_for_app_exit() {
  while /bin/kill -0 "$APP_PID" 2>/dev/null; do
    /bin/sleep 0.2
  done
}

install_update() {
  /bin/rm -rf "$TARGET_APP"
  /usr/bin/ditto "$SOURCE_APP" "$TARGET_APP"
}

wait_for_app_exit

if ! install_update >/dev/null 2>&1; then
  export SOURCE_APP TARGET_APP
  /usr/bin/osascript <<'APPLESCRIPT'
set sourceApp to system attribute "SOURCE_APP"
set targetApp to system attribute "TARGET_APP"
do shell script "/bin/rm -rf " & quoted form of targetApp & " && /usr/bin/ditto " & quoted form of sourceApp & " " & quoted form of targetApp with administrator privileges
APPLESCRIPT
fi

/usr/bin/open -n "$TARGET_APP"
`;
}
