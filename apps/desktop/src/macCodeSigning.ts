export function hasDeveloperIdApplicationAuthority(value: string): boolean {
  return value
    .split(/\r?\n/)
    .some((line) => line.trim().startsWith("Authority=Developer ID Application:"));
}
