import cors from "cors";
import express from "express";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Server } from "socket.io";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const distDir = join(rootDir, "dist");

const PORT = Number(process.env.PORT || 3001);
const ROUND_TIME_MS = 10_000;
const READY_DELAY_MS = 1_200;

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: true,
    credentials: true,
  },
});

const room = createInitialRoom();

function createInitialRoom() {
  return {
    players: [],
    phase: "waiting",
    round: 1,
    result: null,
    deadlineAt: null,
    infoMessage: "Aguardando 2 jogadores na sala.",
    startTimeout: null,
    resolveTimeout: null,
  };
}

function createSelection() {
  return {
    number: Math.floor(Math.random() * 6),
    parity: Math.random() > 0.5 ? "odd" : "even",
    auto: true,
  };
}

function assignSlot() {
  const usedSlots = new Set(room.players.filter((player) => !player.spectator).map((player) => player.slot));
  return usedSlots.has(0) ? (usedSlots.has(1) ? null : 1) : 0;
}

function getPublicPlayer(player) {
  return {
    id: player.id,
    socketId: player.socketId,
    slot: player.slot,
    spectator: player.spectator,
    connected: player.connected,
    ready: player.ready,
    submitted: player.submitted,
    selection: player.selection,
    name: player.name,
  };
}

function buildState() {
  const activePlayers = room.players.filter((player) => !player.spectator);
  return {
    phase: room.phase,
    round: room.round,
    roomCode: "SALA-01",
    serverTime: Date.now(),
    deadlineAt: room.deadlineAt,
    result: room.result,
    infoMessage: room.infoMessage,
    players: activePlayers.map(getPublicPlayer),
  };
}

function emitState() {
  io.emit("game:state", buildState());
}

function clearTimers() {
  if (room.startTimeout) {
    clearTimeout(room.startTimeout);
    room.startTimeout = null;
  }

  if (room.resolveTimeout) {
    clearTimeout(room.resolveTimeout);
    room.resolveTimeout = null;
  }
}

function resetSelections() {
  room.players.forEach((player) => {
    if (player.spectator) {
      return;
    }

    player.submitted = false;
    player.selection = null;
  });
}

function getActivePlayers() {
  return room.players.filter((player) => !player.spectator && player.connected);
}

function allPlayersReady() {
  const activePlayers = getActivePlayers();
  return activePlayers.length === 2 && activePlayers.every((player) => player.ready);
}

function setWaitingState(message = "Aguardando 2 jogadores na sala.") {
  clearTimers();
  room.phase = getActivePlayers().length < 2 ? "waiting" : "waiting";
  room.deadlineAt = null;
  room.result = null;
  room.infoMessage = message;
  room.players.forEach((player) => {
    if (!player.spectator) {
      player.ready = false;
      player.submitted = false;
      player.selection = null;
    }
  });
  emitState();
}

function startRound() {
  clearTimers();
  room.phase = "playing";
  room.result = null;
  room.deadlineAt = Date.now() + ROUND_TIME_MS;
  room.infoMessage = "Rodada ativa. Escolha numero e lado antes do tempo acabar.";
  resetSelections();
  emitState();

  room.resolveTimeout = setTimeout(() => {
    resolveRound("timeout");
  }, ROUND_TIME_MS);
}

function maybeStartRound() {
  if (!allPlayersReady()) {
    return;
  }

  clearTimers();
  room.phase = "ready";
  room.infoMessage = "Todos prontos. Preparando a rodada.";
  emitState();

  room.startTimeout = setTimeout(() => {
    if (allPlayersReady()) {
      startRound();
    }
  }, READY_DELAY_MS);
}

function resolveRound(reason = "submitted") {
  if (room.phase !== "playing") {
    return;
  }

  clearTimers();
  const players = room.players.filter((player) => !player.spectator);
  for (const player of players) {
    if (!player.selection) {
      player.selection = createSelection();
      player.submitted = true;
    }
  }

  const [playerOne, playerTwo] = players;
  const sum = (playerOne.selection?.number || 0) + (playerTwo.selection?.number || 0);
  const parity = sum % 2 === 0 ? "even" : "odd";
  const winners = players.filter((player) => player.selection?.parity === parity);

  room.phase = "result";
  room.deadlineAt = null;
  room.result = {
    sum,
    parity,
    winnerSlot: winners.length === 1 ? winners[0].slot : null,
    reason,
  };
  room.infoMessage =
    winners.length === 1
      ? `Resultado fechado. ${winners[0].name} venceu a rodada.`
      : "Resultado fechado. A rodada terminou empatada.";

  players.forEach((player) => {
    player.ready = false;
  });

  emitState();
}

function getPlayerBySocket(socketId) {
  return room.players.find((player) => player.socketId === socketId);
}

function canSubmitSelection(player) {
  return (
    player &&
    !player.spectator &&
    player.connected &&
    room.phase === "playing" &&
    !player.submitted
  );
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, room: buildState() });
});

io.on("connection", (socket) => {
  const slot = assignSlot();
  const spectator = slot === null;

  const player = {
    id: `player-${socket.id}`,
    socketId: socket.id,
    slot,
    spectator,
    connected: true,
    ready: false,
    submitted: false,
    selection: null,
    name: spectator ? "Espectador" : `Jogador ${slot + 1}`,
  };

  room.players.push(player);
  room.infoMessage = spectator
    ? "Sala cheia. Aguarde uma vaga para entrar na partida."
    : "Jogador conectado. Aguardando confirmacao.";
  emitState();

  socket.emit("player:meta", {
    socketId: socket.id,
    slot,
    spectator,
  });

  socket.on("player:ready", (payload) => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!currentPlayer || currentPlayer.spectator) {
      return;
    }

    if (room.phase === "playing") {
      return;
    }

    currentPlayer.ready = Boolean(payload?.ready);
    room.infoMessage = currentPlayer.ready
      ? `${currentPlayer.name} esta pronto.`
      : `${currentPlayer.name} cancelou o ready.`;

    emitState();
    maybeStartRound();
  });

  socket.on("player:submit", (payload) => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!canSubmitSelection(currentPlayer)) {
      return;
    }

    const number = Number(payload?.number);
    const parity = payload?.parity === "even" ? "even" : "odd";
    if (!Number.isInteger(number) || number < 0 || number > 5) {
      return;
    }

    currentPlayer.selection = {
      number,
      parity,
      auto: false,
    };
    currentPlayer.submitted = true;
    room.infoMessage = `${currentPlayer.name} enviou a jogada.`;
    emitState();

    const allSubmitted = room.players
      .filter((candidate) => !candidate.spectator)
      .every((candidate) => candidate.submitted);

    if (allSubmitted) {
      resolveRound("submitted");
    }
  });

  socket.on("disconnect", () => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!currentPlayer) {
      return;
    }

    room.players = room.players.filter((candidate) => candidate.socketId !== socket.id);

    if (!currentPlayer.spectator) {
      if (room.phase === "playing") {
        setWaitingState("Um jogador desconectou. A partida foi reiniciada.");
        return;
      }

      setWaitingState("Um jogador saiu da sala. Aguardando nova conexao.");
      return;
    }

    emitState();
  });
});

app.use(express.static(distDir));

app.use((req, res, next) => {
  if (req.path.startsWith("/socket.io") || req.path.startsWith("/api")) {
    next();
    return;
  }

  res.sendFile(join(distDir, "index.html"), (error) => {
    if (error) {
      next();
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Servidor online em http://localhost:${PORT}`);
});
