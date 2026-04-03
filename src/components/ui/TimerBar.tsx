import { motion, useReducedMotion } from "framer-motion";
import { cn } from "./utils";

interface TimerBarProps {
  currentTime: number;
  deadlineAt: number | null;
  maxSeconds?: number;
  label?: string;
  isActive?: boolean;
}

export function TimerBar({
  currentTime,
  deadlineAt,
  maxSeconds = 10,
  label = "Timer da rodada",
  isActive = false,
}: TimerBarProps) {
  const reduceMotion = useReducedMotion();
  const remainingMs = deadlineAt ? Math.max(deadlineAt - currentTime, 0) : 0;
  const progress = deadlineAt ? Math.max((remainingMs / (maxSeconds * 1000)) * 100, 0) : 0;
  const clampedSeconds = Math.max(Math.ceil(remainingMs / 1000), 0);
  const isDanger = isActive && remainingMs > 0 && remainingMs <= 3000;

  return (
    <div className="relative z-10 flex flex-col gap-3">
      <div className="flex items-end justify-between gap-3">
        <p className="eyebrow">{label}</p>
        <div
          className={cn(
            "timer-clock rounded-full border px-3 py-1 font-display text-2xl",
            isDanger
              ? "timer-clock-alert border-danger/45 bg-danger/14 text-danger"
              : "border-white/10 bg-white/5 text-white",
          )}
        >
          {clampedSeconds}s
        </div>
      </div>

      <div className={cn("timer-track", isDanger && "timer-track-alert")}>
        <motion.div
          className={cn("timer-fill", isDanger && "timer-fill-alert")}
          style={{ width: `${progress}%` }}
          transition={{ duration: reduceMotion ? 0.01 : 0 }}
        >
          <span className={cn("timer-sheen", isDanger && "timer-sheen-alert")} />
        </motion.div>
      </div>
    </div>
  );
}
