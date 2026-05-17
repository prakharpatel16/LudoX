const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8]
};

export function Dice({ value, rolling, disabled, onRoll, currentColor }) {
  const face = value || 1;

  return (
    <div className="dice-card">
      <button
        className={`dice-button turn-${currentColor || "red"} ${rolling ? "rolling" : ""}`}
        disabled={disabled}
        onClick={onRoll}
        type="button"
      >
        <span className="dice-grid" aria-hidden="true">
          {Array.from({ length: 9 }, (_, index) => (
            <span className={`pip ${PIPS[face].includes(index) ? "visible" : ""}`} key={index} />
          ))}
        </span>
      </button>
      <p className="dice-label">{value ? `Rolled ${value}` : "Roll to begin your turn"}</p>
    </div>
  );
}
