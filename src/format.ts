export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${["B", "KiB", "MiB", "GiB"][unit]}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function displayTimestamp(value: string | null): string {
  if (!value) return "—";
  // Preserve the source's offset rather than silently switching to machine time.
  return value.replace("T", " ").replace(/([+-]\d{2}:\d{2}|Z)$/, " $1");
}

export function statusClass(status: number | null): string {
  if (status === null) return "neutral";
  if (status >= 500) return "danger";
  if (status >= 400) return "warning";
  if (status >= 300) return "info";
  return "success";
}
