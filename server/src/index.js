import cors from "cors";
import express from "express";
import http from "http";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { config } from "./config.js";
import { registerGameHandlers } from "./socket/registerGameHandlers.js";

const app = express();
const corsOptions = {
  origin(origin, callback) {
    if (!origin || config.clientOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS.`));
  }
};

app.use(cors(corsOptions));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

registerGameHandlers(io);

if (config.mongoUri) {
  mongoose
    .connect(config.mongoUri)
    .then(() => console.log("MongoDB connected"))
    .catch((error) => console.error("MongoDB connection failed:", error.message));
} else {
  console.log("Starting without MongoDB persistence. Set MONGO_URI to enable it.");
}

server.listen(config.port, () => {
  console.log(`Allowed client origins: ${config.clientOrigins.join(", ")}`);
  console.log(`Server listening on port ${config.port}`);
});
