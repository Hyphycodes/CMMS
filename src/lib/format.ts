/** Small formatting helpers. Round any displayed numbers; favor words over chrome. */

export function formatMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatQty(n: number, unit: string): string {
  return `${formatNumber(n, n % 1 === 0 ? 0 : 2)} ${unit}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/** "today" / "3 days" / "5 weeks" — used for "oldest waiting first". */
export function formatWaiting(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  if (days <= 0) {
    const hours = Math.floor(ms / 3_600_000);
    return hours <= 1 ? "just now" : `${hours} hours`;
  }
  if (days === 1) return "1 day";
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.floor(days / 7)} weeks`;
  return `${Math.floor(days / 30)} months`;
}

/** Bucket an age in ms for color urgency. */
export function waitingTone(ms: number): "slate" | "amber" | "red" {
  const days = ms / 86_400_000;
  if (days >= 45) return "red";
  if (days >= 14) return "amber";
  return "slate";
}
