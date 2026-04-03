import { motion, useReducedMotion } from "framer-motion";
import { StatusPill } from "./StatusPill";
import type { ParityChoice, ResultOutcome, ResultVisualState } from "./types";
import { cn, formatParity } from "./utils";

const outcomeCopy: Record<
  ResultOutcome,
  { label: string; title: string; body: string; classes: string }
> = {
  win: {
    label: "Vitoria",
    title: "Voce venceu a rodada",
    body: "O destaque de sucesso sobe o brilho do placar e mantem a leitura centralizada.",
    classes:
      "border-accent/35 bg-[radial-gradient(circle_at_top,_rgba(0,255,163,0.14),_transparent_36%)] text-white",
  },
  lose: {
    label: "Derrota",
    title: "A rodada foi para o outro lado",
    body: "A interface reduz o glow e puxa o foco para a soma final da jogada.",
    classes:
      "border-danger/35 bg-[radial-gradient(circle_at_top,_rgba(255,84,120,0.14),_transparent_34%)] text-white",
  },
  draw: {
    label: "Empate",
    title: "A rodada terminou sem vencedor",
    body: "Este estado cobre combinacoes em que os lados escolhidos nao definem um unico vencedor.",
    classes:
      "border-secondary/35 bg-[radial-gradient(circle_at_top,_rgba(0,209,255,0.12),_transparent_34%)] text-white",
  },
};

const sparkPositions = [
  { left: "8%", top: "22%", x: -12, y: -28 },
  { left: "18%", top: "72%", x: -18, y: 20 },
  { left: "30%", top: "18%", x: -8, y: -24 },
  { left: "62%", top: "16%", x: 10, y: -26 },
  { left: "78%", top: "68%", x: 18, y: 18 },
  { left: "88%", top: "26%", x: 16, y: -18 },
];

interface ResultBannerProps {
  result: ResultVisualState;
  playerParity: ParityChoice;
  className?: string;
}

export function ResultBanner({ result, playerParity, className }: ResultBannerProps) {
  const reduceMotion = useReducedMotion();
  const copy = outcomeCopy[result.outcome];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "relative overflow-hidden rounded-[28px] border p-6 text-left sm:p-7",
        copy.classes,
        result.outcome === "lose" && "animate-shake-soft",
        className,
      )}
    >
      {!reduceMotion && result.outcome === "win"
        ? sparkPositions.map((spark, index) => (
            <motion.span
              key={`${spark.left}-${spark.top}`}
              className="result-firefly"
              style={{
                left: spark.left,
                top: spark.top,
                background: index % 2 === 0 ? "#00FFA3" : "#00D1FF",
              }}
              animate={{
                opacity: [0, 1, 0],
                x: [0, spark.x],
                y: [0, spark.y],
                scale: [0.4, 1, 0.65],
              }}
              transition={{
                duration: 1.6,
                delay: index * 0.08,
                repeat: Infinity,
                repeatDelay: 0.8,
                ease: "easeOut",
              }}
            />
          ))
        : null}

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={copy.label} variant={result.outcome === "lose" ? "danger" : "success"} />
          <StatusPill label={`Soma ${result.sum}`} variant="active" />
          <StatusPill label={formatParity(result.parity)} variant="default" />
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr,0.8fr] lg:items-end">
          <div>
            <p className="eyebrow">Resultado da rodada</p>
            <h3 className="mt-3 font-display text-3xl text-white sm:text-4xl">{copy.title}</h3>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/72">{copy.body}</p>
            <p className="mt-4 text-sm text-white/62">
              Voce apostou em <span className="font-semibold text-white">{formatParity(playerParity)}</span>.
            </p>
          </div>

          <div className="rounded-[24px] border border-white/10 bg-black/20 p-5">
            <p className="eyebrow">Placar</p>
            <div className="mt-3 font-display text-5xl text-white">{result.sum}</div>
            <p className="mt-2 text-sm text-white/68">
              A soma final caiu em <span className="font-semibold text-white">{formatParity(result.parity)}</span>.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
