import assert from "node:assert/strict";
import test from "node:test";
import {
  createInitialGame,
  evaluateMove,
  getAbsoluteCell,
  getMovableTokenIds,
  moveToken,
  rollDice
} from "./ludoEngine.js";

const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};

function createGame(colors = ["red", "green"]) {
  const players = colors.map((color, index) => ({
    id: `player-${index + 1}`,
    color
  }));

  return createInitialGame(players);
}

function setPieceAtAbsolute(game, color, tokenId, absoluteCell) {
  game.pieces[color][tokenId].progress = (absoluteCell - START_INDEX[color] + 52) % 52;
}

test("a token needs six to leave the yard", () => {
  const game = createGame();
  assert.deepEqual(getMovableTokenIds(game, "red", 5), []);
  assert.deepEqual(getMovableTokenIds(game, "red", 6), [0, 1, 2, 3]);
});

test("captures happen on non-safe cells", () => {
  const game = createGame();

  game.currentTurn = "red";
  game.diceValue = 1;
  game.pieces.red[0].progress = 3;
  setPieceAtAbsolute(game, "green", 0, 4);

  const result = moveToken(game, "red", 0);

  assert.equal(result.captured, 1);
  assert.equal(game.pieces.green[0].progress, -1);
});

test("safe cells prevent captures", () => {
  const game = createGame();

  game.currentTurn = "red";
  game.diceValue = 1;
  game.pieces.red[0].progress = 12;
  game.pieces.green[0].progress = 0;

  const result = moveToken(game, "red", 0);

  assert.equal(getAbsoluteCell("red", game.pieces.red[0].progress), 13);
  assert.equal(result.captured, 0);
  assert.equal(game.pieces.green[0].progress, 0);
});

test("triple six loses the turn", () => {
  const game = createGame();
  const originalRandom = Math.random;

  Math.random = () => 0.99;

  try {
    rollDice(game, "red");
    game.diceValue = null;
    game.diceRolledBy = null;

    rollDice(game, "red");
    game.diceValue = null;
    game.diceRolledBy = null;

    const result = rollDice(game, "red");
    assert.equal(result.autoAdvanced, true);
    assert.equal(game.currentTurn, "green");
  } finally {
    Math.random = originalRandom;
  }
});

test("opponent blockades stop movement", () => {
  const game = createGame();
  game.pieces.red[0].progress = 1;
  setPieceAtAbsolute(game, "green", 0, 4);
  setPieceAtAbsolute(game, "green", 1, 4);

  const evaluation = evaluateMove(game, "red", 0, 3);
  assert.equal(evaluation.legal, false);
});

test("reaching home can finish the match", () => {
  const game = createGame();

  game.pieces.red.forEach((piece, index) => {
    piece.progress = index === 0 ? 56 : 57;
  });
  game.currentTurn = "red";
  game.diceValue = 1;

  const result = moveToken(game, "red", 0);

  assert.equal(result.finishedToken, true);
  assert.deepEqual(game.winners, ["red", "green"]);
  assert.equal(game.status, "finished");
});
