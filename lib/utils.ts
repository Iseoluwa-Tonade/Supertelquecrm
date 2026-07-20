import { PIPELINE_COLUMNS, PROJECT_COLUMNS, FOCUS_COLUMNS } from "@/lib/types";

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function label(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(value: number): string {
  return value > 999
    ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
    : String(value);
}

export function daysUntil(date: string): number {
  const today = new Date();
  const midnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((new Date(date).getTime() - midnight.getTime()) / 86400000);
}

export function dueLabel(date: string): string {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)}d late`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `${days}d`;
}

export function todayIso(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString().slice(0, 10);
}

export function dateLabel(date: string): string {
  if (date === todayIso()) return "Today";
  return date || "No date";
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isSafeUrl(url: string): boolean {
  return /^https?:\/\//i.test(url || "");
}

export function statusTitle(status: string): string {
  const all = [...PIPELINE_COLUMNS, ...PROJECT_COLUMNS, ...FOCUS_COLUMNS];
  return all.find((c) => c.id === status)?.title || label(status);
}

export function statusColor(status: string): string {
  const all = [...PIPELINE_COLUMNS, ...PROJECT_COLUMNS, ...FOCUS_COLUMNS];
  return all.find((c) => c.id === status)?.color || "#64748b";
}

export function docIcon(fileType: string = ""): string {
  if (fileType.startsWith("image/")) return "🖼";
  if (fileType.includes("pdf")) return "📄";
  if (fileType.includes("word") || fileType.includes("document")) return "📝";
  if (fileType.includes("sheet") || fileType.includes("excel")) return "📊";
  return "📁";
}

export function formatChangeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Empty";
  if (typeof value === "number") return String(value);
  return String(value);
}

export function normalizeStatus(status: string): string {
  const all = [...PIPELINE_COLUMNS, ...PROJECT_COLUMNS, ...FOCUS_COLUMNS];
  const found = all.find((c) => c.id === status);
  return found ? status : "responded_email";
}
