import { motion } from "framer-motion";
import type { ParityChoice, UiVariant } from "./types";
import { cn, formatParity } from "./utils";

const activeClasses: Record<UiVariant, string> = {
  default: "toggle-pill--active",
  active: "bg-secondary/15 text-white shadow-neon",
  success: "bg-accent text-dark shadow-[0_0_24px_rgba(0,255,163,0.28)]",
  danger: "bg-danger/18 text-white shadow-danger",
};

interface ParityToggleProps {
  value: ParityChoice;
  disabled?: boolean;
  variant?: UiVariant;
  onChange?: (value: ParityChoice) => void;
}

export function ParityToggle({
  value,
  disabled = false,
  variant = "active",
  onChange,
}: ParityToggleProps) {
  const options: ParityChoice[] = ["odd", "even"];

  return (
    <div className="toggle-track">
      {options.map((option) => {
        const isActive = value === option;

        return (
          <motion.button
            key={option}
            type="button"
            disabled={disabled}
            aria-pressed={isActive}
            whileTap={disabled ? undefined : { scale: 0.98 }}
            className={cn(
              "toggle-pill",
              isActive ? activeClasses[variant] : "hover:text-white",
              disabled && "cursor-not-allowed opacity-45",
            )}
            onClick={() => onChange?.(option)}
          >
            {formatParity(option)}
          </motion.button>
        );
      })}
    </div>
  );
}
