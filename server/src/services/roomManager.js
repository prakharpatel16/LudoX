import { randomUUID } from "crypto";
import mongoose from "mongoose";
import { GameRecord } from "../models/GameRecord.js";
import {
  assignColors,
  createInitialGame,
  getMovableTokenIds,
  moveToken,
  pickBotToken,
  rollDice
} from "./ludoEngine.js";

function createRoomCode(existingRooms) {
  let roomCode = "";

  do {
    roomCode = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (existingRooms.has(roomCode));

  return roomCode;
}

function sanitizePlayer(player) {
  return {
    id: player.id,
    name: player.name,
    color: player.color || null,
    isHost: player.isHost,
    isConnected: player.isConnected,
    isBot: player.isBot
  };
}

export class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  createPlayer({ name, socketId = null, isHost = false, isBot = false }) {
    return {
      id: randomUUID(),
      socketId,
      name: name || (isBot ? "Bot" : "Player"),
      isHost,
      isBot,
      isConnected: true,
      color: null
    };
  }

  createRoom(playerName, socketId) {
    const roomCode = createRoomCode(this.rooms);
    const host = this.createPlayer({
      name: playerName || "Player 1",
      socketId,
      isHost: true
    });

    const room = {
      code: roomCode,
      players: [host],
      game: null
    };

    this.rooms.set(roomCode, room);
    return { room, player: host };
  }

  joinRoom(roomCode, playerName, socketId) {
    if (!roomCode) {
      throw new Error("Room code is required.");
    }

    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error("Room not found.");
    }

    if (room.players.length >= 4) {
      throw new Error("Room is full.");
    }

    if (room.game?.status === "playing") {
      throw new Error("Game already started.");
    }

    const player = this.createPlayer({
      name: playerName || `Player ${room.players.length + 1}`,
      socketId
    });

    room.players.push(player);
    return { room, player };
  }

  addBot(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      throw new Error("Room not found.");
    }

    const host = this.findPlayerBySocket(socketId, room);
    if (!host?.isHost) {
      throw new Error("Only the host can add bots.");
    }

    if (room.game) {
      throw new Error("Bots can only be added before the game starts.");
    }

    if (room.players.length >= 4) {
      throw new Error("Room is full.");
    }

    const botNumber = room.players.filter((player) => player.isBot).length + 1;
    room.players.push(
      this.createPlayer({
        name: `Bot ${botNumber}`,
        isBot: true
      })
    );

    return room;
  }

  markDisconnected(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      return null;
    }

    const player = this.findPlayerBySocket(socketId, room);
    if (!player) {
      return null;
    }

    player.isConnected = false;
    player.socketId = null;
    return room;
  }

  findPlayerBySocket(socketId, room = this.getRoomBySocket(socketId)) {
    return room?.players.find((entry) => entry.socketId === socketId) || null;
  }

  findPlayerById(playerId, room = this.getRoomByPlayerId(playerId)) {
    return room?.players.find((entry) => entry.id === playerId) || null;
  }

  getRoomBySocket(socketId) {
    for (const room of this.rooms.values()) {
      if (room.players.some((entry) => entry.socketId === socketId)) {
        return room;
      }
    }

    return null;
  }

  getRoomByPlayerId(playerId) {
    for (const room of this.rooms.values()) {
      if (room.players.some((entry) => entry.id === playerId)) {
        return room;
      }
    }

    return null;
  }

  getCurrentPlayer(room) {
    return room?.players.find((player) => player.color === room.game?.currentTurn) || null;
  }

  startGame(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      throw new Error("Room not found.");
    }

    const host = this.findPlayerBySocket(socketId, room);
    if (!host?.isHost) {
      throw new Error("Only the host can start the game.");
    }

    if (room.players.length < 2) {
      throw new Error("At least two players are required.");
    }

    if (room.game?.status === "playing") {
      throw new Error("Game already in progress.");
    }

    room.players = assignColors(room.players);
    room.game = createInitialGame(room.players);
    return room;
  }

  restartGame(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room) {
      throw new Error("Room not found.");
    }

    const host = this.findPlayerBySocket(socketId, room);
    if (!host?.isHost) {
      throw new Error("Only the host can restart the game.");
    }

    if (room.players.length < 2) {
      throw new Error("At least two players are required.");
    }

    room.players = assignColors(room.players.map((player) => ({ ...player, color: null })));
    room.game = createInitialGame(room.players);
    return room;
  }

  roll(socketId) {
    const room = this.getRoomBySocket(socketId);
    if (!room?.game) {
      throw new Error("Game not found.");
    }

    const player = this.findPlayerBySocket(socketId, room);
    if (!player) {
      throw new Error("Player not found.");
    }

    const result = rollDice(room.game, player.color);
    return { room, result, player };
  }

  rollByPlayerId(playerId) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room?.game) {
      throw new Error("Game not found.");
    }

    const player = this.findPlayerById(playerId, room);
    if (!player) {
      throw new Error("Player not found.");
    }

    const result = rollDice(room.game, player.color);
    return { room, result, player };
  }

  move(socketId, tokenId) {
    const room = this.getRoomBySocket(socketId);
    if (!room?.game) {
      throw new Error("Game not found.");
    }

    const player = this.findPlayerBySocket(socketId, room);
    if (!player) {
      throw new Error("Player not found.");
    }

    const result = moveToken(room.game, player.color, tokenId);
    return { room, result, player };
  }

  moveByPlayerId(playerId, tokenId) {
    const room = this.getRoomByPlayerId(playerId);
    if (!room?.game) {
      throw new Error("Game not found.");
    }

    const player = this.findPlayerById(playerId, room);
    if (!player) {
      throw new Error("Player not found.");
    }

    const result = moveToken(room.game, player.color, tokenId);
    return { room, result, player };
  }

  chooseBotMove(playerId) {
    const room = this.getRoomByPlayerId(playerId);
    const player = this.findPlayerById(playerId, room);
    if (!room?.game || !player || room.game.diceValue === null) {
      return null;
    }

    return pickBotToken(room.game, player.color, room.game.diceValue);
  }

  getMovableTokens(socketId) {
    const room = this.getRoomBySocket(socketId);
    const player = this.findPlayerBySocket(socketId, room);
    if (!room?.game || !player || room.game.diceValue === null) {
      return [];
    }

    return getMovableTokenIds(room.game, player.color, room.game.diceValue);
  }

  getMovableTokensByPlayerId(playerId) {
    const room = this.getRoomByPlayerId(playerId);
    const player = this.findPlayerById(playerId, room);
    if (!room?.game || !player || room.game.diceValue === null) {
      return [];
    }

    return getMovableTokenIds(room.game, player.color, room.game.diceValue);
  }

  async persistFinishedGame(room) {
    if (!room?.game || room.game.status !== "finished") {
      return;
    }

    if (mongoose.connection.readyState !== 1) {
      return;
    }

    try {
      await GameRecord.create({
        roomCode: room.code,
        status: room.game.status,
        players: room.players.map((player) => ({
          playerId: player.id,
          name: player.name,
          color: player.color,
          rank: room.game.winners.indexOf(player.color) + 1
        })),
        winners: room.game.winners,
        moves: room.game.moveCount
      });
    } catch (error) {
      console.error("Failed to persist game record:", error.message);
    }
  }

  serializeRoom(room, socketId) {
    const viewer = this.findPlayerBySocket(socketId, room);

    return {
      code: room.code,
      players: room.players.map(sanitizePlayer),
      game: room.game,
      viewer: viewer ? sanitizePlayer(viewer) : null,
      viewerColor: viewer?.color || null,
      movableTokens: viewer ? this.getMovableTokensByPlayerId(viewer.id) : [],
      canAddBot: Boolean(viewer?.isHost && !room.game && room.players.length < 4),
      canStart: Boolean(viewer?.isHost && !room.game && room.players.length >= 2),
      canRestart: Boolean(viewer?.isHost && room.game?.status === "finished")
    };
  }
}
