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
const ROUND_TIME_MS = 25_000;
const READY_DELAY_MS = 1_200;
const HISTORY_LIMIT = 12;

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
    history: [],
    deadlineAt: null,
    parityOwnerSlot: null,
    parityChoice: null,
    infoMessage: "Aguardando 2 jogadores na sala.",
    startTimeout: null,
    resolveTimeout: null,
  };
}

function assignSlot() {
  const usedSlots = new Set(
    room.players.filter((player) => !player.spectator).map((player) => player.slot),
  );

  return usedSlots.has(0) ? (usedSlots.has(1) ? null : 1) : 0;
}

function getOppositeParity(parity) {
  return parity === "odd" ? "even" : "odd";
}

function getAssignedParity(player) {
  if (player.spectator || room.parityOwnerSlot === null || room.parityChoice === null) {
    return null;
  }

  return player.slot === room.parityOwnerSlot
    ? room.parityChoice
    : getOppositeParity(room.parityChoice);
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
    assignedParity: getAssignedParity(player),
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
    history: room.history,
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

function resetRoundSelections() {
  room.players.forEach((player) => {
    if (player.spectator) {
      return;
    }

    player.submitted = false;
    player.selection = null;
  });

  room.parityOwnerSlot = null;
  room.parityChoice = null;
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
  room.phase = "waiting";
  room.deadlineAt = null;
  room.result = null;
  room.infoMessage = message;
  room.players.forEach((player) => {
    if (!player.spectator) {
      player.ready = false;
    }
  });
  resetRoundSelections();
  emitState();
}

function startRound() {
  clearTimers();
  room.phase = "playing";
  room.result = null;
  room.deadlineAt = Date.now() + ROUND_TIME_MS;
  room.infoMessage = "Rodada ativa. O primeiro a escolher impar ou par fica com a escolha.";
  resetRoundSelections();
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

function applyParityChoice(player, desiredParity) {
  if (room.phase !== "playing" || player.spectator) {
    return false;
  }

  const parity = desiredParity === "even" ? "even" : "odd";
  if (room.parityOwnerSlot === null || room.parityOwnerSlot === player.slot) {
    room.parityOwnerSlot = player.slot;
    room.parityChoice = parity;
    room.infoMessage = `${player.name} travou ${parity === "odd" ? "impar" : "par"} primeiro.`;
    return true;
  }

  return false;
}

function createAutoSelection(player, fallbackIndex) {
  const assignedParity = getAssignedParity(player) || (fallbackIndex === 0 ? "odd" : "even");
  return {
    number: Math.floor(Math.random() * 6),
    parity: assignedParity,
    auto: true,
  };
}

function pushHistoryEntry({ players, winner, parity, sum, reason }) {
  const entry = {
    round: room.round,
    createdAt: Date.now(),
    sum,
    parity,
    winnerSlot: winner?.slot ?? null,
    winnerName: winner?.name ?? null,
    reason,
    players: players.map((player) => ({
      slot: player.slot,
      name: player.name,
      number: player.selection?.number ?? null,
      parity: player.selection?.parity ?? null,
      auto: player.selection?.auto ?? false,
    })),
  };

  room.history = [entry, ...room.history].slice(0, HISTORY_LIMIT);
}

function resolveRound(reason = "submitted") {
  if (room.phase !== "playing") {
    return;
  }

  clearTimers();
  const players = room.players.filter((player) => !player.spectator);

  if (room.parityOwnerSlot === null) {
    room.parityOwnerSlot = players[0]?.slot ?? 0;
    room.parityChoice = "odd";
  }

  players.forEach((player, index) => {
    const assignedParity = getAssignedParity(player) || (index === 0 ? "odd" : "even");
    if (!player.selection) {
      player.selection = createAutoSelection(player, index);
    }

    player.selection.parity = assignedParity;
    player.submitted = true;
  });

  const sum = players.reduce(
    (accumulator, player) => accumulator + (player.selection?.number || 0),
    0,
  );
  const parity = sum % 2 === 0 ? "even" : "odd";
  const winner = players.find((player) => player.selection?.parity === parity) || null;

  pushHistoryEntry({ players, winner, parity, sum, reason });

  room.phase = "result";
  room.deadlineAt = null;
  room.result = {
    sum,
    parity,
    winnerSlot: winner?.slot ?? null,
    reason,
  };
  room.infoMessage = winner
    ? `Resultado fechado. ${winner.name} venceu a rodada.`
    : "Resultado fechado.";

  players.forEach((player) => {
    player.ready = false;
  });

  room.round += 1;
  emitState();
}

function getPlayerBySocket(socketId) {
  return room.players.find((player) => player.socketId === socketId);
}

function canSubmitSelection(player) {
  return Boolean(
    player &&
      !player.spectator &&
      player.connected &&
      room.phase === "playing" &&
      !player.submitted,
  );
}

function sanitizePlayerName(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 20);
  return normalized || fallback;
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
    : `${player.name} entrou na sala.`;
  emitState();

  socket.emit("player:meta", {
    socketId: socket.id,
    slot,
    spectator,
  });

  socket.on("player:ready", (payload) => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!currentPlayer || currentPlayer.spectator || room.phase === "playing") {
      return;
    }

    currentPlayer.ready = Boolean(payload?.ready);
    room.infoMessage = currentPlayer.ready
      ? `${currentPlayer.name} esta pronto.`
      : `${currentPlayer.name} cancelou o ready.`;

    emitState();
    maybeStartRound();
  });

  socket.on("player:set-name", (payload) => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!currentPlayer || currentPlayer.spectator || room.phase === "playing") {
      return;
    }

    const fallback = `Jogador ${Number(currentPlayer.slot) + 1}`;
    const nextName = sanitizePlayerName(payload?.name, fallback);

    if (nextName === currentPlayer.name) {
      return;
    }

    currentPlayer.name = nextName;
    room.infoMessage = `${currentPlayer.name} atualizou o nome.`;
    emitState();
  });

  socket.on("player:pick-parity", (payload) => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!currentPlayer || currentPlayer.spectator || currentPlayer.submitted) {
      return;
    }

    const changed = applyParityChoice(currentPlayer, payload?.parity);
    if (changed) {
      emitState();
    }
  });

  socket.on("player:submit", (payload) => {
    const currentPlayer = getPlayerBySocket(socket.id);
    if (!canSubmitSelection(currentPlayer)) {
      return;
    }

    const number = Number(payload?.number);
    if (!Number.isInteger(number) || number < 0 || number > 5) {
      return;
    }

    if (room.parityOwnerSlot === null) {
      applyParityChoice(currentPlayer, payload?.parity);
    }

    const assignedParity = getAssignedParity(currentPlayer);
    if (!assignedParity) {
      return;
    }

    currentPlayer.selection = {
      number,
      parity: assignedParity,
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
        setWaitingState("Um jogador desconectou. A rodada foi reiniciada.");
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
