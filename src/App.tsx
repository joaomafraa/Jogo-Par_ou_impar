import { MotionConfig, motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { PrimaryAction, ReadyButton } from "./components/ui/ActionButton";
import { NumberOrb } from "./components/ui/NumberOrb";
import { ParityToggle } from "./components/ui/ParityToggle";
import { ResultBanner } from "./components/ui/ResultBanner";
import { StatusPill } from "./components/ui/StatusPill";
import { SurfaceCard } from "./components/ui/SurfaceCard";
import { TimerBar } from "./components/ui/TimerBar";
import type { ParityChoice, ResultVisualState, UiVariant } from "./components/ui/types";

type GamePhase = "waiting" | "ready" | "playing" | "result";

interface NetworkPlayer {
  id: string;
  socketId: string;
  slot: number | null;
  spectator: boolean;
  connected: boolean;
  ready: boolean;
  submitted: boolean;
  assignedParity: ParityChoice | null;
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
const defaultParity: ParityChoice = "odd";

function deriveSecondsLeft(gameState: GameState | null, now: number) {
  if (!gameState?.deadlineAt) {
    return 0;
  }

  return Math.max(Math.ceil((gameState.deadlineAt - now) / 1000), 0);
}

function getRoomVariant(phase: GamePhase, secondsLeft: number): UiVariant {
  if (phase === "result" || phase === "ready") {
    return "success";
  }

  if (phase === "playing") {
    return secondsLeft <= 5 ? "danger" : "active";
  }

  return "active";
}

function getPhaseTitle(phase: GamePhase) {
  if (phase === "waiting") return "Aguardando o segundo jogador";
  if (phase === "ready") return "Jogadores prontos";
  if (phase === "playing") return "Faça sua escolha";
  return "Resultado da rodada";
}

function getPhaseCopy(phase: GamePhase, isSpectator: boolean) {
  if (isSpectator) {
    return "A sala ja esta ocupada. Assim que uma vaga abrir, recarregue a pagina para entrar.";
  }

  if (phase === "waiting") {
    return "Assim que outro jogador entrar, os dois poderao marcar Ready para iniciar.";
  }

  if (phase === "ready") {
    return "A rodada vai abrir em instantes. Prepare seu numero e a paridade desejada.";
  }

  if (phase === "playing") {
    return "Quem escolhe impar ou par primeiro fica com a paridade. O outro jogador recebe o lado oposto.";
  }

  return "A rodada terminou. Veja o resultado e marque Ready para jogar novamente.";
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const [meta, setMeta] = useState<PlayerMeta | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [selectedParity, setSelectedParity] = useState<ParityChoice>(defaultParity);
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

    return gameState.players.find((player) => player.socketId !== meta.socketId) || null;
  }, [gameState, meta]);

  useEffect(() => {
    if (!currentPlayer) {
      return;
    }

    if (currentPlayer.assignedParity) {
      setSelectedParity(currentPlayer.assignedParity);
    } else if (gameState?.phase !== "playing") {
      setSelectedParity(defaultParity);
    }
  }, [currentPlayer, gameState?.phase]);

  useEffect(() => {
    if (gameState?.phase !== "playing") {
      setSubmittedSelection(false);
      setSelectedNumber(0);
    }
  }, [gameState?.phase]);

  const secondsLeft = deriveSecondsLeft(gameState, now);
  const roomVariant = getRoomVariant(gameState?.phase || "waiting", secondsLeft);
  const isSpectator = meta?.spectator ?? false;
  const canReady =
    Boolean(currentPlayer) &&
    !isSpectator &&
    gameState?.phase !== "playing" &&
    !currentPlayer?.ready;
  const canSubmit =
    Boolean(currentPlayer) &&
    !isSpectator &&
    gameState?.phase === "playing" &&
    !submittedSelection &&
    !currentPlayer?.submitted;
  const parityLockedByMe = currentPlayer?.assignedParity === selectedParity;
  const parityAssigned = currentPlayer?.assignedParity ?? null;

  const resultVisual: ResultVisualState | null = useMemo(() => {
    if (!gameState?.result) {
      return null;
    }

    const currentSlot = currentPlayer?.slot;
    const outcome =
      gameState.result.winnerSlot === currentSlot
        ? "win"
        : "lose";

    return {
      sum: gameState.result.sum,
      parity: gameState.result.parity,
      outcome,
    };
  }, [currentPlayer?.slot, gameState?.result]);

  function handleParityChange(nextParity: ParityChoice) {
    setSelectedParity(nextParity);

    if (!socketRef.current || !canSubmit || currentPlayer?.submitted) {
      return;
    }

    socketRef.current.emit("player:pick-parity", {
      parity: nextParity,
    });
  }

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

  function renderResultPanel() {
    if (!gameState?.result || !resultVisual) {
      return null;
    }

    return (
      <div className="grid gap-4">
        <ResultBanner result={resultVisual} playerParity={currentPlayer?.selection?.parity || selectedParity} />

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Seu numero</p>
            <p className="mt-3 font-display text-4xl text-white">
              {currentPlayer?.selection?.number ?? "--"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Paridade final</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {gameState.result.parity === "odd" ? "Impar" : "Par"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Numero do rival</p>
            <p className="mt-3 font-display text-4xl text-white">
              {opponentPlayer?.selection?.number ?? "--"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  function renderChoicePanel() {
    return (
      <div className="grid gap-5">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow">Sua vez</p>
              <h2 className="mt-3 panel-title">Escolha um numero e confirme sua jogada</h2>
              <p className="mt-3 panel-copy">
                Esta tela mostra apenas a sua escolha. O resultado aparece para os dois quando a rodada fechar.
              </p>
            </div>
            <StatusPill label={`25s max`} variant={roomVariant} />
          </div>
        </div>

        <SurfaceCard size="md" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Paridade</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Quem escolher primeiro fica com a paridade. O outro jogador recebe automaticamente o lado oposto.
                </p>
              </div>
              <StatusPill
                label={
                  parityAssigned
                    ? `Seu lado: ${parityAssigned === "odd" ? "Impar" : "Par"}`
                    : "Ainda livre"
                }
                variant={parityAssigned ? "success" : "active"}
                size="sm"
              />
            </div>

            <ParityToggle
              value={selectedParity}
              disabled={!canSubmit || Boolean(parityAssigned && !parityLockedByMe)}
              variant="active"
              onChange={handleParityChange}
            />

            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4 text-left">
              <p className="eyebrow">Resumo da paridade</p>
              <p className="mt-3 text-sm leading-6 text-white/78">
                {parityAssigned
                  ? `Seu lado nesta rodada ficou travado em ${parityAssigned === "odd" ? "Impar" : "Par"}.`
                  : "Escolha impar ou par para tentar travar esse lado antes do rival."}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard size="md" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-4 text-left">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Numero</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Selecione seu numero de 0 a 5 e envie quando estiver pronto.
                </p>
              </div>
              <StatusPill
                label={submittedSelection || currentPlayer?.submitted ? "Enviado" : "Pendente"}
                variant={submittedSelection || currentPlayer?.submitted ? "success" : "default"}
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
          <header className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <SurfaceCard variant="active" size="lg">
              <div className="relative z-10 flex h-full flex-col gap-5 text-left">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="eyebrow">Sala unica online</p>
                    <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
                      Impar ou Par
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-textMuted">
                      Cada jogador ve apenas a propria tela de escolha durante a rodada e o resultado final quando o servidor fecha a soma.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={gameState?.roomCode || "SALA-01"} variant="active" />
                    <StatusPill
                      label={meta?.slot !== null && meta?.slot !== undefined ? `Jogador ${Number(meta.slot) + 1}` : "Sem vaga"}
                      variant={isSpectator ? "danger" : "success"}
                    />
                    <StatusPill
                      label={isConnected ? "Conectado" : "Reconectando"}
                      variant={isConnected ? "success" : "danger"}
                    />
                  </div>
                </div>
              </div>
            </SurfaceCard>

            <SurfaceCard size="md">
              <div className="relative z-10 flex h-full flex-col justify-between gap-5 text-left">
                <div>
                  <p className="eyebrow">Fase atual</p>
                  <h2 className="mt-3 font-display text-2xl text-white">
                    {gameState ? getPhaseTitle(gameState.phase) : "Conectando"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/78">
                    {gameState ? getPhaseCopy(gameState.phase, isSpectator) : "Criando conexao com o servidor da partida."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={gameState ? `${gameState.players.length}/2 online` : "0/2 online"}
                    variant={gameState?.players.length === 2 ? "success" : "default"}
                    size="sm"
                  />
                  <StatusPill
                    label={currentPlayer?.ready ? "Ready ligado" : "Ready desligado"}
                    variant={currentPlayer?.ready ? "success" : "default"}
                    size="sm"
                  />
                </div>
              </div>
            </SurfaceCard>
          </header>

          <main className="grid gap-4">
            <SurfaceCard variant={roomVariant} size="lg" className="relative">
              <div className="scanline" />

              <div className="relative z-10 flex flex-col gap-6 text-left">
                {!gameState ? (
                  <div className="grid min-h-[22rem] place-items-center">
                    <div className="max-w-md text-center">
                      <p className="eyebrow">Conectando</p>
                      <h2 className="mt-3 panel-title">Entrando na sala</h2>
                      <p className="mt-3 panel-copy">
                        Estamos aguardando a resposta do servidor para carregar a sua vaga.
                      </p>
                    </div>
                  </div>
                ) : isSpectator ? (
                  <div className="grid min-h-[22rem] place-items-center">
                    <div className="max-w-lg text-center">
                      <StatusPill label="Sala cheia" variant="danger" />
                      <h2 className="mt-4 panel-title">Os dois jogadores ja estao em partida</h2>
                      <p className="mt-3 panel-copy">
                        Espere uma vaga abrir e recarregue a pagina para entrar no lugar de um jogador.
                      </p>
                    </div>
                  </div>
                ) : gameState.phase === "result" ? (
                  renderResultPanel()
                ) : (
                  renderChoicePanel()
                )}
              </div>
            </SurfaceCard>
          </main>

          <footer className="grid gap-4 lg:grid-cols-[1.15fr,0.85fr]">
            <SurfaceCard size="lg">
              <div className="relative z-10 flex h-full flex-col gap-5 text-left">
                <TimerBar
                  secondsLeft={secondsLeft}
                  maxSeconds={25}
                  isActive={gameState?.phase === "playing"}
                  label={gameState?.phase === "playing" ? "Timer da rodada" : "Timer aguardando inicio"}
                />

                <div className="grid gap-3 md:grid-cols-3">
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="eyebrow">Seu lado</p>
                    <p className="mt-3 text-xl font-semibold text-white">
                      {currentPlayer?.assignedParity
                        ? currentPlayer.assignedParity === "odd"
                          ? "Impar"
                          : "Par"
                        : "Ainda livre"}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="eyebrow">Seu numero</p>
                    <p className="mt-3 font-display text-4xl text-white">
                      {currentPlayer?.selection?.number ?? selectedNumber}
                    </p>
                  </div>
                  <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                    <p className="eyebrow">Rival</p>
                    <p className="mt-3 text-sm leading-6 text-white/78">
                      {opponentPlayer?.submitted
                        ? "O rival ja enviou a jogada."
                        : opponentPlayer?.ready
                          ? "O rival esta pronto."
                          : "Aguardando atualizacao do rival."}
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
                          ? "Aguardando resultado"
                          : "Enviar jogada"
                        : currentPlayer?.ready
                          ? "Ready enviado"
                          : "Marcar Ready"}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-textMuted">
                    {gameState?.infoMessage || "Assim que os dois estiverem na sala, o jogo pode comecar."}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={gameState?.phase === "playing" ? "Rodada aberta" : "Lobby"}
                    variant={roomVariant}
                    size="sm"
                  />
                  <StatusPill
                    label={submittedSelection || currentPlayer?.submitted ? "Jogada enviada" : "Sem envio"}
                    variant={submittedSelection || currentPlayer?.submitted ? "success" : "default"}
                    size="sm"
                  />
                </div>

                {gameState?.phase === "playing" ? (
                  <PrimaryAction variant="active" disabled={!canSubmit} size="lg" onClick={sendChoice}>
                    {submittedSelection || currentPlayer?.submitted ? "Aguardando rival" : "Confirmar jogada"}
                  </PrimaryAction>
                ) : (
                  <ReadyButton
                    isSynced={Boolean(currentPlayer?.ready)}
                    disabled={!canReady}
                    size="lg"
                    onClick={sendReady}
                  >
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
