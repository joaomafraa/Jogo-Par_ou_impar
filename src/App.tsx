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

type AppView = "home" | "joining" | "in-room" | "expired";
type GamePhase = "waiting" | "ready" | "playing" | "result";
type GameModeKey = "odd-even" | "rps";
type RpsChoice = "rock" | "paper" | "scissors";

interface HistoryItem {
  round: number;
  mode: GameModeKey;
  createdAt: number;
  sum: number | null;
  parity: ParityChoice | null;
  winnerSlot: number | null;
  winnerName: string | null;
  reason: "submitted" | "timeout" | "disconnect";
  players: Array<{
    slot: number | null;
    name: string;
    number: number | null;
    parity: ParityChoice | null;
    choice: RpsChoice | null;
    auto: boolean;
  }>;
}

interface NetworkSelection {
  number: number | null;
  parity: ParityChoice | null;
  choice: RpsChoice | null;
  auto: boolean;
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
  selection: NetworkSelection | null;
  name: string;
}

interface NetworkResult {
  mode: GameModeKey;
  sum: number | null;
  parity: ParityChoice | null;
  winnerSlot: number | null;
  reason: "submitted" | "timeout" | "disconnect";
  outcome: "win" | "draw";
}

interface GameState {
  phase: GamePhase;
  round: number;
  roomCode: string;
  mode: GameModeKey;
  modeConfirmedSlots: number[];
  serverTime: number;
  deadlineAt: number | null;
  result: NetworkResult | null;
  history: HistoryItem[];
  infoMessage: string;
  players: NetworkPlayer[];
  spectatorCount?: number;
}

interface PlayerMeta {
  socketId: string;
  slot: number | null;
  spectator: boolean;
  roomCode: string;
}

const socketUrl = import.meta.env.VITE_SOCKET_URL || undefined;
const defaultParity: ParityChoice = "odd";

function getRoomCodeFromPath() {
  const match = window.location.pathname.match(/^\/sala\/([A-Za-z0-9_-]+)$/);
  return match?.[1]?.toUpperCase() || null;
}

function buildRoomLink(roomCode: string) {
  return `${window.location.origin}/sala/${roomCode}`;
}

function navigateToRoom(roomCode: string) {
  window.history.pushState({}, "", `/sala/${roomCode}`);
}

function navigateHome() {
  window.history.pushState({}, "", "/");
}

function deriveSecondsLeft(gameState: GameState | null, now: number) {
  if (!gameState?.deadlineAt) return 0;
  return Math.max(Math.ceil((gameState.deadlineAt - now) / 1000), 0);
}

function getRoomVariant(phase: GamePhase, secondsLeft: number): UiVariant {
  if (phase === "result" || phase === "ready") return "success";
  if (phase === "playing") return secondsLeft <= 5 ? "danger" : "active";
  return "active";
}

function formatParityLabel(parity: ParityChoice | null | undefined) {
  if (!parity) return "--";
  return parity === "odd" ? "Impar" : "Par";
}

function formatPhaseTitle(phase: GamePhase) {
  if (phase === "waiting") return "Aguardando segundo jogador";
  if (phase === "ready") return "Sala pronta";
  if (phase === "playing") return "Rodada em andamento";
  return "Resultado da rodada";
}

function formatModeLabel(mode: GameModeKey) {
  return mode === "rps" ? "Pedra Papel Tesoura" : "Impar ou Par";
}

function formatRpsChoice(choice: RpsChoice | null | undefined) {
  if (!choice) return "--";
  if (choice === "rock") return "Pedra";
  if (choice === "paper") return "Papel";
  return "Tesoura";
}

function getResultCopy(reason: NetworkResult["reason"]) {
  if (reason === "submitted") return "As duas jogadas chegaram antes do tempo.";
  if (reason === "timeout") return "O tempo acabou e a rodada foi fechada automaticamente.";
  return "A rodada foi interrompida por desconexao.";
}

function OddEvenIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="8" cy="12" r="3.5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="16.5" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.6" opacity="0.9" />
      <circle cx="16.5" cy="16" r="2.5" stroke="currentColor" strokeWidth="1.6" opacity="0.55" />
    </svg>
  );
}

function RpsModeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" aria-hidden="true">
      <circle cx="6.7" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M11 6.2h4.5l1.6 1.6v3.5H11z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M7.6 16.8l2.2-2.2 1.9 1.9-2.2 2.2c-.5.5-1.4.5-1.9 0s-.5-1.4 0-1.9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.2 14.1l4.1 4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function RockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path d="M7 14.8c0-2 1.5-3.6 3.4-3.6h3.2c1.9 0 3.4 1.6 3.4 3.6v.8c0 1.8-1.4 3.2-3.2 3.2H10.2c-1.8 0-3.2-1.4-3.2-3.2z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.6 11V8.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 10.8V7.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M14.4 11.2V8.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PaperIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <path d="M8 5.8h6l3 3v9.4c0 1-.8 1.8-1.8 1.8H8c-1 0-1.8-.8-1.8-1.8V7.6C6.2 6.6 7 5.8 8 5.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 5.8v3.6h3" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9.4 12h4.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M9.4 15h5.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function ScissorsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" aria-hidden="true">
      <circle cx="8" cy="16.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="7.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M10.2 9.1 18 4.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10.2 14.9 18 19.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
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
          <StatusPill label={`${history.length} registros`} variant="active" size="sm" />
        </div>
        {history.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-white/12 bg-white/5 p-5">
            <p className="text-sm leading-6 text-white/72">O historico aparece aqui assim que a primeira rodada terminar.</p>
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
                    <p className="mt-2 text-base font-semibold text-white">{item.winnerName ? `${item.winnerName} venceu` : "Rodada finalizada"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <StatusPill label={formatModeLabel(item.mode)} variant="active" size="sm" />
                    {item.mode === "odd-even" ? <StatusPill label={`Soma ${item.sum} - ${formatParityLabel(item.parity)}`} variant="success" size="sm" /> : null}
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {item.players.map((player) => (
                    <div
                      key={`${item.round}-${player.slot}-${player.name}`}
                      className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <p className="text-sm font-medium text-white">{player.name}</p>
                      <p className="text-sm text-white/68">
                        {item.mode === "rps"
                          ? `${formatRpsChoice(player.choice)}${player.auto ? " - auto" : ""}`
                          : `${formatParityLabel(player.parity)} - ${player.number ?? "--"}${player.auto ? " - auto" : ""}`}
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
          <p className="mt-2 text-sm leading-6 text-white/72">Ajuste o nome antes de marcar pronto.</p>
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

function ModeConfirmCard({
  mode,
  confirmedSlots,
  currentSlot,
  canConfirm,
  onConfirm,
}: {
  mode: GameModeKey;
  confirmedSlots: number[];
  currentSlot: number | null | undefined;
  canConfirm: boolean;
  onConfirm: () => void;
}) {
  const selfConfirmed = currentSlot !== null && currentSlot !== undefined && confirmedSlots.includes(currentSlot);
  const bothConfirmed = confirmedSlots.length === 2;

  return (
    <div className="rounded-[24px] border border-white/10 bg-white/5 p-5">
      <div className="flex flex-col gap-4 text-left">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Modo da sala</p>
            <h3 className="mt-2 font-display text-2xl text-white">{formatModeLabel(mode)}</h3>
            <p className="mt-3 text-sm leading-6 text-white/72">
              Os dois jogadores precisam confirmar o modo antes de marcar pronto.
            </p>
          </div>
          <StatusPill label={bothConfirmed ? "Confirmado" : "Pendente"} variant={bothConfirmed ? "success" : "active"} size="sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusPill label={confirmedSlots.includes(0) ? "Jogador 1 confirmou" : "Jogador 1 pendente"} variant={confirmedSlots.includes(0) ? "success" : "default"} size="sm" />
          <StatusPill label={confirmedSlots.includes(1) ? "Jogador 2 confirmou" : "Jogador 2 pendente"} variant={confirmedSlots.includes(1) ? "success" : "default"} size="sm" />
        </div>
        <PrimaryAction variant={selfConfirmed ? "success" : "active"} size="md" disabled={!canConfirm || selfConfirmed} onClick={onConfirm}>
          {selfConfirmed ? "Modo confirmado" : "Confirmar modo"}
        </PrimaryAction>
      </div>
    </div>
  );
}

function RpsChoiceCard({
  choice,
  selected,
  disabled,
  onSelect,
}: {
  choice: RpsChoice;
  selected: boolean;
  disabled: boolean;
  onSelect: (choice: RpsChoice) => void;
}) {
  const label = formatRpsChoice(choice);
  const Icon = choice === "rock" ? RockIcon : choice === "paper" ? PaperIcon : ScissorsIcon;

  return (
    <motion.button
      type="button"
      whileHover={disabled ? undefined : { y: -4, scale: 1.02 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      className={`rps-card ${selected ? "rps-card--active" : ""}`}
      disabled={disabled}
      onClick={() => onSelect(choice)}
    >
      <div className="rps-card-icon">
        <Icon />
      </div>
      <div className="text-center">
        <p className="font-display text-2xl text-white">{label}</p>
        <p className="mt-1 text-sm text-white/64">Escolha rapida</p>
      </div>
    </motion.button>
  );
}

function RpsResultPanel({
  currentPlayer,
  opponentPlayer,
  gameState,
}: {
  currentPlayer: NetworkPlayer | null;
  opponentPlayer: NetworkPlayer | null;
  gameState: GameState;
}) {
  const isDraw = gameState.result?.outcome === "draw";
  const isWin = currentPlayer && gameState.result?.winnerSlot === currentPlayer.slot;
  const variant = isDraw ? "active" : isWin ? "success" : "danger";
  const title = isDraw ? "Empate" : isWin ? "Voce venceu" : "Voce perdeu";

  return (
    <SurfaceCard variant={variant} size="lg">
      <div className="relative z-10 flex flex-col gap-5 text-left">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill label={title} variant={variant} />
          <StatusPill label={formatModeLabel(gameState.mode)} variant="active" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <motion.div
            initial={{ opacity: 0, x: -16, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5"
          >
            <p className="eyebrow">Sua escolha</p>
            <div className="mt-4 flex items-center gap-4 text-white">
              <div className="rps-card-icon">{currentPlayer?.selection?.choice === "rock" ? <RockIcon /> : currentPlayer?.selection?.choice === "paper" ? <PaperIcon /> : <ScissorsIcon />}</div>
              <div>
                <p className="font-display text-3xl">{formatRpsChoice(currentPlayer?.selection?.choice)}</p>
                <p className="mt-1 text-sm text-white/68">{currentPlayer?.name || "Voce"}</p>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 16, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            className="rounded-[24px] border border-white/10 bg-white/5 p-5"
          >
            <p className="eyebrow">Escolha rival</p>
            <div className="mt-4 flex items-center gap-4 text-white">
              <div className="rps-card-icon">{opponentPlayer?.selection?.choice === "rock" ? <RockIcon /> : opponentPlayer?.selection?.choice === "paper" ? <PaperIcon /> : <ScissorsIcon />}</div>
              <div>
                <p className="font-display text-3xl">{formatRpsChoice(opponentPlayer?.selection?.choice)}</p>
                <p className="mt-1 text-sm text-white/68">{opponentPlayer?.name || "Rival"}</p>
              </div>
            </div>
          </motion.div>
        </div>
        <p className="text-sm leading-6 text-white/74">{getResultCopy(gameState.result?.reason || "submitted")}</p>
      </div>
    </SurfaceCard>
  );
}

function ModeSidebar({
  currentMode,
  confirmedSlots,
  currentSlot,
  interactive,
  onSelect,
}: {
  currentMode: GameModeKey;
  confirmedSlots: number[];
  currentSlot: number | null | undefined;
  interactive: boolean;
  onSelect: (mode: GameModeKey) => void;
}) {
  const playerConfirmed = currentSlot !== null && currentSlot !== undefined && confirmedSlots.includes(currentSlot);
  const modes: Array<{ key: GameModeKey; label: string }> = [
    { key: "odd-even", label: "Impar ou Par" },
    { key: "rps", label: "Pedra Papel Tesoura" },
  ];

  return (
    <aside className="mode-sidebar">
      <span className="mode-sidebar-label">Jogos</span>
      <nav className="mode-nav" aria-label="Modos de jogo">
        {modes.map((mode) => {
          const isActive = currentMode === mode.key;
          return (
            <button
              key={mode.key}
              type="button"
              disabled={!interactive}
              className={`mode-link ${isActive ? "mode-link--active" : "mode-link--soon"} ${isActive && playerConfirmed ? "mode-link--confirmed" : ""}`}
              aria-label={mode.label}
              title={mode.label}
              onClick={() => onSelect(mode.key)}
            >
              <span className={`mode-link-icon ${isActive ? "text-accent shadow-[0_0_18px_rgba(0,255,163,0.18)]" : "text-secondary"}`}>
                {mode.key === "odd-even" ? <OddEvenIcon /> : <RpsModeIcon />}
              </span>
              <span className="mode-link-text">{isActive ? "Ativo" : "Modo"}</span>
              <span className="mode-tooltip">{mode.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export default function App() {
  const socketRef = useRef<Socket | null>(null);
  const pendingCreateRef = useRef(false);
  const attemptedJoinRef = useRef<string | null>(null);
  const [appView, setAppView] = useState<AppView>(getRoomCodeFromPath() ? "joining" : "home");
  const [meta, setMeta] = useState<PlayerMeta | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(0);
  const [selectedParity, setSelectedParity] = useState<ParityChoice>(defaultParity);
  const [selectedRps, setSelectedRps] = useState<RpsChoice>("rock");
  const [submittedSelection, setSubmittedSelection] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [systemMessage, setSystemMessage] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const roomCodeFromUrl = useMemo(() => getRoomCodeFromPath(), [appView]);

  useEffect(() => {
    const socket = io(socketUrl, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.on("player:meta", (payload: PlayerMeta) => {
      setMeta(payload);
      setAppView("in-room");
    });
    socket.on("game:state", (payload: GameState) => {
      setGameState(payload);
      setAppView("in-room");
    });
    socket.on("room:created", (payload: { roomCode: string }) => {
      navigateToRoom(payload.roomCode);
      attemptedJoinRef.current = payload.roomCode;
      setSystemMessage("Sala criada. Compartilhe o link para chamar outro jogador.");
      setAppView("in-room");
    });
    socket.on("room:joined", () => {
      setSystemMessage(null);
      setAppView("in-room");
    });
    socket.on("room:left", () => {
      setMeta(null);
      setGameState(null);
      attemptedJoinRef.current = null;
      navigateHome();
      setAppView("home");
      setSystemMessage("Voce saiu da sala.");
    });
    socket.on("room:error", (payload: { message: string }) => {
      setSystemMessage(payload.message);
      setMeta(null);
      setGameState(null);
      attemptedJoinRef.current = null;
      navigateHome();
      setAppView("home");
    });
    socket.on("room:expired", (payload: { message: string }) => {
      setSystemMessage(payload.message);
      setMeta(null);
      setGameState(null);
      attemptedJoinRef.current = null;
      navigateHome();
      setAppView("expired");
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      attemptedJoinRef.current = null;
      const nextRoomCode = getRoomCodeFromPath();
      setMeta(null);
      setGameState(null);
      setSystemMessage(null);
      setAppView(nextRoomCode ? "joining" : "home");
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    const intervalMs = gameState?.phase === "playing" ? 40 : 250;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [gameState?.phase]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !isConnected) return;

    if (pendingCreateRef.current) {
      pendingCreateRef.current = false;
      socket.emit("room:create");
      return;
    }

    if (roomCodeFromUrl && attemptedJoinRef.current !== roomCodeFromUrl && !meta?.roomCode) {
      attemptedJoinRef.current = roomCodeFromUrl;
      socket.emit("room:join", { roomCode: roomCodeFromUrl });
    }
  }, [isConnected, meta?.roomCode, roomCodeFromUrl]);

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
      setSelectedRps("rock");
    }
  }, [gameState?.phase, gameState?.mode]);

  const secondsLeft = deriveSecondsLeft(gameState, now);
  const roomVariant = getRoomVariant(gameState?.phase || "waiting", secondsLeft);
  const isSpectator = meta?.spectator ?? false;
  const currentSlot = meta?.slot;
  const modeConfirmed = Boolean(gameState && gameState.modeConfirmedSlots.includes(0) && gameState.modeConfirmedSlots.includes(1));
  const currentConfirmed = currentSlot !== null && currentSlot !== undefined && Boolean(gameState?.modeConfirmedSlots.includes(currentSlot));
  const canReady =
    Boolean(currentPlayer) &&
    !isSpectator &&
    modeConfirmed &&
    gameState?.phase !== "playing" &&
    !currentPlayer?.ready;
  const canSubmit =
    Boolean(currentPlayer) &&
    !isSpectator &&
    gameState?.phase === "playing" &&
    !submittedSelection &&
    !currentPlayer?.submitted;
  const parityAssigned = currentPlayer?.assignedParity ?? null;
  const roomLink = meta?.roomCode ? buildRoomLink(meta.roomCode) : roomCodeFromUrl ? buildRoomLink(roomCodeFromUrl) : "";

  const resultVisual: ResultVisualState | null = useMemo(() => {
    if (!gameState?.result || !currentPlayer || gameState.mode !== "odd-even" || !gameState.result.parity || gameState.result.sum === null) {
      return null;
    }

    const outcome =
      gameState.result.winnerSlot === null
        ? "draw"
        : gameState.result.winnerSlot === currentPlayer.slot
          ? "win"
          : "lose";

    return {
      sum: gameState.result.sum,
      parity: gameState.result.parity,
      outcome,
    };
  }, [currentPlayer, gameState]);

  function ensureConnected() {
    const socket = socketRef.current;
    if (!socket) return;
    if (!socket.connected) socket.connect();
  }

  function handleCreateRoom() {
    setSystemMessage(null);
    setAppView("joining");
    pendingCreateRef.current = true;
    attemptedJoinRef.current = null;
    const socket = socketRef.current;
    if (!socket) return;

    if (socket.connected) {
      pendingCreateRef.current = false;
      socket.emit("room:create");
      return;
    }

    ensureConnected();
  }

  function handleLeaveRoom() {
    socketRef.current?.emit("room:leave");
  }

  function handleSelectMode(mode: GameModeKey) {
    if (!socketRef.current || !gameState || isSpectator || gameState.phase === "playing") return;
    socketRef.current.emit("room:set-mode", { mode });
  }

  function handleConfirmMode() {
    if (!socketRef.current || !gameState || isSpectator || gameState.phase === "playing") return;
    socketRef.current.emit("room:confirm-mode");
  }

  function copyRoomLink() {
    if (!roomLink) return;
    navigator.clipboard.writeText(roomLink).then(() => {
      setSystemMessage("Link da sala copiado.");
    }).catch(() => {
      setSystemMessage("Nao foi possivel copiar o link agora.");
    });
  }

  function sendReady() {
    if (!socketRef.current || !canReady) return;
    socketRef.current.emit("player:ready", { ready: true });
  }

  function saveName() {
    if (!socketRef.current || !currentPlayer || isSpectator || gameState?.phase === "playing") return;
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

  function sendOddEvenChoice() {
    if (!socketRef.current || !canSubmit) return;
    socketRef.current.emit("player:submit", {
      number: selectedNumber,
      parity: selectedParity,
    });
    setSubmittedSelection(true);
  }

  function sendRpsChoice() {
    if (!socketRef.current || !canSubmit) return;
    socketRef.current.emit("player:submit-rps", {
      choice: selectedRps,
    });
    setSubmittedSelection(true);
  }

  function renderHomeScreen() {
    return (
      <div className="grid gap-4 lg:grid-cols-[1.05fr,0.95fr]">
        <SurfaceCard variant="active" size="lg">
          <div className="relative z-10 flex h-full flex-col justify-between gap-6 text-left">
            <div>
              <p className="eyebrow">Entrada</p>
              <h2 className="mt-3 panel-title">Crie uma sala e envie o link</h2>
              <p className="mt-3 panel-copy">
                Agora voce pode jogar Impar ou Par e Pedra, Papel e Tesoura na mesma plataforma, escolhendo o modo dentro da sala.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusPill label="1 sala por link" variant="active" size="sm" />
              <StatusPill label="2 jogadores" variant="success" size="sm" />
              <StatusPill label="2 modos" variant="active" size="sm" />
            </div>
            <PrimaryAction variant="active" size="lg" onClick={handleCreateRoom}>
              Criar sala
            </PrimaryAction>
          </div>
        </SurfaceCard>

        <SurfaceCard size="lg" className="bg-black/10">
          <div className="relative z-10 flex h-full flex-col gap-5 text-left">
            <div>
              <p className="eyebrow">Como funciona</p>
              <h3 className="mt-3 font-display text-3xl text-white">Fluxo rapido</h3>
            </div>
            <div className="grid gap-3">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">1. Criar sala</p>
                <p className="mt-2 text-sm leading-6 text-white/72">Voce gera um link unico para jogar online.</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">2. Escolher o modo</p>
                <p className="mt-2 text-sm leading-6 text-white/72">Os dois jogadores confirmam o modo antes de marcar pronto.</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                <p className="text-sm font-semibold text-white">3. Jogar</p>
                <p className="mt-2 text-sm leading-6 text-white/72">A sala mantém o fluxo online e o histórico das rodadas.</p>
              </div>
            </div>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  function renderJoiningScreen() {
    return (
      <div className="grid min-h-[28rem] place-items-center text-center">
        <div className="max-w-xl">
          <StatusPill label="Entrando na sala" variant="active" />
          <h2 className="mt-4 panel-title">
            {roomCodeFromUrl ? `Conectando a sala ${roomCodeFromUrl}` : "Preparando sua sala"}
          </h2>
          <p className="mt-3 panel-copy">
            {roomCodeFromUrl
              ? "Estamos validando o link e tentando entrar na sala."
              : "Criando uma nova sala para voce compartilhar."}
          </p>
        </div>
      </div>
    );
  }

  function renderReadyScreen() {
    return (
      <div className="grid gap-4 xl:grid-cols-[0.95fr,1.05fr]">
        <div className="grid gap-4">
          <SurfaceCard variant="active" size="lg">
            <div className="relative z-10 flex flex-col gap-5 text-left">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Sala criada</p>
                  <h2 className="mt-3 panel-title">{formatPhaseTitle(gameState?.phase || "waiting")}</h2>
                  <p className="mt-3 panel-copy">
                    {gameState?.infoMessage || "Compartilhe o link, confirme o modo e aguarde o segundo jogador entrar."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <StatusPill label={formatModeLabel(gameState?.mode || "odd-even")} variant="active" />
                  <StatusPill label={gameState?.players.length === 2 ? "2 jogadores" : "1 jogador"} variant={gameState?.players.length === 2 ? "success" : "active"} />
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-white/5 p-5 text-left">
                <p className="eyebrow">Link da sala</p>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row">
                  <div className="min-w-0 flex-1 rounded-[18px] border border-white/10 bg-black/25 px-4 py-3 text-sm text-white/78">
                    <span className="block truncate">{roomLink}</span>
                  </div>
                  <PrimaryAction variant="active" size="md" onClick={copyRoomLink}>
                    Copiar link
                  </PrimaryAction>
                  <PrimaryAction variant="danger" size="md" onClick={handleLeaveRoom}>
                    Sair da sala
                  </PrimaryAction>
                </div>
              </div>

              <ModeConfirmCard
                mode={gameState?.mode || "odd-even"}
                confirmedSlots={gameState?.modeConfirmedSlots || []}
                currentSlot={currentSlot}
                canConfirm={!isSpectator}
                onConfirm={handleConfirmMode}
              />

              <NameEditor
                value={draftName}
                onChange={setDraftName}
                onSave={saveName}
                disabled={!currentPlayer || Boolean(currentPlayer.ready)}
              />

              <div className="grid gap-3">
                <ReadySummaryCard title="Voce" name={currentPlayer?.name || "Sua vaga"} status={currentPlayer?.ready ? "Pronto" : "Aguardando"} variant={currentPlayer?.ready ? "success" : "default"} />
                <ReadySummaryCard title="Rival" name={opponentPlayer?.name || "Aguardando entrada"} status={!opponentPlayer ? "Sem conexao" : opponentPlayer.ready ? "Pronto" : "Aguardando"} variant={!opponentPlayer ? "default" : opponentPlayer.ready ? "success" : "active"} />
              </div>

              <ReadyButton
                isSynced={Boolean(currentPlayer?.ready)}
                disabled={!canReady}
                size="lg"
                onClick={sendReady}
              >
                {currentPlayer?.ready ? "Pronto enviado" : modeConfirmed ? "Marcar como pronto" : "Confirme o modo primeiro"}
              </ReadyButton>
            </div>
          </SurfaceCard>
        </div>

        <HistoryFeed history={gameState?.history || []} />
      </div>
    );
  }

  function renderOddEvenPlaying() {
    return (
      <div className="grid gap-4 lg:grid-cols-[0.85fr,1.15fr]">
        <SurfaceCard size="lg" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-5 text-left">
            <div>
              <p className="eyebrow">Paridade</p>
              <p className="mt-2 text-sm leading-6 text-textMuted">Quem escolhe primeiro fica com o lado.</p>
            </div>
            <ParityToggle
              value={selectedParity}
              disabled={!canSubmit || Boolean(parityAssigned)}
              variant="active"
              onChange={handleParityChange}
            />
            <div className="rounded-[22px] border border-white/10 bg-white/5 p-4">
              <p className="eyebrow">Seu lado</p>
              <p className="mt-3 text-2xl font-semibold text-white">{formatParityLabel(parityAssigned || selectedParity)}</p>
            </div>
          </div>
        </SurfaceCard>

        <SurfaceCard size="lg" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-5 text-left">
            <div>
              <p className="eyebrow">Numero</p>
              <p className="mt-2 text-sm leading-6 text-textMuted">Escolha de 0 a 5 e confirme.</p>
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
                <p className="mt-3 text-2xl font-semibold text-white">{formatParityLabel(parityAssigned || selectedParity)}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <p className="eyebrow">Status</p>
                <p className="mt-3 text-sm leading-6 text-white/74">
                  {submittedSelection || currentPlayer?.submitted ? "Jogada enviada. Aguardando resultado." : "Sua jogada ainda nao foi enviada."}
                </p>
              </div>
            </div>
            <PrimaryAction variant="active" disabled={!canSubmit} size="lg" onClick={sendOddEvenChoice}>
              {submittedSelection || currentPlayer?.submitted ? "Aguardando rival" : "Confirmar jogada"}
            </PrimaryAction>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  function renderRpsPlaying() {
    return (
      <div className="grid gap-4">
        <SurfaceCard size="lg" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-5 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="eyebrow">Escolha</p>
                <h3 className="mt-2 font-display text-3xl text-white">Pedra, Papel e Tesoura</h3>
                <p className="mt-3 text-sm leading-6 text-white/72">Escolha uma opcao, confirme a jogada e aguarde a revelacao.</p>
              </div>
              <StatusPill label={submittedSelection || currentPlayer?.submitted ? "Enviado" : "Pendente"} variant={submittedSelection || currentPlayer?.submitted ? "success" : "active"} size="sm" />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {(["rock", "paper", "scissors"] as RpsChoice[]).map((choice) => (
                <RpsChoiceCard
                  key={choice}
                  choice={choice}
                  selected={selectedRps === choice}
                  disabled={!canSubmit}
                  onSelect={setSelectedRps}
                />
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <p className="eyebrow">Sua escolha</p>
                <p className="mt-3 font-display text-3xl text-white">{formatRpsChoice(selectedRps)}</p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <p className="eyebrow">Rival</p>
                <p className="mt-3 text-sm leading-6 text-white/74">
                  {opponentPlayer?.submitted ? "O rival ja enviou." : "Aguardando a jogada do rival."}
                </p>
              </div>
              <div className="rounded-[20px] border border-white/10 bg-white/5 p-4">
                <p className="eyebrow">Status</p>
                <p className="mt-3 text-sm leading-6 text-white/74">
                  {submittedSelection || currentPlayer?.submitted ? "Jogada enviada. Aguardando resultado." : "Sua jogada ainda nao foi enviada."}
                </p>
              </div>
            </div>

            <PrimaryAction variant="active" disabled={!canSubmit} size="lg" onClick={sendRpsChoice}>
              {submittedSelection || currentPlayer?.submitted ? "Aguardando rival" : "Confirmar jogada"}
            </PrimaryAction>
          </div>
        </SurfaceCard>
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
                <h2 className="mt-3 panel-title">{formatModeLabel(gameState?.mode || "odd-even")}</h2>
              </div>
              <div className="flex flex-wrap gap-2">
                <StatusPill label={`Round ${gameState?.round || 1}`} variant="active" />
                <PrimaryAction variant="danger" size="sm" onClick={handleLeaveRoom}>
                  Sair da sala
                </PrimaryAction>
              </div>
            </div>

            <TimerBar
              currentTime={now}
              deadlineAt={gameState?.deadlineAt || null}
              maxSeconds={15}
              isActive
              label="Tempo da rodada"
            />
          </div>
        </SurfaceCard>

        {gameState?.mode === "rps" ? renderRpsPlaying() : renderOddEvenPlaying()}
      </div>
    );
  }

  function renderResultScreen() {
    if (!gameState?.result) return null;

    return (
      <div className="grid gap-4">
        {gameState.mode === "rps" ? (
          <RpsResultPanel currentPlayer={currentPlayer} opponentPlayer={opponentPlayer} gameState={gameState} />
        ) : resultVisual ? (
          <ResultBanner result={resultVisual} playerParity={currentPlayer?.selection?.parity || selectedParity} />
        ) : null}

        {gameState.mode === "odd-even" ? (
          <SurfaceCard size="lg" className="bg-black/10">
            <div className="relative z-10 grid gap-3 text-left md:grid-cols-4">
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <p className="eyebrow">Seu numero</p>
                <p className="mt-3 font-display text-4xl text-white">{currentPlayer?.selection?.number ?? "--"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <p className="eyebrow">Numero rival</p>
                <p className="mt-3 font-display text-4xl text-white">{opponentPlayer?.selection?.number ?? "--"}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <p className="eyebrow">Paridade final</p>
                <p className="mt-3 text-2xl font-semibold text-white">{formatParityLabel(gameState.result.parity)}</p>
              </div>
              <div className="rounded-[22px] border border-white/10 bg-white/5 p-5">
                <p className="eyebrow">Resumo</p>
                <p className="mt-3 text-sm leading-6 text-white/74">{getResultCopy(gameState.result.reason)}</p>
              </div>
            </div>
          </SurfaceCard>
        ) : null}

        <SurfaceCard variant="success" size="md" className="bg-black/10">
          <div className="relative z-10 flex flex-col gap-4 text-left sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Proxima rodada</p>
              <p className="mt-2 text-sm leading-6 text-white/74">
                Clique em revanche para voltar ao lobby e preparar uma nova partida.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <PrimaryAction variant="danger" size="md" onClick={handleLeaveRoom}>
                Sair da sala
              </PrimaryAction>
              <ReadyButton isSynced={Boolean(currentPlayer?.ready)} disabled={!canReady} size="lg" onClick={sendReady}>
                {currentPlayer?.ready ? "Revanche enviada" : "Pedir revanche"}
              </ReadyButton>
            </div>
          </div>
        </SurfaceCard>
      </div>
    );
  }

  function renderInRoomContent() {
    if (!gameState) return renderJoiningScreen();

    if (isSpectator) {
      return (
        <div className="grid min-h-[22rem] place-items-center text-center">
          <div className="max-w-lg">
            <StatusPill label="Espectador" variant="active" />
            <h2 className="mt-4 panel-title">A sala ja esta com 2 jogadores</h2>
            <p className="mt-3 panel-copy">
              Voce entrou pelo link corretamente, mas esta assistindo porque os dois lugares ja estao ocupados.
            </p>
            <div className="mt-6 flex justify-center">
              <PrimaryAction variant="danger" size="md" onClick={handleLeaveRoom}>
                Sair da sala
              </PrimaryAction>
            </div>
          </div>
        </div>
      );
    }

    if (gameState.phase === "playing") return renderPlayingScreen();
    if (gameState.phase === "result") return renderResultScreen();
    return renderReadyScreen();
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="app-shell">
        <div className="arcade-grid" aria-hidden="true" />

        <div className="platform-shell">
          <ModeSidebar
            currentMode={gameState?.mode || "odd-even"}
            confirmedSlots={gameState?.modeConfirmedSlots || []}
            currentSlot={currentSlot}
            interactive={Boolean(gameState) && !isSpectator && gameState?.phase !== "playing"}
            onSelect={handleSelectMode}
          />

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
                      <p className="eyebrow">{gameState ? formatModeLabel(gameState.mode) : "Plataforma de jogos"}</p>
                      <h1 className="mt-3 font-display text-4xl leading-none text-white sm:text-5xl">
                        Salas online
                      </h1>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <StatusPill label={meta?.roomCode || roomCodeFromUrl || "SEM SALA"} variant="active" />
                      <StatusPill label={isConnected ? "Conectado" : "Desconectado"} variant={isConnected ? "success" : "danger"} />
                      {appView === "in-room" ? (
                        <PrimaryAction variant="danger" size="sm" onClick={handleLeaveRoom}>
                          Sair da sala
                        </PrimaryAction>
                      ) : null}
                    </div>
                  </div>

                  <p className="panel-copy">
                    {systemMessage
                      || gameState?.infoMessage
                      || (appView === "home"
                        ? "Crie uma sala para jogar e escolha o modo no lobby."
                        : "Conectando ao servidor para carregar a sala.")}
                  </p>
                </div>
              </SurfaceCard>

              <SurfaceCard size="md">
                <div className="relative z-10 flex h-full flex-col justify-between gap-4 text-left">
                  <div>
                    <p className="eyebrow">Seu status</p>
                    <h2 className="mt-3 font-display text-2xl text-white">
                      {appView === "home"
                        ? "Fora da sala"
                        : appView === "joining"
                          ? "Entrando na sala"
                          : appView === "expired"
                            ? "Sala encerrada"
                            : gameState
                              ? formatPhaseTitle(gameState.phase)
                              : "Conectando"}
                    </h2>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <StatusPill
                      label={meta ? (meta.spectator ? "Espectador" : `Jogador ${Number(meta.slot) + 1}`) : "Sem vaga"}
                      variant={meta?.spectator ? "active" : meta ? "success" : "default"}
                      size="sm"
                    />
                    <StatusPill
                      label={gameState ? `${gameState.players.length}/2 online` : "0/2 online"}
                      variant={gameState?.players.length === 2 ? "success" : "default"}
                      size="sm"
                    />
                    {gameState ? (
                      <StatusPill
                        label={modeConfirmed ? "Modo confirmado" : currentConfirmed ? "Aguardando rival confirmar" : "Modo pendente"}
                        variant={modeConfirmed ? "success" : "active"}
                        size="sm"
                      />
                    ) : null}
                  </div>
                </div>
              </SurfaceCard>
            </header>

            <main>
              <SurfaceCard variant={roomVariant} size="lg" className="relative">
                <div className="scanline" />
                <div className="relative z-10 flex flex-col gap-6 text-left">
                  {appView === "home" || appView === "expired"
                    ? renderHomeScreen()
                    : appView === "joining"
                      ? renderJoiningScreen()
                      : renderInRoomContent()}
                </div>
              </SurfaceCard>
            </main>
          </motion.div>
        </div>
      </div>
    </MotionConfig>
  );
}
