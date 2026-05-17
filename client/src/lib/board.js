export const COLORS = ["red", "green", "yellow", "blue"];
export const COLOR_LABEL = {
  red: "Red",
  green: "Green",
  yellow: "Yellow",
  blue: "Blue"
};
export const START_INDEX = {
  red: 0,
  green: 13,
  yellow: 26,
  blue: 39
};
export const TRACK_CELLS = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5], [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6], [0, 7], [0, 8],
  [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14], [7, 14], [8, 14],
  [8, 13], [8, 12], [8, 11], [8, 10], [8, 9], [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8], [14, 7], [14, 6],
  [13, 6], [12, 6], [11, 6], [10, 6], [9, 6], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0], [7, 0], [6, 0]
];
export const HOME_PATHS = {
  red: [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]],
  green: [[1, 7], [2, 7], [3, 7], [4, 7], [5, 7], [6, 7]],
  yellow: [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9], [7, 8]],
  blue: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7], [8, 7]]
};
export const YARDS = {
  red: [[1, 1], [1, 3], [3, 1], [3, 3]],
  green: [[1, 11], [1, 13], [3, 11], [3, 13]],
  yellow: [[11, 11], [11, 13], [13, 11], [13, 13]],
  blue: [[11, 1], [11, 3], [13, 1], [13, 3]]
};
export const SAFE_TRACK_INDEXES = [0, 8, 13, 21, 26, 34, 39, 47];

export function getCellKey(row, col) {
  return `${row}-${col}`;
}

export function getAbsoluteCell(color, progress) {
  if (progress < 0 || progress > 51) {
    return null;
  }

  return (START_INDEX[color] + progress) % 52;
}

export function getTokenPosition(color, progress, id) {
  if (progress === -1) {
    return YARDS[color][id];
  }

  if (progress >= 0 && progress <= 51) {
    return TRACK_CELLS[getAbsoluteCell(color, progress)];
  }

  return HOME_PATHS[color][progress - 52];
}

export const TRACK_CELL_KEYS = new Set(TRACK_CELLS.map(([row, col]) => getCellKey(row, col)));
export const HOME_CELL_KEYS = new Set(
  Object.values(HOME_PATHS).flat().map(([row, col]) => getCellKey(row, col))
);
export const SAFE_CELL_KEYS = new Set(
  SAFE_TRACK_INDEXES.map((index) => {
    const [row, col] = TRACK_CELLS[index];
    return getCellKey(row, col);
  })
);
export const START_CELL_BY_KEY = Object.fromEntries(
  Object.entries(START_INDEX).map(([color, index]) => {
    const [row, col] = TRACK_CELLS[index];
    return [getCellKey(row, col), color];
  })
);
