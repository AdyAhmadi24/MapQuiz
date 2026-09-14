# GeoQuiz - Kahoot-style Quiz with Map Questions

A real-time multiplayer quiz game inspired by Kahoot, featuring Saterra/GeoGuessr-style map-based questions using Google Maps.

## Features

- **Host & Join Flow**: Create games with PIN codes, players join via 6-digit code
- **Map Questions**: Click on Google Maps to guess locations (Saterra-style)
- **Multiple Choice**: Traditional quiz questions
- **Real-time Scoring**: Live leaderboard with distance-based scoring for map questions
- **Dark Theme**: Sleek dark UI with neon accents

## Tech Stack

- **Frontend**: React 18 + Leaflet + OpenStreetMap
- **Backend**: Node.js + Express + Socket.io
- **Real-time**: WebSocket communication for live gameplay

## Setup

### 1. Map Setup

The client uses Leaflet with OpenStreetMap tiles. No API key or billing account is required. The map includes the required OpenStreetMap attribution and is intended for light development and personal use.

### 2. Configure Environment

```bash
cd client
# No environment variables are required for the map.
```

### 3. Install Dependencies

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 4. Run the App

**Terminal 1 - Start Server:**
```bash
cd server
npm start
# Runs on http://localhost:3001
```

**Terminal 2 - Start Client:**
```bash
cd client
npm start
# Runs on http://localhost:3000
```

## Exhibition Mode on a Local Network

Exhibition Mode supports multiple devices without internet by using the host laptop as a local server. Connect the host laptop and player devices to the same Wi-Fi or hotspot.

On Windows PowerShell, find the host laptop IP address:

```powershell
ipconfig
# Use the IPv4 Address, for example 192.168.1.25
```

Start the server so it accepts LAN connections:

```powershell
cd server
npm start
```

Start the client on all network interfaces:

```powershell
cd client
$env:HOST="0.0.0.0"
npm start
```

Open `http://HOST_IP:3000` on the host and player devices, for example `http://192.168.1.25:3000`. Choose **Exhibition Mode**. The host selects **Host a Game**, creates a PIN, and players select **Join Game** and enter that PIN. The game data, PIN, and scoring are handled by the local server; internet is not required.

If Windows Firewall asks for access, allow Node.js on the private network. The map game still requires map tiles from OpenStreetMap unless map tiles are cached or hosted locally.

## Persistent Scoreboard

The server stores completed game results in PostgreSQL. Player names and final scores are saved when the host finishes a game, and remain available after the server restarts.

Set the PostgreSQL connection string before starting the server:

```powershell
$env:DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE"
cd server
npm start
```

The server creates the `game_results` table and its index automatically on startup.

Only games created from **Online Mode** are saved to PostgreSQL and included in the permanent scoreboard. **Exhibition Mode** uses the server only for the live game session; its names and scores are not written to PostgreSQL and are not shown in the permanent scoreboard.

The top scores can also be read from:

```text
GET http://HOST_IP:3001/api/scoreboard?limit=20
```

Use a managed PostgreSQL provider for deployment and keep `DATABASE_URL` in the provider's environment variables. Do not commit database credentials.

## How to Play

1. **Host**: Click "Host a Game" → "Create Game" → Share the 6-digit PIN
2. **Players**: Click "Join Game" → Enter PIN + Name → Wait for host
3. **Host**: Click "Start Game" when ready
4. **Answer Questions**:
   - **Map Questions**: Click on the map to place your guess pin, then "Submit Guess"
   - **Multiple Choice**: Click an option to answer
5. **Scoring**:
   - Map: Points based on distance from correct location + time bonus
   - Multiple Choice: Points for correct answer + time bonus
6. **Results**: See correct answer, your score, and leaderboard after each question

## Project Structure

```
geoquiz/
├── server/
│   ├── index.js          # Express + Socket.io server
│   └── package.json
└── client/
    ├── public/
    │   └── index.html
    ├── src/
    │   ├── index.js      # React entry
    │   ├── App.js        # Main app component
    │   └── App.css       # Styles
    ├── package.json
    └── .env.example
```

## Customizing Questions

Edit `SAMPLE_QUIZ` in `client/src/App.js`:

```javascript
const SAMPLE_QUIZ = {
  title: 'Your Quiz Title',
  questions: [
    {
      type: 'map',
      prompt: 'Find this location',
      correctLocation: { lat: 48.8584, lng: 2.2945 },
      correctRadius: 5000,      // meters for "correct"
      maxDistance: 10000000,    // max distance for scoring
      timeLimit: 30             // seconds
    },
    {
      type: 'multiple-choice',
      prompt: 'Question text',
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 0,         // index of correct option
      timeLimit: 20
    }
  ]
};
```

## Map Question Scoring

- **Distance Score**: Up to 1000 pts based on proximity (closer = more points)
- **Time Bonus**: Up to 500 pts for answering quickly
- **Correct Radius**: Within this distance = "correct" badge

## License

MIT