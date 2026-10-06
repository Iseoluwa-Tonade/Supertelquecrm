import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { Check, ChevronDown } from "lucide-react";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "crm-surface rounded-[22px] border border-border/90 bg-surface/92 backdrop-blur-xl transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-px hover:border-primary/15",
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

export type DropdownOption = {
  value: string;
  label: string;
};

export function DropdownSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder: string;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [position, setPosition] = React.useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = React.useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 240), window.innerWidth - 24);
    const left = Math.min(Math.max(12, rect.left), Math.max(12, window.innerWidth - width - 12));

    setPosition({ top: rect.bottom + 8, left, width });
  }, []);

  React.useEffect(() => {
    if (!open) return;

    updatePosition();

    const onResize = () => updatePosition();
    const onScroll = () => updatePosition();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    window.addEventListener("resize", onResize);
    document.addEventListener("scroll", onScroll, true);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("scroll", onScroll, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, updatePosition]);

  const selected = options.find((option) => option.value === value);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-3 rounded-[14px] border border-border bg-input px-3 text-left text-sm text-foreground shadow-[0_1px_2px_rgba(16,24,40,.03)] outline-none transition-[border-color,box-shadow,background] hover:border-primary/35 hover:bg-surface focus:border-primary/55 focus:ring-4 focus:ring-primary/10",
          open && "border-primary/60 ring-2 ring-primary/20",
          className,
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate", selected ? "text-foreground" : "text-muted-foreground")}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform duration-200", open && "rotate-180")} />
      </button>

      {mounted && open && position && createPortal(
        <>
          <div className="fixed inset-0 z-110 bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed z-120 max-h-80 overflow-hidden rounded-[18px] border border-white/10 bg-[linear-gradient(180deg,rgba(19,29,43,.99),rgba(11,18,32,.98))] shadow-[0_28px_70px_-26px_rgba(2,8,23,.78)] ring-1 ring-white/5 backdrop-blur-2xl"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <div className="border-b border-white/10 px-3 py-2">
              <p className="label-tag text-crm-sidebar-muted/80">Select an option</p>
            </div>
            <div className="max-h-64 overflow-y-auto p-2">
              {options.map((option) => {
                const active = option.value === value;
                return (
                  <button
                    key={option.value || option.label}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                      active ? "bg-primary/15 text-primary" : "text-foreground hover:bg-white/5",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </>
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
    <div className="flex items-center justify-between gap-3 border-b border-border/80 px-5 py-4">
      <div className="min-w-0">
        <h3 className="truncate text-[15px] font-semibold tracking-[-0.01em] text-foreground">{title}</h3>
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
        "label-tag inline-flex items-center gap-1 rounded-full border px-2.5 py-1 font-semibold",
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
  type = "button",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md";
}) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[13px] font-semibold transition-[transform,background,border-color,box-shadow,color] duration-200 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px",
        size === "sm" ? "h-[34px] px-3 text-xs" : "h-10 px-4 text-sm",
        variant === "primary" && "bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_rgba(13,148,136,.72)] hover:-translate-y-px hover:bg-primary/92 hover:shadow-[0_14px_28px_-14px_rgba(13,148,136,.62)]",
        variant === "ghost" && "text-muted-foreground hover:bg-surface-raised/85 hover:text-foreground",
        variant === "outline" &&
          "border border-border-strong bg-surface/70 text-foreground shadow-[0_1px_2px_rgba(16,24,40,.03)] hover:-translate-y-px hover:border-primary/35 hover:bg-surface-raised",
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
        "h-10 w-full rounded-[14px] border border-border bg-input px-3.5 text-sm text-foreground shadow-[0_1px_2px_rgba(16,24,40,.03)] outline-none transition-[border-color,box-shadow,background] placeholder:text-muted-foreground/65 hover:border-primary/25 focus:border-primary/55 focus:bg-surface focus:ring-4 focus:ring-primary/10",
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
        "w-full rounded-[14px] border border-border bg-input px-3.5 py-2.5 text-sm text-foreground shadow-[0_1px_2px_rgba(16,24,40,.03)] outline-none transition-[border-color,box-shadow,background] placeholder:text-muted-foreground/65 hover:border-primary/25 focus:border-primary/55 focus:bg-surface focus:ring-4 focus:ring-primary/10",
        className,
      )}
      {...props}
    />
  );
}

const PAGE_HEADER_VARIANTS: Record<string, string> = {
  overview: "border-emerald-200/80 before:bg-emerald-500 [&_.page-eyebrow]:text-emerald-700 dark:border-emerald-400/15 dark:[&_.page-eyebrow]:text-emerald-300",
  revenue: "border-amber-200/80 before:bg-amber-500 [&_.page-eyebrow]:text-amber-700 dark:border-amber-400/15 dark:[&_.page-eyebrow]:text-amber-300",
  delivery: "border-blue-200/80 before:bg-blue-500 [&_.page-eyebrow]:text-blue-700 dark:border-blue-400/15 dark:[&_.page-eyebrow]:text-blue-300",
  finance: "border-rose-200/80 before:bg-rose-500 [&_.page-eyebrow]:text-rose-700 dark:border-rose-400/15 dark:[&_.page-eyebrow]:text-rose-300",
  operations: "border-slate-200/90 before:bg-slate-500 [&_.page-eyebrow]:text-slate-700 dark:border-slate-400/15 dark:[&_.page-eyebrow]:text-slate-300",
  account: "border-violet-200/80 before:bg-violet-500 [&_.page-eyebrow]:text-violet-700 dark:border-violet-400/15 dark:[&_.page-eyebrow]:text-violet-300",
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
    <div className={`relative overflow-hidden rounded-[26px] border bg-[radial-gradient(circle_at_92%_0%,rgba(13,148,136,.08),transparent_30%),linear-gradient(180deg,rgba(255,255,255,.96),rgba(248,250,252,.92))] px-5 py-6 shadow-[0_18px_45px_-32px_rgba(16,24,40,.32)] before:absolute before:left-0 before:top-6 before:h-14 before:w-1 before:rounded-r-full dark:bg-[linear-gradient(180deg,rgba(16,24,38,.96),rgba(11,18,32,.94))] sm:px-7 ${PAGE_HEADER_VARIANTS[variant ?? "overview"] ?? "border-border before:bg-primary"}`}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow label-tag font-semibold">{eyebrow}</p>
          <h1 className="mt-2 text-[28px] font-semibold tracking-[-0.035em] text-foreground sm:text-[32px]">{title}</h1>
          {desc ? <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{desc}</p> : null}
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
    <Panel className="group relative overflow-hidden p-5">
      <p className="label-tag text-muted-foreground">{label}</p>
      <p className="num mt-2 text-[28px] font-semibold tracking-[-0.04em] text-foreground">{value}</p>
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
              className="flex-1 rounded-full bg-primary/22 transition-[height,background] duration-300 group-hover:bg-primary/35"
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
