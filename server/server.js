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

function allPlayersReady(room) {
  const activePlayers = getActivePlayers(room);
  return activePlayers.length === 2 && activePlayers.every((player) => player.ready);
}

function pushHistoryEntry(room, { players, winner, parity, sum, reason }) {
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

function createAutoSelection(room, player, fallbackIndex) {
  const assignedParity = getAssignedParity(room, player) || (fallbackIndex === 0 ? "odd" : "even");
  return {
    number: Math.floor(Math.random() * 6),
    parity: assignedParity,
    auto: true,
  };
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
  resetRoundSelections(room);
  emitState(room);
}

function startRound(room) {
  clearTimers(room);
  clearIdleTimeout(room);
  room.phase = "playing";
  room.result = null;
  room.deadlineAt = Date.now() + ROUND_TIME_MS;
  room.infoMessage = "Rodada ativa. O primeiro a escolher impar ou par fica com a escolha.";
  resetRoundSelections(room);
  emitState(room);

  room.resolveTimeout = setTimeout(() => {
    resolveRound(room, "timeout");
  }, ROUND_TIME_MS);
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

function applyParityChoice(room, player, desiredParity) {
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

function resolveRound(room, reason = "submitted") {
  if (room.phase !== "playing") {
    return;
  }

  clearTimers(room);
  const players = room.players;

  if (room.parityOwnerSlot === null) {
    room.parityOwnerSlot = players[0]?.slot ?? 0;
    room.parityChoice = "odd";
  }

  players.forEach((player, index) => {
    const assignedParity = getAssignedParity(room, player) || (index === 0 ? "odd" : "even");
    if (!player.selection) {
      player.selection = createAutoSelection(room, player, index);
    }

    player.selection.parity = assignedParity;
    player.submitted = true;
  });

  const sum = players.reduce((accumulator, player) => accumulator + (player.selection?.number || 0), 0);
  const parity = sum % 2 === 0 ? "even" : "odd";
  const winner = players.find((player) => player.selection?.parity === parity) || null;

  pushHistoryEntry(room, { players, winner, parity, sum, reason });

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
  emitState(room);
}

function sanitizePlayerName(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const normalized = value.replace(/\s+/g, " ").trim().slice(0, 20);
  return normalized || fallback;
}

function getSocketPlayer(room, socketId) {
  return room.players.find((player) => player.socketId === socketId)
    || room.spectators.find((spectator) => spectator.socketId === socketId)
    || null;
}

function scheduleIdleTimeout(room) {
  clearIdleTimeout(room);

  if (room.players.length !== 1 || room.phase === "playing") {
    return;
  }

  room.infoMessage = "Aguardando o segundo jogador. A sala expira em 1 minuto.";
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

  if (room.players.length === 0 && room.spectators.length === 0) {
    removeRoom(room.roomCode);
    return;
  }

  if (wasPlayer) {
    if (room.phase === "playing") {
      setWaitingState(room, "Um jogador saiu da sala. A rodada foi reiniciada.");
    } else {
      setWaitingState(room, "Um jogador saiu da sala.");
    }
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
    });
    return;
  }

  const slot = room.players.some((player) => player.slot === 0) ? (room.players.some((player) => player.slot === 1) ? null : 1) : 0;
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
      : `${entry.name} entrou na sala. Agora voces ja podem marcar pronto.`;
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

  socket.on("player:ready", (payload) => {
    const room = getRoom(socket.data.roomCode);
    if (!room) return;

    const currentPlayer = room.players.find((player) => player.socketId === socket.id);
    if (!currentPlayer || room.phase === "playing") {
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
    if (!currentPlayer || currentPlayer.submitted) {
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
    if (!currentPlayer || room.phase !== "playing" || currentPlayer.submitted) {
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
