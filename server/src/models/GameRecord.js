import mongoose from "mongoose";

const gameRecordSchema = new mongoose.Schema(
  {
    roomCode: { type: String, required: true },
    status: { type: String, required: true },
    players: [
      {
        playerId: String,
        name: String,
        color: String,
        rank: Number
      }
    ],
    winners: [String],
    moves: { type: Number, default: 0 }
  },
  { timestamps: true }
);

export const GameRecord = mongoose.model("GameRecord", gameRecordSchema);

