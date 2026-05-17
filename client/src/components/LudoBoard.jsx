import { useMemo } from "react";
import {
  COLORS,
  HOME_CELL_KEYS,
  SAFE_CELL_KEYS,
  START_CELL_BY_KEY,
  TRACK_CELL_KEYS,
  getCellKey,
  getTokenPosition
} from "../lib/board.js";

const STACK_OFFSETS = [
  { x: -8, y: -8 },
  { x: 8, y: -8 },
  { x: -8, y: 8 },
  { x: 8, y: 8 }
];

function getCellClasses(row, col) {
  const key = getCellKey(row, col);
  const classes = ["cell"];

  if (row < 6 && col < 6) classes.push("zone-red");
  if (row < 6 && col > 8) classes.push("zone-green");
  if (row > 8 && col > 8) classes.push("zone-yellow");
  if (row > 8 && col < 6) classes.push("zone-blue");
  if (TRACK_CELL_KEYS.has(key)) classes.push("track");
  if (HOME_CELL_KEYS.has(key)) classes.push("home-lane");
  if (SAFE_CELL_KEYS.has(key)) classes.push("safe-cell");
  if (START_CELL_BY_KEY[key]) classes.push(`start-${START_CELL_BY_KEY[key]}`);
  if (row >= 6 && row <= 8 && col >= 6 && col <= 8) classes.push("center");

  return classes.join(" ");
}

export function LudoBoard({ room, viewerColor, movableTokens, onMove }) {
  const movableSet = useMemo(
    () => new Set((movableTokens || []).map((tokenId) => `${viewerColor}-${tokenId}`)),
    [movableTokens, viewerColor]
  );

  const tokenGroups = useMemo(() => {
    const groups = new Map();

    for (const color of COLORS) {
      const pieces = room?.game?.pieces?.[color] || [];
      for (const piece of pieces) {
        const [row, col] = getTokenPosition(color, piece.progress, piece.id);
        const key = getCellKey(row, col);

        if (!groups.has(key)) {
          groups.set(key, []);
        }

        groups.get(key).push({
          color,
          id: piece.id,
          isMovable: movableSet.has(`${color}-${piece.id}`),
          isCurrentTurn: room?.game?.currentTurn === color
        });
      }
    }

    return groups;
  }, [movableSet, room]);

  return (
    <div className="board-shell">
      <div className="board">
        {Array.from({ length: 15 * 15 }, (_, index) => {
          const row = Math.floor(index / 15);
          const col = index % 15;
          const key = getCellKey(row, col);
          const entries = tokenGroups.get(key) || [];
          const startColor = START_CELL_BY_KEY[key];

          return (
            <div className={getCellClasses(row, col)} key={key}>
              {SAFE_CELL_KEYS.has(key) && <span className="cell-badge">*</span>}
              {startColor && <span className={`start-badge badge-${startColor}`}>S</span>}
              {row === 7 && col === 7 && <span className="center-label">LUDO</span>}
              {entries.map((entry, stackIndex) => (
                <button
                  className={[
                    "token",
                    `token-${entry.color}`,
                    entry.isCurrentTurn ? "turn-active" : "",
                    entry.isMovable ? "token-movable" : ""
                  ].join(" ")}
                  disabled={!entry.isMovable}
                  key={`${entry.color}-${entry.id}`}
                  onClick={() => onMove(entry.id)}
                  style={{
                    transform: `translate(${STACK_OFFSETS[stackIndex % STACK_OFFSETS.length].x}px, ${STACK_OFFSETS[stackIndex % STACK_OFFSETS.length].y}px)`
                  }}
                  type="button"
                >
                  <span>{entry.id + 1}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
