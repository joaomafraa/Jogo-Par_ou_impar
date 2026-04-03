import type { UiSize, UiVariant } from "./types";
import { cn } from "./utils";

const variantClasses: Record<UiVariant, string> = {
  default: "border-white/10 bg-white/5 text-textMuted",
  active: "border-secondary/35 bg-secondary/12 text-white shadow-neon",
  success: "border-accent/35 bg-accent/12 text-accent",
  danger: "border-danger/35 bg-danger/12 text-danger shadow-danger",
};

const sizeClasses: Record<UiSize, string> = {
  sm: "px-2.5 py-1 text-[0.65rem] tracking-[0.18em]",
  md: "px-3 py-1.5 text-[0.7rem] tracking-[0.2em]",
  lg: "px-4 py-2 text-xs tracking-[0.24em]",
};

interface StatusPillProps {
  label: string;
  variant?: UiVariant;
  size?: UiSize;
  className?: string;
}

export function StatusPill({
  label,
  variant = "default",
  size = "md",
  className,
}: StatusPillProps) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full border font-semibold uppercase",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {label}
    </span>
  );
}
