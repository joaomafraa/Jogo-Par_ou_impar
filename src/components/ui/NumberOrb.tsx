import { motion } from "framer-motion";
import type { UiSize, UiVariant } from "./types";
import { cn } from "./utils";

const sizeClasses: Record<UiSize, string> = {
  sm: "h-12 w-12 text-lg",
  md: "h-14 w-14 text-xl",
  lg: "h-16 w-16 text-2xl",
};

const variantClasses: Record<UiVariant, string> = {
  default: "border-white/12 bg-white/5 text-white/80 hover:border-secondary/30",
  active: "border-secondary/50 bg-secondary/15 text-white shadow-neon",
  success: "border-accent/35 bg-accent/12 text-accent",
  danger: "border-danger/35 bg-danger/12 text-danger",
};

interface NumberOrbProps {
  value: number;
  selected?: boolean;
  disabled?: boolean;
  size?: UiSize;
  variant?: UiVariant;
  onSelect?: (value: number) => void;
}

export function NumberOrb({
  value,
  selected = false,
  disabled = false,
  size = "md",
  variant = "default",
  onSelect,
}: NumberOrbProps) {
  const resolvedVariant = selected ? "active" : variant;

  return (
    <motion.button
      type="button"
      aria-label={`Selecionar número ${value}`}
      aria-pressed={selected}
      disabled={disabled}
      whileHover={disabled ? undefined : { y: -2, scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      className={cn(
        "orb",
        sizeClasses[size],
        variantClasses[resolvedVariant],
        selected && "orb--active",
        disabled && "orb--disabled",
      )}
      onClick={() => onSelect?.(value)}
    >
      <span className="relative z-10">{value}</span>
    </motion.button>
  );
}
