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
const ROUND_TIME_MS = 15_000;
const READY_DELAY_MS = 1_200;
const HISTORY_LIMIT = 12;
const ROOM_IDLE_MS = 60_000;
const DEFAULT_MODE = "odd-even";

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

const rooms = new Map();

function createInitialRoom(roomCode) {
  return {
    roomCode,
    mode: DEFAULT_MODE,
    modeConfirmedSlots: [],
    players: [],
    spectators: [],
    phase: "waiting",
    round: 1,
    result: null,
    history: [],
    deadlineAt: null,
    parityOwnerSlot: null,
    parityChoice: null,
    infoMessage: "Aguardando o segundo jogador na sala.",
    startTimeout: null,
    resolveTimeout: null,
    idleTimeout: null,
    createdAt: Date.now(),
  };
}

function generateRoomCode() {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (rooms.has(code));
  return code;
}

function getRoom(roomCode) {
  if (!roomCode) return null;
  return rooms.get(roomCode) || null;
}

function getParticipantCount(room) {
  return room.players.length + room.spectators.length;
}

function clearTimers(room) {
  if (room.startTimeout) {
    clearTimeout(room.startTimeout);
    room.startTimeout = null;
  }

  if (room.resolveTimeout) {
    clearTimeout(room.resolveTimeout);
    room.resolveTimeout = null;
  }
}

function clearIdleTimeout(room) {
  if (room.idleTimeout) {
    clearTimeout(room.idleTimeout);
    room.idleTimeout = null;
  }
}

function removeRoom(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;
  clearTimers(room);
  clearIdleTimeout(room);
  rooms.delete(roomCode);
}

function getAssignedParity(room, player) {
  if (player.spectator || room.parityOwnerSlot === null || room.parityChoice === null) {
    return null;
  }

  return player.slot === room.parityOwnerSlot
    ? room.parityChoice
    : room.parityChoice === "odd"
      ? "even"
      : "odd";
}

function getPublicPlayer(room, player) {
  return {
    id: player.id,
    socketId: player.socketId,
    slot: player.slot,
    spectator: player.spectator,
    connected: player.connected,
    ready: player.ready,
    submitted: player.submitted,
    selection: player.selection,
    assignedParity: getAssignedParity(room, player),
    name: player.name,
  };
}

function buildState(room) {
  return {
    phase: room.phase,
    round: room.round,
    roomCode: room.roomCode,
    mode: room.mode,
    modeConfirmedSlots: room.modeConfirmedSlots,
    serverTime: Date.now(),
    deadlineAt: room.deadlineAt,
    result: room.result,
    history: room.history,
    infoMessage: room.infoMessage,
    players: room.players.map((player) => getPublicPlayer(room, player)),
    spectatorCount: room.spectators.length,
  };
}

function emitState(room) {
  io.to(room.roomCode).emit("game:state", buildState(room));
}

function resetModeConfirmations(room) {
  room.modeConfirmedSlots = [];
  room.players.forEach((player) => {
    player.ready = false;
  });
}

function resetRoundSelections(room) {
  room.players.forEach((player) => {
    player.submitted = false;
    player.selection = null;
  });

  room.parityOwnerSlot = null;
  room.parityChoice = null;
}

function getActivePlayers(room) {
  return room.players.filter((player) => player.connected);
}

function isModeConfirmed(room) {
  const activePlayers = getActivePlayers(room);
  return activePlayers.length === 2
    && activePlayers.every((player) => room.modeConfirmedSlots.includes(player.slot));
}

function allPlayersReady(room) {
  const activePlayers = getActivePlayers(room);
  return activePlayers.length === 2
    && isModeConfirmed(room)
    && activePlayers.every((player) => player.ready);
}

function sanitizePlayerName(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 20);
  return normalized || fallback;
}

function setWaitingState(room, message = "Aguardando o segundo jogador na sala.") {
  clearTimers(room);
  room.phase = "waiting";
  room.deadlineAt = null;
  room.result = null;
  room.infoMessage = message;
  room.players.forEach((player) => {
    player.ready = false;
  });
  resetRoundSelections(room);
  emitState(room);
}

function setReadyLobbyState(room, message = "Sala aberta para revanche.") {
  clearTimers(room);
  room.phase = getActivePlayers(room).length === 2 ? "ready" : "waiting";
  room.deadlineAt = null;
  room.result = null;
  room.infoMessage = message;
  room.players.forEach((player) => {
    player.ready = false;
  });
  resetRoundSelections(room);
  emitState(room);
}

function maybeStartRound(room) {
  if (!allPlayersReady(room)) {
    return;
  }

  clearTimers(room);
  clearIdleTimeout(room);
  room.phase = "ready";
  room.infoMessage = "Todos marcaram pronto. Preparando a rodada.";
  emitState(room);

  room.startTimeout = setTimeout(() => {
    if (allPlayersReady(room)) {
      startRound(room);
    }
  }, READY_DELAY_MS);
}

function startRound(room) {
  clearTimers(room);
  clearIdleTimeout(room);
  room.phase = "playing";
  room.result = null;
  room.deadlineAt = Date.now() + ROUND_TIME_MS;
  room.infoMessage =
    room.mode === "rps"
      ? "Rodada ativa. Escolha pedra, papel ou tesoura."
      : "Rodada ativa. O primeiro a escolher impar ou par fica com a escolha.";
  resetRoundSelections(room);
  emitState(room);

  room.resolveTimeout = setTimeout(() => {
    resolveRound(room, "timeout");
  }, ROUND_TIME_MS);
}

function applyParityChoice(room, player, desiredParity) {
  if (room.phase !== "playing" || room.mode !== "odd-even" || player.spectator) {
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

function createOddEvenAutoSelection(room, player, fallbackIndex) {
  const assignedParity = getAssignedParity(room, player) || (fallbackIndex === 0 ? "odd" : "even");
  return {
    number: Math.floor(Math.random() * 6),
    parity: assignedParity,
    choice: null,
    auto: true,
  };
}

function createRpsAutoSelection(choice = null) {
  return {
    number: null,
    parity: null,
    choice,
    auto: true,
  };
}

function resolveRpsWinner(firstChoice, secondChoice) {
  if (!firstChoice && !secondChoice) return null;
  if (!firstChoice) return 1;
  if (!secondChoice) return 0;
  if (firstChoice === secondChoice) return null;

  if (
    (firstChoice === "rock" && secondChoice === "scissors")
    || (firstChoice === "scissors" && secondChoice === "paper")
    || (firstChoice === "paper" && secondChoice === "rock")
  ) {
    return 0;
  }

  return 1;
}

function pushHistoryEntry(room, { players, winner, parity, sum, reason }) {
  const entry = {
    round: room.round,
    mode: room.mode,
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
      choice: player.selection?.choice ?? null,
      auto: player.selection?.auto ?? false,
    })),
  };

  room.history = [entry, ...room.history].slice(0, HISTORY_LIMIT);
}

function resolveOddEvenRound(room, reason) {
  const players = room.players;

  if (room.parityOwnerSlot === null) {
    room.parityOwnerSlot = players[0]?.slot ?? 0;
    room.parityChoice = "odd";
  }

  players.forEach((player, index) => {
    const assignedParity = getAssignedParity(room, player) || (index === 0 ? "odd" : "even");
    if (!player.selection) {
      player.selection = createOddEvenAutoSelection(room, player, index);
    }

    player.selection.parity = assignedParity;
    player.submitted = true;
  });

  const sum = players.reduce((accumulator, player) => accumulator + (player.selection?.number || 0), 0);
  const parity = sum % 2 === 0 ? "even" : "odd";
  const winner = players.find((player) => player.selection?.parity === parity) || null;

  pushHistoryEntry(room, { players, winner, parity, sum, reason });

  room.result = {
    mode: room.mode,
    sum,
    parity,
    winnerSlot: winner?.slot ?? null,
    reason,
    outcome: winner ? "win" : "draw",
  };
  room.infoMessage = winner
    ? `Resultado fechado. ${winner.name} venceu a rodada.`
    : "Resultado fechado.";
}

function resolveRpsRound(room, reason) {
  const players = room.players;
  const first = players[0];
  const second = players[1];

  if (!first.selection) {
    first.selection = createRpsAutoSelection(null);
  }

  if (!second.selection) {
    second.selection = createRpsAutoSelection(null);
  }

  first.submitted = true;
  second.submitted = true;

  const winnerIndex = resolveRpsWinner(first.selection.choice, second.selection.choice);
  const winner = winnerIndex === null ? null : players[winnerIndex];
  const outcome = winner ? "win" : "draw";

  pushHistoryEntry(room, {
    players,
    winner,
    parity: null,
    sum: null,
    reason,
  });

  room.result = {
    mode: room.mode,
    sum: null,
    parity: null,
    winnerSlot: winner?.slot ?? null,
    reason,
    outcome,
  };
  room.infoMessage = winner
    ? `Resultado fechado. ${winner.name} venceu a rodada.`
    : "Empate. Ninguem venceu a rodada.";
}

function resolveRound(room, reason = "submitted") {
  if (room.phase !== "playing") {
    return;
  }

  clearTimers(room);
  room.phase = "result";
  room.deadlineAt = null;

  if (room.mode === "rps") {
    resolveRpsRound(room, reason);
  } else {
    resolveOddEvenRound(room, reason);
  }

  room.players.forEach((player) => {
    player.ready = false;
  });

  room.round += 1;
  emitState(room);
}

function scheduleIdleTimeout(room) {
  clearIdleTimeout(room);

  const totalParticipants = getParticipantCount(room);
  if (totalParticipants === 0) {
    room.idleTimeout = setTimeout(() => {
      const liveRoom = rooms.get(room.roomCode);
      if (!liveRoom || getParticipantCount(liveRoom) > 0) {
        return;
      }
      removeRoom(liveRoom.roomCode);
    }, ROOM_IDLE_MS);
    return;
  }

  if (room.players.length !== 1 || room.phase === "playing") {
    return;
  }

  room.infoMessage = "Aguardando o segundo jogador na sala.";
  emitState(room);

  room.idleTimeout = setTimeout(async () => {
    const liveRoom = rooms.get(room.roomCode);
    if (!liveRoom || liveRoom.players.length !== 1) {
      return;
    }

    io.to(liveRoom.roomCode).emit("room:expired", {
      roomCode: liveRoom.roomCode,
      message: "A sala foi encerrada por inatividade.",
    });

    const sockets = await io.in(liveRoom.roomCode).fetchSockets();
    removeRoom(liveRoom.roomCode);

    sockets.forEach((socket) => {
      socket.data.roomCode = null;
      socket.disconnect(true);
    });
  }, ROOM_IDLE_MS);
}

function leaveRoom(socket) {
  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = getRoom(roomCode);
  socket.leave(roomCode);
  socket.data.roomCode = null;
  socket.data.role = null;

  if (!room) {
    return;
  }

  const wasPlayer = room.players.some((player) => player.socketId === socket.id);
  room.players = room.players.filter((player) => player.socketId !== socket.id);
  room.spectators = room.spectators.filter((spectator) => spectator.socketId !== socket.id);
  room.modeConfirmedSlots = room.modeConfirmedSlots.filter((slot) => room.players.some((player) => player.slot === slot));

  if (room.players.length === 0 && room.spectators.length === 0) {
    scheduleIdleTimeout(room);
    return;
  }

  if (wasPlayer) {
    if (room.phase === "playing") {
      setWaitingState(room, "Um jogador saiu da sala. A rodada foi reiniciada.");
    } else {
      setWaitingState(room, "Um jogador saiu da sala.");
    }
    resetModeConfirmations(room);
  } else {
    emitState(room);
  }

  if (room.players.length === 1) {
    scheduleIdleTimeout(room);
  } else {
    clearIdleTimeout(room);
  }
}

function joinRoom(socket, roomCode) {
  const room = getRoom(roomCode);
  if (!room) {
    socket.emit("room:error", {
      message: "Sala nao encontrada. Crie uma nova sala para jogar.",
      errorCode: "ROOM_NOT_FOUND",
      attemptedRoomCode: roomCode,
    });
    return;
  }

  const slot = room.players.some((player) => player.slot === 0)
    ? (room.players.some((player) => player.slot === 1) ? null : 1)
    : 0;
  const spectator = slot === null;
  const entry = {
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

  if (spectator) {
    room.spectators.push(entry);
    room.infoMessage = "Sala cheia. Voce entrou como espectador.";
  } else {
    room.players.push(entry);
    room.infoMessage = room.players.length === 1
      ? `${entry.name} entrou na sala.`
      : `${entry.name} entrou na sala. Agora confirmem o modo e marquem pronto.`;
  }

  clearIdleTimeout(room);
  socket.join(roomCode);
  socket.data.roomCode = roomCode;
  socket.data.role = spectator ? "spectator" : "player";

  socket.emit("player:meta", {
    socketId: socket.id,
    slot,
    spectator,
    roomCode,
  });

  socket.emit("room:joined", {
    roomCode,
    spectator,
  });

  emitState(room);

  if (room.players.length === 1) {
    scheduleIdleTimeout(room);
  }
}

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    rooms: Array.from(rooms.values()).map((room) => ({
      roomCode: room.roomCode,
      mode: room.mode,
      phase: room.phase,
      players: room.players.length,
      spectators: room.spectators.length,
    })),
  });
});

io.on("connection", (socket) => {
  socket.data.roomCode = null;
  socket.data.role = null;

  socket.on("room:create", () => {
    if (socket.data.roomCode) {
      leaveRoom(socket);
    }

    const roomCode = generateRoomCode();
    const room = createInitialRoom(roomCode);
    rooms.set(roomCode, room);

    socket.emit("room:created", {
      roomCode,
      link: `/sala/${roomCode}`,
    });

    joinRoom(socket, roomCode);
  });

  socket.on("room:join", (payload) => {
    const roomCode = String(payload?.roomCode || "").trim().toUpperCase();
    if (!roomCode) {
      socket.emit("room:error", {
        message: "Link de sala invalido.",
        errorCode: "INVALID_ROOM_LINK",
        attemptedRoomCode: null,
      });
      return;
    }

    if (socket.data.roomCode && socket.data.roomCode !== roomCode) {
      leaveRoom(socket);
    }

    if (socket.data.roomCode === roomCode) {
      const room = getRoom(roomCode);
      if (room) {
        socket.emit("game:state", buildState(room));
      }
      return;
    }

    joinRoom(socket, roomCode);
  });

  socket.on("room:leave", () => {
    const roomCode = socket.data.roomCode;
    leaveRoom(socket);
    socket.emit("room:left", {
      roomCode,
    });
  });

  socket.on("room:set-mode", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase === "playing") {
      return;
    }

    const nextMode = payload?.mode === "rps" ? "rps" : "odd-even";
    if (room.mode !== nextMode) {
      room.mode = nextMode;
      resetModeConfirmations(room);
      room.infoMessage = `${currentPlayer.name} trocou o modo para ${nextMode === "rps" ? "Pedra, Papel e Tesoura" : "Impar ou Par"}.`;
      emitState(room);
    }
  });

  socket.on("room:confirm-mode", () => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase === "playing") {
      return;
    }

    if (!room.modeConfirmedSlots.includes(currentPlayer.slot)) {
      room.modeConfirmedSlots.push(currentPlayer.slot);
    }

    room.infoMessage = isModeConfirmed(room)
      ? "Modo confirmado pelos dois jogadores. Agora voces podem marcar pronto."
      : `${currentPlayer.name} confirmou o modo.`;
    emitState(room);
  });

  socket.on("player:ready", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase === "playing") {
      return;
    }

    if (!isModeConfirmed(room)) {
      room.infoMessage = "Os dois jogadores precisam confirmar o modo antes de marcar pronto.";
      emitState(room);
      return;
    }

    if (room.phase === "result") {
      setReadyLobbyState(room, `${currentPlayer.name} pediu revanche.`);
    }

    currentPlayer.ready = Boolean(payload?.ready);
    room.infoMessage = currentPlayer.ready
      ? `${currentPlayer.name} esta pronto.`
      : `${currentPlayer.name} desmarcou o pronto.`;

    emitState(room);
    maybeStartRound(room);
  });

  socket.on("player:set-name", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase === "playing") {
      return;
    }

    const fallback = `Jogador ${Number(currentPlayer.slot) + 1}`;
    const nextName = sanitizePlayerName(payload?.name, fallback);

    if (nextName === currentPlayer.name) {
      return;
    }

    currentPlayer.name = nextName;
    room.infoMessage = `${currentPlayer.name} atualizou o nome.`;
    emitState(room);
  });

  socket.on("player:pick-parity", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || currentPlayer.submitted || room.mode !== "odd-even") {
      return;
    }

    if (applyParityChoice(room, currentPlayer, payload?.parity)) {
      emitState(room);
    }
  });

  socket.on("player:submit", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase !== "playing" || currentPlayer.submitted || room.mode !== "odd-even") {
      return;
    }

    const number = Number(payload?.number);
    if (!Number.isInteger(number) || number < 0 || number > 5) {
      return;
    }

    if (room.parityOwnerSlot === null) {
      applyParityChoice(room, currentPlayer, payload?.parity);
    }

    const assignedParity = getAssignedParity(room, currentPlayer);
    if (!assignedParity) {
      return;
    }

    currentPlayer.selection = {
      number,
      parity: assignedParity,
      choice: null,
      auto: false,
    };
    currentPlayer.submitted = true;
    room.infoMessage = `${currentPlayer.name} enviou a jogada.`;
    emitState(room);

    if (room.players.every((candidate) => candidate.submitted)) {
      resolveRound(room, "submitted");
    }
  });

  socket.on("player:submit-rps", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase !== "playing" || currentPlayer.submitted || room.mode !== "rps") {
      return;
    }

    const choice = ["rock", "paper", "scissors"].includes(payload?.choice) ? payload.choice : null;
    if (!choice) {
      return;
    }

    currentPlayer.selection = {
      number: null,
      parity: null,
      choice,
      auto: false,
    };
    currentPlayer.submitted = true;
    room.infoMessage = `${currentPlayer.name} enviou a jogada.`;
    emitState(room);

    if (room.players.every((candidate) => candidate.submitted)) {
      resolveRound(room, "submitted");
    }
  });

  socket.on("disconnect", () => {
    leaveRoom(socket);
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
