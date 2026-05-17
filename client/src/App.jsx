import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import { Dice } from "./components/Dice.jsx";
import { LudoBoard } from "./components/LudoBoard.jsx";
import { COLOR_LABEL } from "./lib/board.js";

const defaultServerUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
const socket = io(import.meta.env.VITE_SERVER_URL || defaultServerUrl, { autoConnect: false });

function summarizePieces(room, color) {
  const pieces = room?.game?.pieces?.[color] || [];

  return {
    yard: pieces.filter((piece) => piece.progress === -1).length,
    home: pieces.filter((piece) => piece.progress === 57).length
  };
}

function LobbyPanel({ playerName, room, onCreate, onJoin, onStart }) {
  const [name, setName] = useState(playerName);
  const [roomCode, setRoomCode] = useState("");

  useEffect(() => {
    setName(playerName);
  }, [playerName]);

  return (
    <div className="sidebar-card">
      <h2>Lobby</h2>
      <label>
        Name
        <input onChange={(event) => setName(event.target.value)} placeholder="Your name" value={name} />
      </label>
      <div className="actions">
        <button onClick={() => onCreate(name)} type="button">
          Create Room
        </button>
      </div>
      <label>
        Room code
        <input
          onChange={(event) => setRoomCode(event.target.value.toUpperCase())}
          placeholder="ABC123"
          value={roomCode}
        />
      </label>
      <div className="actions">
        <button onClick={() => onJoin(name, roomCode)} type="button">
          Join Room
        </button>
      </div>

      {room && (
        <>
          <p className="room-code">Room: {room.code}</p>
          <div className="player-list">
            {room.players.map((player) => (
              <div className={`player-chip chip-${player.color || "waiting"}`} key={player.id}>
                <span>{player.name}</span>
                <span>{player.color ? COLOR_LABEL[player.color] : player.isBot ? "Bot" : "Waiting"}</span>
              </div>
            ))}
          </div>
          {room.canStart && (
            <button className="primary" onClick={onStart} type="button">
              Start Game
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function App() {
  const [room, setRoom] = useState(null);
  const [playerName, setPlayerName] = useState(() => window.localStorage.getItem("ludo.playerName") || "");
  const [message, setMessage] = useState("Create or join a room to begin.");
  const [rolling, setRolling] = useState(false);

  useEffect(() => {
    socket.connect();

    socket.on("room:update", (nextRoom) => {
      setRoom(nextRoom);
      if (nextRoom.game?.lastAction) {
        setMessage(nextRoom.game.lastAction);
      }
      setRolling(false);
    });
    socket.on("connect_error", () => {
      setRolling(false);
      setMessage(`Connection failed. Make sure the backend is running on ${defaultServerUrl}.`);
    });

    return () => {
      socket.off("room:update");
      socket.off("connect_error");
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem("ludo.playerName", playerName);
  }, [playerName]);

  const myPlayer = room?.viewer || null;
  const isMyTurn = Boolean(room?.game && room.game.currentTurn === room.viewerColor);
  const myStats = myPlayer?.color ? summarizePieces(room, myPlayer.color) : null;

  function emitWithAck(eventName, payload) {
    return new Promise((resolve) => {
      if (payload === undefined) {
        socket.emit(eventName, (response) => resolve(response));
        return;
      }

      socket.emit(eventName, payload, (response) => resolve(response));
    });
  }

  async function createRoom(name) {
    const response = await emitWithAck("room:create", { name });
    if (response.ok) {
      setPlayerName(name);
    }
    setMessage(response.ok ? `Joined room ${response.roomCode}` : response.message);
  }

  async function joinRoom(name, roomCode) {
    const response = await emitWithAck("room:join", { name, roomCode });
    if (response.ok) {
      setPlayerName(name);
    }
    setMessage(response.ok ? `Joined room ${response.roomCode}` : response.message);
  }

  async function startGame() {
    const response = await emitWithAck("game:start");
    setMessage(response.ok ? "Game started" : response.message);
  }

  async function addBot() {
    const response = await emitWithAck("room:add-bot");
    setMessage(response.ok ? "Bot added to the room" : response.message);
  }

  async function restartGame() {
    const response = await emitWithAck("game:restart");
    setMessage(response.ok ? "New match started" : response.message);
  }

  async function rollDice() {
    setRolling(true);
    const response = await emitWithAck("game:roll");
    if (!response.ok) {
      setRolling(false);
    }
    setMessage(response.ok ? "Dice rolling..." : response.message);
  }

  async function movePiece(tokenId) {
    const response = await emitWithAck("game:move", { tokenId });
    setMessage(response.ok ? `Moved token ${tokenId + 1}` : response.message);
  }

  async function copyRoomCode() {
    if (!room?.code) {
      return;
    }

    try {
      await navigator.clipboard.writeText(room.code);
      setMessage(`Copied room code ${room.code}`);
    } catch {
      setMessage(`Clipboard copy failed. Room code: ${room.code}`);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1>MERN Ludo</h1>
        <p className="status">{message}</p>

        <LobbyPanel
          onCreate={createRoom}
          onJoin={joinRoom}
          onStart={startGame}
          playerName={playerName}
          room={room}
        />

        {room?.code && (
          <div className="sidebar-card">
            <h2>Room Tools</h2>
            <div className="actions">
              <button onClick={copyRoomCode} type="button">
                Copy Room Code
              </button>
              {room.canAddBot && (
                <button onClick={addBot} type="button">
                  Add Bot
                </button>
              )}
              {room.canRestart && (
                <button onClick={restartGame} type="button">
                  Play Again
                </button>
              )}
            </div>
          </div>
        )}

        {room?.game && (
          <div className="sidebar-card">
            <h2>Turn</h2>
            <p>{COLOR_LABEL[room.game.currentTurn]} to play</p>
            <p>Last action: {room.game.lastAction}</p>
            <Dice
              currentColor={room.game.currentTurn}
              disabled={!isMyTurn || room.game.diceValue !== null || room.game.status === "finished"}
              onRoll={rollDice}
              rolling={rolling}
              value={room.game.diceValue || room.game.lastRoll}
            />
            {(room.movableTokens || []).length > 0 && (
              <p className="hint">Click one of your glowing tokens on the board to move it.</p>
            )}
          </div>
        )}

        {myPlayer && (
          <div className="sidebar-card">
            <h2>You</h2>
            <p>{myPlayer.name}</p>
            <p>{myPlayer.color ? COLOR_LABEL[myPlayer.color] : "Waiting for colors"}</p>
            {myStats && (
              <div className="stats-grid">
                <div>
                  <strong>{myStats.yard}</strong>
                  <span>In Yard</span>
                </div>
                <div>
                  <strong>{myStats.home}</strong>
                  <span>Home</span>
                </div>
              </div>
            )}
          </div>
        )}

        {room?.game?.activity?.length > 0 && (
          <div className="sidebar-card">
            <h2>Match Feed</h2>
            <div className="feed-list">
              {room.game.activity.map((entry, index) => (
                <div className="feed-item" key={`${entry}-${index}`}>
                  {entry}
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      <main className="main-panel">
        <div className="player-strip">
          {room?.players.map((player) => {
            const stats = player.color ? summarizePieces(room, player.color) : { yard: 4, home: 0 };

            return (
              <div
                className={`seat-card seat-${player.color || "waiting"} ${
                  room?.game?.currentTurn === player.color ? "seat-active" : ""
                }`}
                key={player.id}
              >
                <span className="seat-name">
                  {player.name}
                  {player.isHost ? " (Host)" : ""}
                  {player.isBot ? " [Bot]" : ""}
                </span>
                <span>{player.color ? COLOR_LABEL[player.color] : "Lobby"}</span>
                <span>{player.isConnected ? "Connected" : "Disconnected"}</span>
                {player.color && (
                  <span>
                    Yard {stats.yard} | Home {stats.home}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <LudoBoard
          movableTokens={room?.movableTokens || []}
          onMove={movePiece}
          room={room}
          viewerColor={room?.viewerColor || null}
        />

        {room?.game?.winners?.length > 0 && (
          <div className="results">
            {room.game.winners.map((color, index) => (
              <div className="result-chip" key={color}>
                #{index + 1} {COLOR_LABEL[color]}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
