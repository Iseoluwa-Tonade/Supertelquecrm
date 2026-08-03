import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface/80 shadow-[0_12px_30px_-22px_rgba(15,23,42,0.32)] backdrop-blur-sm transition-shadow hover:shadow-[0_16px_38px_-24px_rgba(15,23,42,0.42)]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownPanel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[20px] border border-white/10 bg-[linear-gradient(180deg,rgba(23,33,43,.98),rgba(17,26,40,.94))] shadow-[0_28px_60px_-30px_rgba(15,23,42,0.75)] ring-1 ring-white/5 backdrop-blur-xl",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHead({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="min-w-0">
        <h3 className="truncate text-sm font-semibold text-foreground">{title}</h3>
        {hint ? <p className="truncate text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

const toneMap: Record<string, string> = {
  neutral: "border-border-strong/60 bg-muted text-muted-foreground",
  primary: "border-primary/30 bg-primary/12 text-primary",
  accent: "border-accent/30 bg-accent/12 text-accent",
  success: "border-success/30 bg-success/12 text-success",
  warning: "border-warning/30 bg-warning/12 text-warning",
  danger: "border-destructive/35 bg-destructive/12 text-destructive",
  info: "border-info/35 bg-info/12 text-info",
};

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: keyof typeof toneMap | string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "label-tag inline-flex items-center gap-1 rounded-full border px-2 py-0.5",
        toneMap[tone] ?? toneMap.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  initials,
  size = "md",
  tone = "muted",
  className,
}: {
  initials: string;
  size?: "sm" | "md" | "lg";
  tone?: "muted" | "primary" | "accent";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-mono font-medium",
        size === "sm" && "h-6 w-6 text-[10px]",
        size === "md" && "h-8 w-8 text-xs",
        size === "lg" && "h-11 w-11 text-sm",
        tone === "muted" && "bg-surface-raised text-muted-foreground ring-1 ring-border",
        tone === "primary" && "bg-primary/15 text-primary ring-1 ring-primary/30",
        tone === "accent" && "bg-accent/15 text-accent ring-1 ring-accent/30",
        className,
      )}
    >
      {initials}
    </span>
  );
}

export function Btn({
  variant = "ghost",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-xs" : "h-9 px-3.5 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground shadow-[0_10px_20px_-12px_rgba(15,118,110,0.8)] hover:bg-primary/90",
        variant === "ghost" && "text-muted-foreground hover:bg-surface-raised hover:text-foreground",
        variant === "outline" &&
          "border border-border-strong text-foreground hover:border-primary/50 hover:bg-surface-raised",
        variant === "danger" &&
          "border border-destructive/40 text-destructive hover:bg-destructive/10",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="label-tag text-muted-foreground">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
    </label>
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-xl border border-border bg-input px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/60 focus:ring-2 focus:ring-primary/20",
        className,
      )}
      {...props}
    />
  );
}

const PAGE_HEADER_VARIANTS: Record<string, string> = {
  overview: "border-emerald-700 bg-gradient-to-r from-emerald-600 to-teal-600 text-white [&_p]:!text-emerald-100 [&_h1]:!text-white",
  revenue: "border-amber-700 bg-gradient-to-r from-amber-600 to-yellow-600 text-white [&_p]:!text-amber-100 [&_h1]:!text-white",
  delivery: "border-blue-700 bg-gradient-to-r from-blue-600 to-indigo-600 text-white [&_p]:!text-blue-100 [&_h1]:!text-white",
  finance: "border-rose-700 bg-gradient-to-r from-rose-600 to-pink-600 text-white [&_p]:!text-rose-100 [&_h1]:!text-white",
  operations: "border-slate-700 bg-gradient-to-r from-slate-600 to-gray-600 text-white [&_p]:!text-slate-100 [&_h1]:!text-white",
  account: "border-violet-700 bg-gradient-to-r from-violet-600 to-purple-600 text-white [&_p]:!text-violet-100 [&_h1]:!text-white",
};

export function PageHeader({
  eyebrow,
  title,
  desc,
  actions,
  variant,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
  actions?: React.ReactNode;
  variant?: keyof typeof PAGE_HEADER_VARIANTS;
}) {
  return (
    <div className={`rounded-2xl border px-5 py-5 shadow-[0_16px_38px_-28px_rgba(15,23,42,0.36)] backdrop-blur-sm sm:px-6 ${PAGE_HEADER_VARIANTS[variant ?? "overview"] ?? "bg-surface/75 border-border"}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-tag text-primary">{eyebrow}</p>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {desc ? <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{desc}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Stat({
  label,
  value,
  delta,
  positive = true,
  spark,
}: {
  label: string;
  value: string;
  delta?: string;
  positive?: boolean;
  spark?: number[];
}) {
  const max = spark ? Math.max(...spark) : 1;
  return (
    <Panel className="relative overflow-hidden p-4">
      <p className="label-tag text-muted-foreground">{label}</p>
      <p className="num mt-2 text-2xl text-foreground">{value}</p>
      {delta ? (
        <p className={cn("num mt-1 text-xs", positive ? "text-success" : "text-destructive")}>
          {positive ? "▲" : "▼"} {delta}
        </p>
      ) : null}
      {spark ? (
        <div className="mt-3 flex h-8 items-end gap-1">
          {spark.map((v, i) => (
            <span
              key={i}
              className="flex-1 rounded-sm bg-primary/25"
              style={{ height: `${Math.max(12, (v / max) * 100)}%` }}
            />
          ))}
        </div>
      ) : null}
    </Panel>
  );
}

export function EmptyLock({ what }: { what: string }) {
  return (
    <Panel className="grid-canvas flex flex-col items-center justify-center gap-2 p-16 text-center">
      <p className="label-tag text-warning">Restricted</p>
      <p className="text-sm text-muted-foreground">
        Your current role can't view {what}. Switch role in the top bar to preview access tiers.
      </p>
    </Panel>
  );
}

export default null;
