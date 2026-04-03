import { motion } from "framer-motion";
import type { UiVariant } from "./types";
import { cn } from "./utils";

const fillClasses: Record<UiVariant, string> = {
  default: "from-primary/80 to-secondary/80",
  active: "from-secondary to-primary",
  success: "from-accent to-secondary",
  danger: "from-danger to-warning",
};

interface TimerBarProps {
  secondsLeft: number;
  maxSeconds?: number;
  label?: string;
  isActive?: boolean;
}

export function TimerBar({
  secondsLeft,
  maxSeconds = 10,
  label = "Timer da rodada",
  isActive = false,
}: TimerBarProps) {
  const clampedSeconds = Math.max(0, Math.min(maxSeconds, secondsLeft));
  const progress = (clampedSeconds / maxSeconds) * 100;
  const variant: UiVariant =
    clampedSeconds === 0 ? "danger" : clampedSeconds <= 3 ? "danger" : "success";

  return (
    <div className="relative z-10 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{label}</p>
          <p className="mt-2 text-sm text-textMuted">
            {isActive
              ? "Barra animada com alerta forte nos 3s finais."
              : "O cronometro aparece somente durante a rodada."}
          </p>
        </div>
        <div
          className={cn(
            "rounded-full border px-3 py-1 font-display text-2xl",
            clampedSeconds <= 3
              ? "border-danger/35 bg-danger/12 text-danger"
              : "border-white/10 bg-white/5 text-white",
          )}
        >
          {clampedSeconds}s
        </div>
      </div>

      <div className="timer-track">
        <motion.div
          className={cn("timer-fill bg-gradient-to-r", fillClasses[variant])}
          animate={{ width: `${progress}%` }}
          transition={{ duration: isActive ? 0.8 : 0.35, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
