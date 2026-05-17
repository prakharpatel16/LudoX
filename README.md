# MERN Ludo

A real-time multiplayer Ludo baseline built with:

- MongoDB + Mongoose for optional persistence
- Express + Socket.IO for the backend
- React + Vite for the client

## Features in this baseline

- 2 to 4 player room system
- Server-authoritative Ludo engine
- Real-time dice rolls and moves over Socket.IO
- Clickable Ludo board with animated dice and token states
- Captures, safe cells, blockades, home lane movement, extra turns, and triple-six penalty
- Host-managed bots for instant matches
- Match feed and restart flow
- Match persistence hook when MongoDB is configured

## Project structure

```text
client/   React + Vite frontend
server/   Express + Socket.IO backend
```

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Create `server/.env` if you want MongoDB persistence:

```bash
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
MONGO_URI=mongodb://127.0.0.1:27017/ludo
```

3. Start both apps:

```bash
npm run dev
```

4. Run gameplay tests:

```bash
npm test
```

## Important scope note

This is a solid multiplayer baseline, not a pixel-perfect clone of Ludo King. The game engine is server-authoritative and structured so you can extend it with:

- auth and player accounts
- bot opponents
- matchmaking and ranked play
- reconnection recovery backed by Redis/Mongo
- animations, sound effects, and richer board art
- production deployment setup
