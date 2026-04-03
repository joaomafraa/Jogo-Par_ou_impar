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
  if (phase === "waiting") return "Aguardando segundo jogador";
  if (phase === "ready") return "Lobby pronto";
  if (phase === "playing") return "Rodada em andamento";
  return "Resultado da rodada";
}

function getResultCopy(reason: NetworkResult["reason"]) {
  if (reason === "submitted") return "As duas jogadas chegaram antes do tempo.";
  if (reason === "timeout") return "O tempo acabou e a rodada foi fechada automaticamente.";
  return "A rodada foi interrompida por desconexao.";
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
          <StatusPill label={`${history.length} registros`} variant="active" size="sm" />
        </div>

        {history.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-5">
            <p className="text-sm leading-6 text-white/72">
              O historico aparece aqui assim que a primeira rodada terminar.
            </p>
          </div>
        ) : (
          <div className="max-h-[26rem] space-y-3 overflow-y-auto pr-1">
            {history.map((item) => (
              <motion.div
                key={`${item.round}-${item.createdAt}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-[22px] border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Round {item.round}</p>
                    <p className="mt-2 text-base font-semibold text-white">
                      {item.winnerName ? `${item.winnerName} venceu` : "Rodada finalizada"}
                    </p>
                  </div>
                  <StatusPill
                    label={`Soma ${item.sum} - ${formatParityLabel(item.parity)}`}
                    variant="success"
                    size="sm"
                  />
                </div>

                <div className="mt-4 space-y-2">
                  {item.players.map((player) => (
                    <div
                      key={`${item.round}-${player.slot}-${player.name}`}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-white">{player.name}</p>
                      <p className="text-sm text-white/68">
                        {formatParityLabel(player.parity)} - {player.number ?? "--"}
                        {player.auto ? " - auto" : ""}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </SurfaceCard>
  );
}

function NameEditor({
  value,
  onChange,
  onSave,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  disabled: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-3 text-left">
        <div>
          <p className="eyebrow">Seu nome</p>
          <p className="mt-2 text-sm leading-6 text-white/72">
            Ajuste o nome antes de marcar ready.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            value={value}
            maxLength={20}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onSave}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSave();
              }
            }}
            className="w-full rounded-[18px] border border-white/10 bg-black/25 px-4 py-3 text-base text-white outline-none transition focus:border-secondary/50 focus:bg-black/35"
            placeholder="Digite seu nome"
          />

          <PrimaryAction variant="active" size="md" disabled={disabled} onClick={onSave}>
            Salvar
          </PrimaryAction>
        </div>
      </div>
    </div>
  );
}

function ReadySummaryCard({
  title,
  name,
  status,
  variant,
}: {
  title: string;
  name: string;
  status: string;
  variant: UiVariant;
}) {
  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-left">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{title}</p>
          <h3 className="mt-2 font-display text-2xl text-white">{name}</h3>
        </div>
        <StatusPill label={status} variant={variant} size="sm" />
      </div>
    </div>
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
  const [draftName, setDraftName] = useState("");
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
    setDraftName((previous) => (previous && previous !== currentPlayer.name ? previous : currentPlayer.name));
  }, [currentPlayer]);

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

  const resultVisual: ResultVisualState | null = useMemo(() => {
    if (!gameState?.result || !currentPlayer) return null;

    const outcome =
      gameState.result.winnerSlot === null
        ? "lose"
        : gameState.result.winnerSlot === currentPlayer.slot
          ? "win"
          : "lose";

    return {
      sum: gameState.result.sum,
      parity: gameState.result.parity,
      outcome,
    };
  }, [currentPlayer, gameState?.result]);

  function sendReady() {
    if (!socketRef.current || !canReady) return;
    socketRef.current.emit("player:ready", { ready: true });
  }

  function saveName() {
    if (!socketRef.current || !currentPlayer || isSpectator || gameState?.phase === "playing") {
      return;
    }

    const trimmed = draftName.replace(/\s+/g, " ").trim().slice(0, 20);
    if (!trimmed || trimmed === currentPlayer.name) {
      setDraftName(currentPlayer.name);
      return;
    }

    socketRef.current.emit("player:set-name", { name: trimmed });
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
      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="grid gap-4">
          <SurfaceCard variant="active" size="lg">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Lobby</p>
                  <h2 className="mt-3 panel-title">{formatPhaseTitle(gameState?.phase || "waiting")}</h2>
                  <p className="mt-3 panel-copy">
                    {gameState?.infoMessage || "Entre na sala, ajuste seu nome e marque ready."}
                  </p>
                </div>
                <StatusPill
                  label={gameState?.players.length === 2 ? "2 jogadores" : "1 jogador"}
                  variant={gameState?.players.length === 2 ? "success" : "active"}
                />
              </div>

              <NameEditor
                value={draftName}
                onChange={setDraftName}
                onSave={saveName}
                disabled={!currentPlayer || Boolean(currentPlayer.ready)}
              />

              <div className="grid gap-3">
                <ReadySummaryCard
                  title="Voce"
                  name={currentPlayer?.name || "Sua vaga"}
                  status={currentPlayer?.ready ? "Ready" : "Aguardando"}
                  variant={currentPlayer?.ready ? "success" : "default"}
                />
                <ReadySummaryCard
                  title="Rival"
                  name={opponentPlayer?.name || "Aguardando rival"}
                  status={
                    !opponentPlayer ? "Sem conexao" : opponentPlayer.ready ? "Ready" : "Aguardando"
                  }
                  variant={!opponentPlayer ? "default" : opponentPlayer.ready ? "success" : "active"}
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
        <SurfaceCard variant={roomVariant} size="lg">
          <div className="relative z-10 flex flex-col gap-5 text-left">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="eyebrow">Rodada</p>
                <h2 className="mt-3 panel-title">Escolha sua jogada</h2>
              </div>
              <StatusPill label={`Round ${gameState?.round || 1}`} variant="active" />
            </div>

            <TimerBar secondsLeft={secondsLeft} maxSeconds={25} isActive label="Tempo da rodada" />
          </div>
        </SurfaceCard>

        <div className="grid gap-4 lg:grid-cols-[0.85fr,1.15fr]">
          <SurfaceCard size="lg" className="bg-black/10">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div>
                <p className="eyebrow">Paridade</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Quem escolhe primeiro fica com o lado.
                </p>
              </div>

              <ParityToggle
                value={selectedParity}
                disabled={!canSubmit || Boolean(parityAssigned)}
                variant="active"
                onChange={handleParityChange}
              />

              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="eyebrow">Seu lado</p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {formatParityLabel(parityAssigned || selectedParity)}
                </p>
              </div>
            </div>
          </SurfaceCard>

          <SurfaceCard size="lg" className="bg-black/10">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div>
                <p className="eyebrow">Numero</p>
                <p className="mt-2 text-sm leading-6 text-textMuted">
                  Escolha de 0 a 5 e confirme.
                </p>
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
                  <p className="eyebrow">Status</p>
                  <p className="mt-3 text-sm leading-6 text-white/74">
                    {submittedSelection || currentPlayer?.submitted
                      ? "Jogada enviada. Aguardando resultado."
                      : "Sua jogada ainda nao foi enviada."}
                  </p>
                </div>
              </div>

              <PrimaryAction variant="active" disabled={!canSubmit} size="lg" onClick={sendChoice}>
                {submittedSelection || currentPlayer?.submitted ? "Aguardando rival" : "Confirmar jogada"}
              </PrimaryAction>
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

        <SurfaceCard size="lg" className="bg-black/10">
          <div className="relative z-10 grid gap-3 text-left md:grid-cols-4">
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
              <p className="eyebrow">Seu numero</p>
              <p className="mt-3 font-display text-4xl text-white">
                {currentPlayer?.selection?.number ?? "--"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
              <p className="eyebrow">Numero rival</p>
              <p className="mt-3 font-display text-4xl text-white">
                {opponentPlayer?.selection?.number ?? "--"}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
              <p className="eyebrow">Paridade final</p>
              <p className="mt-3 text-2xl font-semibold text-white">
                {formatParityLabel(gameState.result.parity)}
              </p>
            </div>
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
              <p className="eyebrow">Resumo</p>
              <p className="mt-3 text-sm leading-6 text-white/74">
                {getResultCopy(gameState.result.reason)}
              </p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard variant="success" size="md" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-4 text-left sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Proxima rodada</p>
              <p className="mt-2 text-sm leading-6 text-white/74">
                Clique em revanche para voltar ao lobby e preparar uma nova partida.
              </p>
            </div>

            <ReadyButton
              isSynced={Boolean(currentPlayer?.ready)}
              disabled={!canReady}
              size="lg"
              onClick={sendReady}
            >
              {currentPlayer?.ready ? "Revanche enviada" : "Pedir revanche"}
            </ReadyButton>
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
          <header className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
            <SurfaceCard variant="active" size="lg">
              <div className="relative z-10 flex flex-col gap-4 text-left">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="eyebrow">Impar ou Par</p>
                    <h1 className="mt-3 font-display text-4xl leading-none text-white sm:text-5xl">
                      Sala unica online
                    </h1>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={gameState?.roomCode || "SALA-01"} variant="active" />
                    <StatusPill
                      label={isConnected ? "Conectado" : "Reconectando"}
                      variant={isConnected ? "success" : "danger"}
                    />
                  </div>
                </div>

                <p className="panel-copy">
                  {gameState?.infoMessage || "Conectando ao servidor para carregar a sala."}
                </p>
              </div>
            </SurfaceCard>

            <SurfaceCard size="md">
              <div className="relative z-10 flex h-full flex-col justify-between gap-4 text-left">
                <div>
                  <p className="eyebrow">Seu status</p>
                  <h2 className="mt-3 font-display text-2xl text-white">
                    {gameState ? formatPhaseTitle(gameState.phase) : "Conectando"}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <StatusPill
                    label={meta?.slot !== null && meta?.slot !== undefined ? `Jogador ${Number(meta.slot) + 1}` : "Sem vaga"}
                    variant={isSpectator ? "danger" : "success"}
                    size="sm"
                  />
                  <StatusPill
                    label={gameState ? `${gameState.players.length}/2 online` : "0/2 online"}
                    variant={gameState?.players.length === 2 ? "success" : "default"}
                    size="sm"
                  />
                </div>
              </div>
            </SurfaceCard>
          </header>

          <main>
            <SurfaceCard variant={roomVariant} size="lg" className="relative">
              <div className="scanline" />
              <div className="relative z-10 flex flex-col gap-6 text-left">
                {!gameState ? (
                  <div className="grid min-h-[22rem] place-items-center text-center">
                    <div className="max-w-md">
                      <p className="eyebrow">Conectando</p>
                      <h2 className="mt-3 panel-title">Entrando na sala</h2>
                      <p className="mt-3 panel-copy">
                        Estamos aguardando o primeiro estado do servidor.
                      </p>
                    </div>
                  </div>
                ) : isSpectator ? (
                  <div className="grid min-h-[22rem] place-items-center text-center">
                    <div className="max-w-lg">
                      <StatusPill label="Sala cheia" variant="danger" />
                      <h2 className="mt-4 panel-title">Os dois lugares ja estao ocupados</h2>
                      <p className="mt-3 panel-copy">
                        Espere uma vaga abrir e recarregue a pagina para entrar.
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
        </motion.div>
      </div>
    </MotionConfig>
  );
}
