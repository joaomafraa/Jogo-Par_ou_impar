import type { ButtonHTMLAttributes } from "react";
import { motion } from "framer-motion";
import type { UiSize, UiVariant } from "./types";
import { cn } from "./utils";

const variantClasses: Record<UiVariant, string> = {
  default: "border-primary/35 bg-primary/18 text-white shadow-glow",
  active: "border-secondary/35 bg-secondary/14 text-white shadow-neon",
  success: "border-accent/35 bg-accent text-dark shadow-[0_0_24px_rgba(0,255,163,0.28)]",
  danger: "border-danger/35 bg-danger/20 text-white shadow-danger",
};

const sizeClasses: Record<UiSize, string> = {
  sm: "min-h-[42px] px-4 text-sm",
  md: "min-h-[48px] px-5 text-sm",
  lg: "min-h-[54px] px-6 text-base",
};

type SafeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
  | "onAnimationEnd"
>;

interface PrimaryActionProps extends SafeButtonProps {
  variant?: UiVariant;
  size?: UiSize;
}

export function PrimaryAction({
  children,
  className,
  variant = "default",
  size = "lg",
  ...props
}: PrimaryActionProps) {
  return (
    <motion.button
      type="button"
      whileHover={props.disabled ? undefined : { y: -2, scale: 1.01 }}
      whileTap={props.disabled ? undefined : { y: 0, scale: 0.975 }}
      transition={{ type: "spring", stiffness: 340, damping: 22, mass: 0.9 }}
      className={cn("action-btn", sizeClasses[size], variantClasses[variant], className)}
      {...props}
    >
      {children}
    </motion.button>
  );
}

interface ReadyButtonProps extends PrimaryActionProps {
  isSynced?: boolean;
}

export function ReadyButton({
  children,
  isSynced = false,
  variant,
  ...props
}: ReadyButtonProps) {
  return (
    <PrimaryAction
      variant={variant ?? (props.disabled ? "default" : isSynced ? "success" : "active")}
      {...props}
    >
      {children}
    </PrimaryAction>
  );
}
