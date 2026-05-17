const COLORS = ["red", "green", "yellow", "blue"];
const COLOR_LABEL = {
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue"
};
const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};
const SAFE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const FINISH_PROGRESS = 57;
const ACTIVITY_LIMIT = 18;

const clone = (value) => JSON.parse(JSON.stringify(value));

function pushActivity(game, message) {
  game.lastAction = message;
  game.activity = [message, ...(game.activity || [])].slice(0, ACTIVITY_LIMIT);
}

function getColorLabel(color) {
  return COLOR_LABEL[color] || color;
}

function getTrackState(game) {
  const trackState = new Map();

  for (const color of game.turnOrder) {
    const pieces = game.pieces[color] || [];
    for (const piece of pieces) {
      const cell = getAbsoluteCell(color, piece.progress);
      if (cell === null) {
        continue;
      }

      if (!trackState.has(cell)) {
        trackState.set(cell, { tokens: [], colorCounts: {} });
      }

      const entry = trackState.get(cell);
      entry.tokens.push({ color, id: piece.id });
      entry.colorCounts[color] = (entry.colorCounts[color] || 0) + 1;
    }
  }

  return trackState;
}

function getBlockadeColor(trackState, cell) {
  const entry = trackState.get(cell);
  if (!entry) {
    return null;
  }

  return Object.entries(entry.colorCounts).find(([, count]) => count >= 2)?.[0] || null;
}

function isLegalTrackTraversal(game, color, currentProgress, targetProgress) {
  const trackState = getTrackState(game);

  if (currentProgress < 0) {
    const landingCell = getAbsoluteCell(color, 0);
    const blockadeColor = getBlockadeColor(trackState, landingCell);
    return !blockadeColor || blockadeColor === color;
  }

  const lastTrackProgress = Math.min(targetProgress, 51);

  for (let progress = currentProgress + 1; progress <= lastTrackProgress; progress += 1) {
    const cell = getAbsoluteCell(color, progress);
    const blockadeColor = getBlockadeColor(trackState, cell);
    if (blockadeColor && blockadeColor !== color) {
      return false;
    }
  }

  return true;
}

function getNextTurnColor(game, color) {
  const activeOrder = game.turnOrder.filter((entry) => !game.winners.includes(entry));
  if (activeOrder.length === 0) {
    return color;
  }

  const currentIndex = activeOrder.indexOf(color);
  if (currentIndex === -1) {
    return activeOrder[0];
  }

  return activeOrder[(currentIndex + 1) % activeOrder.length];
}

function sendCapturedPiecesHome(game, movingColor, landingCell) {
  if (SAFE_CELLS.has(landingCell)) {
    return 0;
  }

  let captured = 0;

  for (const color of game.turnOrder) {
    if (color === movingColor) {
      continue;
    }

    for (const piece of game.pieces[color] || []) {
      if (getAbsoluteCell(color, piece.progress) === landingCell) {
        piece.progress = -1;
        captured += 1;
      }
    }
  }

  return captured;
}

function markWinner(game, color) {
  const finished = (game.pieces[color] || []).every((piece) => piece.progress === FINISH_PROGRESS);

  if (finished && !game.winners.includes(color)) {
    game.winners.push(color);
  }

  if (game.winners.length === game.turnOrder.length - 1) {
    const lastColor = game.turnOrder.find((entry) => !game.winners.includes(entry));
    if (lastColor) {
      game.winners.push(lastColor);
    }
    game.status = "finished";
  }
}

export function assignColors(players) {
  return players.map((player, index) => ({
    ...player,
    color: COLORS[index]
  }));
}

export function createInitialGame(players) {
  const turnOrder = players.map((player) => player.color);
  const pieces = Object.fromEntries(
    turnOrder.map((color) => [
      color,
      Array.from({ length: 4 }, (_, id) => ({ id, progress: -1 }))
    ])
  );

  return {
    status: "playing",
    turnOrder,
    currentTurn: turnOrder[0],
    diceValue: null,
    diceRolledBy: null,
    lastRoll: null,
    lastAction: "Game started",
    activity: ["Game started"],
    winners: [],
    moveCount: 0,
    consecutiveSixes: Object.fromEntries(turnOrder.map((color) => [color, 0])),
    pieces
  };
}

export function getAbsoluteCell(color, progress) {
  if (progress < 0 || progress > 51) {
    return null;
  }

  return (START_INDEX[color] + progress) % 52;
}

export function evaluateMove(game, color, tokenId, diceValue) {
  const piece = game.pieces[color]?.[tokenId];
  if (!piece) {
    return { legal: false, reason: "Invalid token." };
  }

  if (piece.progress === -1 && diceValue !== 6) {
    return { legal: false, reason: "A six is required to leave the yard." };
  }

  const targetProgress = piece.progress === -1 ? 0 : piece.progress + diceValue;
  if (targetProgress > FINISH_PROGRESS) {
    return { legal: false, reason: "Move overshoots home." };
  }

  if (!isLegalTrackTraversal(game, color, piece.progress, targetProgress)) {
    return { legal: false, reason: "An opponent blockade is in the way." };
  }

  if (targetProgress > 51) {
    return {
      legal: true,
      targetProgress,
      landingCell: null,
      captureCount: 0,
      finished: targetProgress === FINISH_PROGRESS,
      exitsBase: piece.progress === -1
    };
  }

  const trackState = getTrackState(game);
  const landingCell = getAbsoluteCell(color, targetProgress);
  const blockadeColor = getBlockadeColor(trackState, landingCell);

  if (blockadeColor && blockadeColor !== color) {
    return { legal: false, reason: "A blockade occupies the destination." };
  }

  const entry = trackState.get(landingCell);
  const captureCount = SAFE_CELLS.has(landingCell)
    ? 0
    : (entry?.tokens.filter((token) => token.color !== color).length || 0);

  return {
    legal: true,
    targetProgress,
    landingCell,
    captureCount,
    finished: targetProgress === FINISH_PROGRESS,
    exitsBase: piece.progress === -1
  };
}

export function getMovableTokenIds(game, color, diceValue) {
  return (game.pieces[color] || [])
    .filter((piece) => evaluateMove(game, color, piece.id, diceValue).legal)
    .map((piece) => piece.id);
}

export function pickBotToken(game, color, diceValue) {
  const moves = getMovableTokenIds(game, color, diceValue)
    .map((tokenId) => ({
      tokenId,
      ...evaluateMove(game, color, tokenId, diceValue)
    }))
    .sort((left, right) => {
      if (right.finished !== left.finished) {
        return Number(right.finished) - Number(left.finished);
      }

      if (right.captureCount !== left.captureCount) {
        return right.captureCount - left.captureCount;
      }

      if (right.exitsBase !== left.exitsBase) {
        return Number(right.exitsBase) - Number(left.exitsBase);
      }

      return right.targetProgress - left.targetProgress;
    });

  return moves[0]?.tokenId ?? null;
}

export function rollDice(game, color) {
  if (game.status !== "playing") {
    throw new Error("Game is not active.");
  }

  if (game.currentTurn !== color) {
    throw new Error("It is not your turn.");
  }

  if (game.diceValue !== null) {
    throw new Error("Move the current token before rolling again.");
  }

  const value = Math.floor(Math.random() * 6) + 1;
  const label = getColorLabel(color);

  game.diceValue = value;
  game.lastRoll = value;
  game.diceRolledBy = color;
  game.consecutiveSixes[color] = value === 6 ? game.consecutiveSixes[color] + 1 : 0;
  pushActivity(game, `${label} rolled ${value}`);

  if (game.consecutiveSixes[color] >= 3) {
    game.consecutiveSixes[color] = 0;
    game.diceValue = null;
    game.diceRolledBy = null;
    game.currentTurn = getNextTurnColor(game, color);
    pushActivity(game, `${label} rolled three sixes and lost the turn`);
    return { autoAdvanced: true, movable: [] };
  }

  const movable = getMovableTokenIds(game, color, value);
  if (movable.length === 0) {
    game.diceValue = null;
    game.diceRolledBy = null;
    game.currentTurn = getNextTurnColor(game, color);
    pushActivity(game, `${label} rolled ${value} but had no legal move`);
    return { autoAdvanced: true, movable: [] };
  }

  return { autoAdvanced: false, movable };
}

export function moveToken(game, color, tokenId) {
  if (game.status !== "playing") {
    throw new Error("Game is not active.");
  }

  if (game.currentTurn !== color) {
    throw new Error("It is not your turn.");
  }

  if (game.diceValue === null) {
    throw new Error("Roll the dice first.");
  }

  const move = evaluateMove(game, color, tokenId, game.diceValue);
  if (!move.legal) {
    throw new Error(move.reason);
  }

  const piece = game.pieces[color][tokenId];
  const rolledValue = game.diceValue;
  const label = getColorLabel(color);

  piece.progress = move.targetProgress;
  const captured = move.landingCell !== null ? sendCapturedPiecesHome(game, color, move.landingCell) : 0;
  const finishedToken = move.targetProgress === FINISH_PROGRESS;

  game.moveCount += 1;
  markWinner(game, color);

  const earnedExtraTurn = rolledValue === 6 || captured > 0 || finishedToken;
  const colorFinishedMatch = game.winners.includes(color);
  const actionParts = [`${label} moved token ${tokenId + 1}`];

  if (captured > 0) {
    actionParts.push(`captured ${captured} token${captured > 1 ? "s" : ""}`);
  }

  if (finishedToken) {
    actionParts.push("reached home");
  }

  if (earnedExtraTurn && !colorFinishedMatch && game.status !== "finished") {
    actionParts.push("earned an extra turn");
  }

  if (colorFinishedMatch) {
    actionParts.push("finished all tokens");
  }

  pushActivity(game, actionParts.join(" and "));

  game.diceValue = null;
  game.diceRolledBy = null;

  if (game.status !== "finished" && (colorFinishedMatch || !earnedExtraTurn)) {
    game.currentTurn = getNextTurnColor(game, color);
  }

  if (rolledValue !== 6 || colorFinishedMatch) {
    game.consecutiveSixes[color] = 0;
  }

  return {
    captured,
    finishedToken,
    earnedExtraTurn,
    snapshot: clone(game)
  };
}
