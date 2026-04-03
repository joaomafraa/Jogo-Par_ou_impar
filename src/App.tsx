import { MotionConfig, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { PrimaryAction, ReadyButton } from "./components/ui/ActionButton";
import { NumberOrb } from "./components/ui/NumberOrb";
import { ParityToggle } from "./components/ui/ParityToggle";
import { PlayerSlotCard } from "./components/ui/PlayerSlotCard";
import { ResultBanner } from "./components/ui/ResultBanner";
import { StatusPill } from "./components/ui/StatusPill";
import { SurfaceCard } from "./components/ui/SurfaceCard";
import { TimerBar } from "./components/ui/TimerBar";
import type {
  ParityChoice,
  PlayerVisualState,
  ResultVisualState,
  UiVariant,
} from "./components/ui/types";

type GamePhase = "waiting" | "ready" | "playing" | "result";

interface NetworkPlayer {
  id: string;
  socketId: string;
  slot: number | null;
  spectator: boolean;
  connected: boolean;
  ready: boolean;
  submitted: boolean;
  selection: {
    number: number;
    parity: ParityChoice;
    auto: boolean;
  } | null;
  name: string;
}

interface NetworkResult {
  sum: number;
  parity: ParityChoice;
  winnerSlot: number | null;
  reason: "submitted" | "timeout" | "disconnect";
}

interface GameState {
  phase: GamePhase;
  round: number;
  roomCode: string;
  serverTime: number;
  deadlineAt: number | null;
  result: NetworkResult | null;
  infoMessage: string;
  players: NetworkPlayer[];
}

interface PlayerMeta {
  socketId: string;
  slot: number | null;
  spectator: boolean;
}

const socketUrl = import.meta.env.VITE_SOCKET_URL || undefined;

function getInitialPlayer(label: string): PlayerVisualState {
  return {
    name: label,
    connected: false,
    ready: false,
  };
}

function getRoomVariant(phase: GamePhase, deadlineAt: number | null): UiVariant {
  if (phase === "result") {
    return "success";
  }

  if (phase === "ready") {
    return "success";
  }

  if (phase === "playing" && deadlineAt) {
    const remainingMs = Math.max(deadlineAt - Date.now(), 0);
    return remainingMs <= 3_000 ? "danger" : "active";
  }

  return "active";
}

function formatPhaseLabel(phase: GamePhase) {
  if (phase === "waiting") return "Aguardando jogadores";
  if (phase === "ready") return "Todos prontos";
  if (phase === "playing") return "Rodada ativa";
  return "Resultado";
}

function deriveSecondsLeft(gameState: GameState | null, now: number) {
  if (!gameState?.deadlineAt) {
    return 0;
  }

  return Math.max(Math.ceil((gameState.deadlineAt - now) / 1000), 0);
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [meta, setMeta] = useState<PlayerMeta | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [selectedParity, setSelectedParity] = useState<ParityChoice>("odd");
  const [submittedSelection, setSubmittedSelection] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      setIsConnected(false);
    });

    socket.on("player:meta", (payload: PlayerMeta) => {
      setMeta(payload);
    });

    socket.on("game:state", (payload: GameState) => {
      setGameState(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (gameState?.phase !== "playing") {
      setSubmittedSelection(false);
    }
  }, [gameState?.phase]);

  const currentPlayer = useMemo(() => {
    if (!gameState || !meta) {
      return null;
    }

    return gameState.players.find((player) => player.socketId === meta.socketId) || null;
  }, [gameState, meta]);

  const opponentPlayer = useMemo(() => {
    if (!gameState || !meta) {
      return null;
    }

    return (
      gameState.players.find(
        (player) => !player.spectator && player.socketId !== meta.socketId && player.slot !== null,
      ) || null
    );
  }, [gameState, meta]);

  const currentPlayerCard: PlayerVisualState = currentPlayer
    ? {
        name: currentPlayer.name,
        connected: currentPlayer.connected,
        ready: currentPlayer.ready,
        selectedNumber: currentPlayer.selection?.number,
        selectedParity: currentPlayer.selection?.parity,
      }
    : getInitialPlayer(meta?.spectator ? "Espectador" : "Voce");

  const opponentCard: PlayerVisualState = opponentPlayer
    ? {
        name: opponentPlayer.name,
        connected: opponentPlayer.connected,
        ready: opponentPlayer.ready,
        selectedNumber:
          gameState?.phase === "result" ? opponentPlayer.selection?.number : undefined,
        selectedParity:
          gameState?.phase === "result" ? opponentPlayer.selection?.parity : undefined,
      }
    : getInitialPlayer("Aguardando rival");

  const secondsLeft = deriveSecondsLeft(gameState, now);
  const roomVariant = getRoomVariant(gameState?.phase || "waiting", gameState?.deadlineAt || null);
  const isSpectator = meta?.spectator ?? false;
  const canReady =
    Boolean(currentPlayer) && !isSpectator && gameState?.phase !== "playing" && !currentPlayer?.ready;
  const canSubmit =
    Boolean(currentPlayer) &&
    !isSpectator &&
    gameState?.phase === "playing" &&
    !submittedSelection &&
    !currentPlayer?.submitted;

  const resultVisual: ResultVisualState | null = useMemo(() => {
    if (!gameState?.result) {
      return null;
    }

    let outcome: ResultVisualState["outcome"] = "draw";
    const currentSlot = currentPlayer?.slot;
    if (gameState.result.winnerSlot !== null && currentSlot !== null && currentSlot !== undefined) {
      outcome = gameState.result.winnerSlot === currentSlot ? "win" : "lose";
    }

    return {
      sum: gameState.result.sum,
      parity: gameState.result.parity,
      outcome,
    };
  }, [currentPlayer?.slot, gameState?.result]);

  function sendReady() {
    if (!socketRef.current || !canReady) {
      return;
    }

    socketRef.current.emit("player:ready", { ready: true });
  }

  function sendChoice() {
    if (!socketRef.current || !canSubmit) {
      return;
    }

    socketRef.current.emit("player:submit", {
      number: selectedNumber,
      parity: selectedParity,
    });
    setSubmittedSelection(true);
  }

  function renderCenterPanel() {
    if (!gameState) {
      return (
        <div className="grid min-h-[20rem] place-items-center text-center">
          <div className="max-w-md space-y-3">
            <p className="eyebrow">Conectando</p>
            <h2 className="panel-title text-center">Entrando na sala em tempo real</h2>
            <p className="panel-copy text-center">
              O cliente esta aguardando o primeiro snapshot do servidor para montar a rodada.
            </p>
          </div>
        </div>
      );
    }

    if (isSpectator) {
      return (
        <div className="grid min-h-[20rem] place-items-center text-center">
          <div className="max-w-lg space-y-4">
            <StatusPill label="Sala cheia" variant="danger" />
            <h2 className="panel-title text-center">Os dois lugares ja estao ocupados</h2>
            <p className="panel-copy text-center">
              Assim que um jogador sair, recarregue a pagina para assumir a vaga aberta na sala.
            </p>
          </div>
        </div>
      );
    }

    if (gameState.phase === "result" && resultVisual) {
      return (
        <div className="grid gap-4">
          <ResultBanner result={resultVisual} playerParity={selectedParity} />

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
              <p className="eyebrow">Motivo do fechamento</p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                {gameState.result?.reason === "submitted"
                  ? "Os dois jogadores enviaram a jogada antes do tempo."
                  : "A rodada foi resolvida quando o cronometro terminou."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
              <p className="eyebrow">Seu envio</p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                {currentPlayer?.selection
                  ? `Numero ${currentPlayer.selection.number} com ${currentPlayer.selection.parity === "odd" ? "impar" : "par"}.`
                  : "Sem envio registrado nesta rodada."}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
              <p className="eyebrow">Estado seguinte</p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                Clique em Ready para sinalizar que voce quer entrar na proxima rodada.
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid gap-5 xl:grid-cols-[1.08fr,0.92fr] xl:items-start">
        <div className="grid gap-4">
          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-left">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <p className="eyebrow">Round {gameState.round}</p>
                <h2 className="mt-3 panel-title">
                  {gameState.phase === "waiting"
                    ? "Espere o segundo jogador entrar na sala"
                    : gameState.phase === "ready"
                      ? "Os dois jogadores estao sincronizados"
                      : "Escolha um numero e confirme seu lado"}
                </h2>
                <p className="mt-3 panel-copy">
                  {gameState.infoMessage || "A partida atualiza em tempo real para os dois lados."}
                </p>
              </div>
              <StatusPill label={formatPhaseLabel(gameState.phase)} variant={roomVariant} />
            </div>
          </div>

          <SurfaceCard size="md" className="bg-black/10">
            <div className="relative z-10 flex flex-col gap-4 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Escolha numerica</p>
                  <p className="mt-2 text-sm leading-6 text-textMuted">
                    Selecione um valor entre 0 e 5. O servidor valida a jogada e sincroniza a rodada.
                  </p>
                </div>
                <StatusPill
                  label={canSubmit ? "Pronto para enviar" : submittedSelection ? "Enviado" : "Travado"}
                  variant={canSubmit ? "success" : submittedSelection ? "active" : "default"}
                  size="sm"
                />
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {Array.from({ length: 6 }, (_, value) => (
                  <NumberOrb
                    key={value}
                    value={value}
                    selected={selectedNumber === value}
                    disabled={!canSubmit}
                    onSelect={setSelectedNumber}
                  />
                ))}
              </div>
            </div>
          </SurfaceCard>
        </div>

        <div className="grid gap-4">
          <SurfaceCard size="md" className="bg-black/10">
            <div className="relative z-10 flex flex-col gap-4 text-left">
              <div>
                <p className="eyebrow">Lado da rodada</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Defina se voce quer apostar em impar ou par antes de confirmar a jogada.
                </p>
              </div>

              <ParityToggle
                value={selectedParity}
                disabled={!canSubmit}
                variant="active"
                onChange={setSelectedParity}
              />

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-left">
                <p className="eyebrow">Resumo atual</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-sm text-textMuted">Numero</p>
                    <p className="mt-2 font-display text-4xl text-white">{selectedNumber}</p>
                  </div>
                  <div>
                    <p className="text-sm text-textMuted">Lado</p>
                    <p className="mt-2 text-2xl font-semibold text-white">
                      {selectedParity === "odd" ? "Impar" : "Par"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SurfaceCard>

          <div className="rounded-[28px] border border-white/10 bg-gradient-to-br from-secondary/10 via-transparent to-primary/10 p-5 text-left">
            <p className="eyebrow">Sala unica online</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-textMuted">Jogadores conectados</p>
                <p className="mt-2 font-display text-4xl text-white">{gameState.players.length}/2</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-black/20 p-4">
                <p className="text-sm text-textMuted">Seu status</p>
                <p className="mt-2 text-xl font-semibold text-white">
                  {currentPlayer?.ready ? "Ready" : currentPlayer?.submitted ? "Enviado" : "Em espera"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div className="arcade-grid" aria-hidden="true" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="stage-shell"
        >
          <header className="grid gap-4 xl:grid-cols-[1.18fr,0.82fr] xl:items-stretch">
            <SurfaceCard variant="active" size="lg">
              <div className="relative z-10 flex h-full flex-col gap-5 text-left">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div className="max-w-2xl">
                    <p className="eyebrow">Neon Arcade Multiplayer</p>
                    <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
                      Impar ou Par Online
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-textMuted">
                      Sala unica em tempo real com ready, timer de 10 segundos, resultado automatico
                      e replay para a proxima rodada.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    <StatusPill label={gameState?.roomCode || "SALA-01"} variant="active" />
                    <StatusPill
                      label={isConnected ? "Conectado" : "Reconectando"}
                      variant={isConnected ? "success" : "danger"}
                    />
                    <StatusPill
                      label={gameState ? `${gameState.players.length}/2 online` : "0/2 online"}
                      variant={gameState?.players.length === 2 ? "success" : "default"}
                    />
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard size="md">
              <div className="relative z-10 flex h-full flex-col justify-between gap-5 text-left">
                <div className="space-y-4">
                  <div>
                    <p className="eyebrow">Status da partida</p>
                    <h2 className="mt-3 font-display text-2xl text-white">
                      {gameState ? formatPhaseLabel(gameState.phase) : "Sincronizando"}
                    </h2>
                  </div>

                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm leading-6 text-white/78">
                      {isSpectator
                        ? "A sala ja esta cheia. Aguarde uma vaga ou abra outra sessao quando um jogador sair."
                        : gameState?.infoMessage || "Conectando ao servidor do jogo."}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={currentPlayer?.submitted ? "Jogada enviada" : "Sem envio"}
                    variant={currentPlayer?.submitted ? "active" : "default"}
                    size="sm"
                  />
                  <StatusPill
                    label={currentPlayer?.ready ? "Ready ativo" : "Ready desligado"}
                    variant={currentPlayer?.ready ? "success" : "default"}
                    size="sm"
                  />
                </div>
              </div>
            </SurfaceCard>
          </header>

          <main className="grid gap-4 xl:grid-cols-[0.92fr,1.25fr,0.92fr] xl:items-start">
            <PlayerSlotCard slotLabel="Seu painel" player={currentPlayerCard} />

            <SurfaceCard variant={roomVariant} size="lg" className="relative">
              <div className="scanline" />
              <div className="relative z-10 flex flex-col gap-6">{renderCenterPanel()}</div>
            </SurfaceCard>

            <PlayerSlotCard slotLabel="Oponente" player={opponentCard} />
          </main>

          <footer className="grid gap-4 xl:grid-cols-[1.18fr,0.82fr] xl:items-stretch">
            <SurfaceCard size="lg">
              <div className="relative z-10 flex h-full flex-col gap-5 text-left">
                <TimerBar
                  secondsLeft={secondsLeft}
                  isActive={gameState?.phase === "playing"}
                  label={gameState?.phase === "playing" ? "Timer da rodada" : "Timer aguardando inicio"}
                />

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="eyebrow">Mobile</p>
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      Textos e cards agora ficam alinhados a esquerda para leitura mais estavel em telas pequenas.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="eyebrow">Servidor unico</p>
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      O Node serve o frontend em producao e mantem o Socket.IO no mesmo dominio.
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="eyebrow">Fluxo</p>
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      Entrou, clicou em Ready, jogou, recebeu resultado e pode iniciar outra rodada.
                    </p>
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard variant={roomVariant} size="lg">
              <div className="relative z-10 flex h-full flex-col justify-between gap-5 text-left">
                <div>
                  <p className="eyebrow">Acao principal</p>
                  <h3 className="mt-3 font-display text-3xl text-white">
                    {isSpectator
                      ? "Sala cheia"
                      : gameState?.phase === "playing"
                        ? submittedSelection || currentPlayer?.submitted
                          ? "Aguardando rival"
                          : "Confirmar jogada"
                        : currentPlayer?.ready
                          ? "Ready enviado"
                          : "Marcar Ready"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-textMuted">
                    O rodape acompanha o estado real da partida e envia a acao correta para o servidor.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={gameState?.phase === "playing" ? "Partida em curso" : "Lobby"}
                    variant={roomVariant}
                    size="sm"
                  />
                  <StatusPill
                    label={isSpectator ? "Somente leitura" : "Jogador ativo"}
                    variant={isSpectator ? "danger" : "success"}
                    size="sm"
                  />
                </div>

                {gameState?.phase === "playing" ? (
                  <PrimaryAction variant="active" disabled={!canSubmit} size="lg" onClick={sendChoice}>
                    {submittedSelection || currentPlayer?.submitted ? "Jogada enviada" : "Confirmar jogada"}
                  </PrimaryAction>
                ) : (
                  <ReadyButton isSynced={Boolean(currentPlayer?.ready)} disabled={!canReady} size="lg" onClick={sendReady}>
                    {currentPlayer?.ready ? "Ready enviado" : "Marcar Ready"}
                  </ReadyButton>
                )}
              </div>
            </SurfaceCard>
          </footer>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
