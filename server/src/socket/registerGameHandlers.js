import { RoomManager } from "../services/roomManager.js";

const roomManager = new RoomManager();
const botTimers = new Map();

function clearBotTimer(roomCode) {
  const timer = botTimers.get(roomCode);
  if (timer) {
    clearTimeout(timer);
    botTimers.delete(roomCode);
  }
}

function emitRoom(io, room) {
  clearBotTimer(room.code);

  for (const player of room.players) {
    if (!player.isBot && player.socketId) {
      io.to(player.socketId).emit("room:update", roomManager.serializeRoom(room, player.socketId));
    }
  }

  scheduleBotTurn(io, room);
}

async function runBotTurn(io, roomCode) {
  botTimers.delete(roomCode);
  const room = roomManager.rooms.get(roomCode);
  if (!room?.game || room.game.status !== "playing") {
    return;
  }

  const currentPlayer = roomManager.getCurrentPlayer(room);
  if (!currentPlayer?.isBot) {
    return;
  }

  try {
    if (room.game.diceValue === null) {
      roomManager.rollByPlayerId(currentPlayer.id);
      emitRoom(io, room);
      return;
    }

    const tokenId = roomManager.chooseBotMove(currentPlayer.id);
    if (tokenId === null) {
      return;
    }

    const { room: updatedRoom } = roomManager.moveByPlayerId(currentPlayer.id, tokenId);
    emitRoom(io, updatedRoom);
    await roomManager.persistFinishedGame(updatedRoom);
  } catch (error) {
    console.error("Bot turn failed:", error.message);
  }
}

function scheduleBotTurn(io, room) {
  clearBotTimer(room.code);

  if (!room?.game || room.game.status !== "playing") {
    return;
  }

  const currentPlayer = roomManager.getCurrentPlayer(room);
  if (!currentPlayer?.isBot) {
    return;
  }

  const delay = room.game.diceValue === null ? 900 : 650;
  const timer = setTimeout(() => {
    runBotTurn(io, room.code);
  }, delay);

  botTimers.set(room.code, timer);
}

export function registerGameHandlers(io) {
  io.on("connection", (socket) => {
    socket.on("room:create", ({ name }, callback) => {
      try {
        const { room, player } = roomManager.createRoom(name, socket.id);
        socket.join(room.code);
        emitRoom(io, room);
        callback?.({ ok: true, roomCode: room.code, playerId: player.id });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("room:join", ({ name, roomCode }, callback) => {
      try {
        const { room, player } = roomManager.joinRoom(roomCode.toUpperCase(), name, socket.id);
        socket.join(room.code);
        emitRoom(io, room);
        callback?.({ ok: true, roomCode: room.code, playerId: player.id });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("room:add-bot", (callback) => {
      try {
        const room = roomManager.addBot(socket.id);
        emitRoom(io, room);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("game:start", (callback) => {
      try {
        const room = roomManager.startGame(socket.id);
        emitRoom(io, room);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("game:roll", (callback) => {
      try {
        const { room } = roomManager.roll(socket.id);
        emitRoom(io, room);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("game:move", ({ tokenId }, callback) => {
      try {
        const { room } = roomManager.move(socket.id, tokenId);
        emitRoom(io, room);
        roomManager.persistFinishedGame(room);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("game:restart", (callback) => {
      try {
        const room = roomManager.restartGame(socket.id);
        emitRoom(io, room);
        callback?.({ ok: true });
      } catch (error) {
        callback?.({ ok: false, message: error.message });
      }
    });

    socket.on("disconnect", () => {
      const room = roomManager.markDisconnected(socket.id);
      if (room) {
        emitRoom(io, room);
      }
    });
  });
}
