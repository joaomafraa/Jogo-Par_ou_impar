import { SurfaceCard } from "./SurfaceCard";
import { StatusPill } from "./StatusPill";
import type { PlayerVisualState, UiVariant } from "./types";
import { formatParity } from "./utils";

interface PlayerSlotCardProps {
  slotLabel: string;
  player: PlayerVisualState;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function PlayerSlotCard({ slotLabel, player }: PlayerSlotCardProps) {
  const cardVariant: UiVariant = !player.connected
    ? "danger"
    : player.ready
      ? "success"
      : player.selectedNumber !== undefined
        ? "active"
        : "default";

  const statusText = !player.connected ? "Offline" : player.ready ? "Ready" : "Standby";
  const detailText = !player.connected
    ? "Slot aguardando conexao ou reconexao."
    : player.ready
      ? "Jogador sincronizado para a rodada."
      : "Conectado, mas ainda sem confirmacao.";

  const displayName = player.name || "Vaga aberta";

  return (
    <SurfaceCard variant={cardVariant} size="lg" className="h-full">
      <div className="relative z-10 flex h-full flex-col gap-6 text-left">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-[20px] border border-white/10 bg-white/5 font-display text-xl text-white/80">
              {player.connected ? getInitials(displayName) : "--"}
            </div>
            <div className="min-w-0">
              <p className="eyebrow">{slotLabel}</p>
              <h3 className="mt-2 font-display text-2xl text-white">{displayName}</h3>
              <p className="mt-2 text-sm leading-6 text-textMuted">{detailText}</p>
            </div>
          </div>
          <StatusPill label={statusText} variant={cardVariant} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
            <p className="eyebrow">Numero</p>
            <p className="mt-3 font-display text-4xl text-white">
              {player.connected && player.selectedNumber !== undefined ? player.selectedNumber : "--"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
            <p className="eyebrow">Lado</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {player.connected && player.selectedParity ? formatParity(player.selectedParity) : "Sem lado"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <StatusPill
            label={player.selectedNumber !== undefined ? "Jogada visivel" : "Sem envio"}
            variant={player.selectedNumber !== undefined ? "active" : "default"}
            size="sm"
          />
          <StatusPill
            label={player.ready ? "Pronto" : player.connected ? "Na sala" : "Sem sinal"}
            variant={player.ready ? "success" : player.connected ? "default" : "danger"}
            size="sm"
          />
        </div>
      </div>
    </SurfaceCard>
  );
}
