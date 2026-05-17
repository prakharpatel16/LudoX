import dotenv from "dotenv";

dotenv.config();

const defaultOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const extraOrigins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean)
  : [];
const configuredOrigins = [...new Set([...defaultOrigins, ...extraOrigins])];

export const config = {
  port: Number(process.env.PORT || 4000),
  clientOrigins: configuredOrigins,
  mongoUri: process.env.MONGO_URI || ""
};
