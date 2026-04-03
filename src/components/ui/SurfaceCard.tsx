import type { HTMLAttributes } from "react";
import type { UiSize, UiVariant } from "./types";
import { cn } from "./utils";

const variantClasses: Record<UiVariant, string> = {
  default: "hud-panel--default",
  active: "hud-panel--active",
  success: "hud-panel--success",
  danger: "hud-panel--danger",
};

const sizeClasses: Record<UiSize, string> = {
  sm: "p-4",
  md: "p-5 sm:p-6",
  lg: "p-6 sm:p-7",
};

interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: UiVariant;
  size?: UiSize;
}

export function SurfaceCard({
  children,
  className,
  size = "md",
  variant = "default",
  ...props
}: SurfaceCardProps) {
  return (
    <div
      className={cn("hud-panel", variantClasses[variant], sizeClasses[size], className)}
      {...props}
    >
      {children}
    </div>
  );
}
