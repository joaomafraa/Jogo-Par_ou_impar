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

interface HistoryItem {
  round: number;
  createdAt: number;
  sum: number;
  parity: ParityChoice;
  winnerSlot: number | null;
  winnerName: string | null;
  reason: "submitted" | "timeout" | "disconnect";
  players: Array<{
    slot: number | null;
    name: string;
    number: number | null;
    parity: ParityChoice | null;
    auto: boolean;
  }>;
}

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
  history: HistoryItem[];
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

function formatParityLabel(parity: ParityChoice | null | undefined) {
  if (!parity) return "--";
  return parity === "odd" ? "Impar" : "Par";
}

function formatPhaseTitle(phase: GamePhase) {
  if (phase === "waiting") return "Aguardando o segundo jogador";
  if (phase === "ready") return "Lobby pronto para a rodada";
  if (phase === "playing") return "Escolha da rodada";
  return "Resultado da rodada";
}

function PlayerReadyCard({
  player,
  fallback,
}: {
  player: NetworkPlayer | null;
  fallback: string;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">Jogador</p>
          <h3 className="mt-2 font-display text-2xl text-white">
            {player?.name || fallback}
          </h3>
        </div>
        <StatusPill
          label={
            !player
              ? "Vazio"
              : player.ready
                ? "Ready"
                : player.connected
                  ? "Na sala"
                  : "Offline"
          }
          variant={!player ? "default" : player.ready ? "success" : "active"}
          size="sm"
        />
      </div>

      <p className="mt-4 text-sm leading-6 text-white/74">
        {!player
          ? "Esperando alguem entrar para completar a sala."
          : player.ready
            ? "Pronto para iniciar a proxima rodada."
            : "Conectado e aguardando o clique em Ready."}
      </p>
    </div>
  );
}

function HistoryFeed({ history }: { history: HistoryItem[] }) {
  return (
    <SurfaceCard size="md" className="bg-black/10">
      <div className="relative z-10 flex flex-col gap-4 text-left">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Historico</p>
            <h3 className="mt-2 font-display text-2xl text-white">Ultimas partidas</h3>
          </div>
          <StatusPill label={`${history.length} rodadas`} variant="active" size="sm" />
        </div>

        {history.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-5">
            <p className="text-sm leading-6 text-white/72">
              Assim que a primeira rodada terminar, o historico vai aparecer aqui em tempo real.
            </p>
          </div>
        ) : (
          <div className="max-h-[25rem] space-y-3 overflow-y-auto pr-1">
            {history.map((item) => (
              <div
                key={`${item.round}-${item.createdAt}`}
                className="rounded-[22px] border border-white/10 bg-white/5 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Round {item.round}</p>
                    <p className="mt-2 text-lg font-semibold text-white">
                      {item.winnerName ? `${item.winnerName} venceu` : "Resultado fechado"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={`Soma ${item.sum}`} variant="active" size="sm" />
                    <StatusPill label={formatParityLabel(item.parity)} variant="success" size="sm" />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {item.players.map((player) => (
                    <div
                      key={`${item.round}-${player.slot}-${player.name}`}
                      className="rounded-[18px] border border-white/10 bg-black/20 p-3"
                    >
                      <p className="text-sm font-semibold text-white">{player.name}</p>
                      <p className="mt-2 text-sm text-white/72">
                        Numero {player.number ?? "--"} • {formatParityLabel(player.parity)}
                        {player.auto ? " • auto" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
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

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("player:meta", (payload: PlayerMeta) => setMeta(payload));
    socket.on("game:state", (payload: GameState) => setGameState(payload));

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
    if (!gameState || !meta) return null;
    return gameState.players.find((player) => player.socketId === meta.socketId) || null;
  }, [gameState, meta]);

  const opponentPlayer = useMemo(() => {
    if (!gameState || !meta) return null;
    return gameState.players.find((player) => player.socketId !== meta.socketId) || null;
  }, [gameState, meta]);

  useEffect(() => {
    if (!currentPlayer) return;

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
  const parityAssigned = currentPlayer?.assignedParity ?? null;
  const parityLockedByMe = parityAssigned === selectedParity;

  const resultVisual: ResultVisualState | null = useMemo(() => {
    if (!gameState?.result) return null;

    const currentSlot = currentPlayer?.slot;
    return {
      sum: gameState.result.sum,
      parity: gameState.result.parity,
      outcome: gameState.result.winnerSlot === currentSlot ? "win" : "lose",
    };
  }, [currentPlayer?.slot, gameState?.result]);

  function sendReady() {
    if (!socketRef.current || !canReady) return;
    socketRef.current.emit("player:ready", { ready: true });
  }

  function handleParityChange(nextParity: ParityChoice) {
    setSelectedParity(nextParity);
    if (!socketRef.current || !canSubmit || currentPlayer?.submitted) return;
    socketRef.current.emit("player:pick-parity", { parity: nextParity });
  }

  function sendChoice() {
    if (!socketRef.current || !canSubmit) return;

    socketRef.current.emit("player:submit", {
      number: selectedNumber,
      parity: selectedParity,
    });
    setSubmittedSelection(true);
  }

  function renderReadyScreen() {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
        <div className="grid gap-4">
          <SurfaceCard variant="active" size="lg">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-xl">
                  <p className="eyebrow">Lobby</p>
                  <h2 className="mt-3 panel-title">{formatPhaseTitle(gameState?.phase || "waiting")}</h2>
                  <p className="mt-3 panel-copy">
                    {gameState?.infoMessage ||
                      "Assim que os dois jogadores estiverem prontos, a tela muda para a rodada."}
                  </p>
                </div>
                <StatusPill
                  label={gameState?.players.length === 2 ? "Sala completa" : "Aguardando"}
                  variant={gameState?.players.length === 2 ? "success" : "active"}
                />
              </div>

              <div className="grid gap-3">
                <PlayerReadyCard player={currentPlayer} fallback="Sua vaga" />
                <PlayerReadyCard player={opponentPlayer} fallback="Aguardando rival" />
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard variant={roomVariant} size="lg">
            <div className="relative z-10 flex h-full flex-col justify-between gap-5 text-left">
              <div>
                <p className="eyebrow">Acao principal</p>
                <h3 className="mt-3 font-display text-3xl text-white">
                  {currentPlayer?.ready ? "Ready enviado" : "Marcar Ready"}
                </h3>
                <p className="mt-3 text-sm leading-6 text-textMuted">
                  Quando os dois jogadores clicarem em Ready, a rodada comeca automaticamente.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <StatusPill
                  label={currentPlayer?.ready ? "Voce esta pronto" : "Aguardando seu ready"}
                  variant={currentPlayer?.ready ? "success" : "default"}
                  size="sm"
                />
                <StatusPill
                  label={opponentPlayer?.ready ? "Rival pronto" : "Rival aguardando"}
                  variant={opponentPlayer?.ready ? "success" : "default"}
                  size="sm"
                />
              </div>

              <ReadyButton
                isSynced={Boolean(currentPlayer?.ready)}
                disabled={!canReady}
                size="lg"
                onClick={sendReady}
              >
                {currentPlayer?.ready ? "Ready enviado" : "Marcar Ready"}
              </ReadyButton>
            </div>
          </SurfaceCard>
        </div>

        <HistoryFeed history={gameState?.history || []} />
      </div>
    );
  }

  function renderPlayingScreen() {
    return (
      <div className="grid gap-4">
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 text-left">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="eyebrow">Partida</p>
              <h2 className="mt-3 panel-title">Escolha seu numero e trave a paridade</h2>
              <p className="mt-3 panel-copy">
                O primeiro jogador a escolher impar ou par fica com esse lado. O outro recebe o lado oposto.
              </p>
            </div>
            <StatusPill label={`Round ${gameState?.round || 1}`} variant="active" />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.88fr,1.12fr]">
          <SurfaceCard size="lg" className="bg-black/10">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div>
                <p className="eyebrow">Paridade</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Escolha rapida. Se voce chegar primeiro, esse lado fica travado para a rodada.
                </p>
              </div>

              <ParityToggle
                value={selectedParity}
                disabled={!canSubmit || Boolean(parityAssigned && !parityLockedByMe)}
                variant="active"
                onChange={handleParityChange}
              />

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="eyebrow">Seu lado</p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {parityAssigned ? formatParityLabel(parityAssigned) : "Ainda livre"}
                </p>
                <p className="mt-3 text-sm leading-6 text-white/74">
                  {parityAssigned
                    ? "Seu lado ja foi definido para esta rodada."
                    : "Escolha agora para tentar ficar com o lado desejado."}
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard size="lg" className="bg-black/10">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="eyebrow">Numero</p>
                  <p className="mt-2 text-sm leading-6 text-textMuted">
                    Depois de definir seu numero, confirme a jogada para encerrar sua vez.
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

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="eyebrow">Seu numero</p>
                  <p className="mt-3 font-display text-4xl text-white">{selectedNumber}</p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="eyebrow">Seu lado</p>
                  <p className="mt-3 text-2xl font-semibold text-white">
                    {formatParityLabel(parityAssigned || selectedParity)}
                  </p>
                </div>
                <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                  <p className="eyebrow">Rival</p>
                  <p className="mt-3 text-sm leading-6 text-white/74">
                    {opponentPlayer?.submitted
                      ? "O rival ja enviou a jogada."
                      : "Aguardando a jogada do rival."}
                  </p>
                </div>
              </div>
            </div>
          </SurfaceCard>
        </div>
      </div>
    );
  }

  function renderResultScreen() {
    if (!resultVisual || !gameState?.result) {
      return null;
    }

    return (
      <div className="grid gap-4">
        <ResultBanner
          result={resultVisual}
          playerParity={currentPlayer?.selection?.parity || selectedParity}
        />

        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Seu numero</p>
            <p className="mt-3 font-display text-4xl text-white">
              {currentPlayer?.selection?.number ?? "--"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Numero rival</p>
            <p className="mt-3 font-display text-4xl text-white">
              {opponentPlayer?.selection?.number ?? "--"}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Paridade final</p>
            <p className="mt-3 text-2xl font-semibold text-white">
              {formatParityLabel(gameState.result.parity)}
            </p>
          </div>
          <div className="rounded-[22px] border border-white/10 bg-white/5 p-5 text-left">
            <p className="eyebrow">Fechamento</p>
            <p className="mt-3 text-sm leading-6 text-white/74">
              {gameState.result.reason === "submitted"
                ? "Os dois jogadores enviaram antes do tempo."
                : "A rodada foi fechada pelo cronometro."}
            </p>
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
          <header className="grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
            <SurfaceCard variant="active" size="lg">
              <div className="relative z-10 flex h-full flex-col gap-5 text-left">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="eyebrow">Experiencia da partida</p>
                    <h1 className="mt-3 font-display text-4xl leading-none sm:text-5xl">
                      Impar ou Par
                    </h1>
                    <p className="mt-4 max-w-xl text-sm leading-6 text-textMuted">
                      A jornada agora segue uma ordem direta: tela de ready, tela da rodada e resultado final.
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
                    {gameState ? formatPhaseTitle(gameState.phase) : "Conectando"}
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-white/78">
                    {gameState?.infoMessage ||
                      "Criando conexao com o servidor para carregar a sala."}
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
                  <div className="grid min-h-[22rem] place-items-center text-center">
                    <div className="max-w-md">
                      <p className="eyebrow">Conectando</p>
                      <h2 className="mt-3 panel-title">Entrando na sala</h2>
                      <p className="mt-3 panel-copy">
                        Estamos aguardando o primeiro estado do servidor para montar a partida.
                      </p>
                    </div>
                  </div>
                ) : isSpectator ? (
                  <div className="grid min-h-[22rem] place-items-center text-center">
                    <div className="max-w-lg">
                      <StatusPill label="Sala cheia" variant="danger" />
                      <h2 className="mt-4 panel-title">Os dois lugares ja estao ocupados</h2>
                      <p className="mt-3 panel-copy">
                        Espere uma vaga abrir e recarregue a pagina para entrar no lobby.
                      </p>
                    </div>
                  </div>
                ) : gameState.phase === "playing" ? (
                  renderPlayingScreen()
                ) : gameState.phase === "result" ? (
                  renderResultScreen()
                ) : (
                  renderReadyScreen()
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
                      {formatParityLabel(currentPlayer?.assignedParity || null)}
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
                    <p className="mt-3 text-sm leading-6 text-white/74">
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
                    {gameState?.phase === "playing"
                      ? "Confirme sua jogada para entrar na fase de resultado."
                      : "Use o Ready para entrar na proxima rodada."}
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
