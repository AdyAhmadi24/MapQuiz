# GeoQuiz Client

Frontend for GeoQuiz — a real-time multiplayer quiz game with map questions, built with React 18, Leaflet, and OpenStreetMap.

## Setup

```bash
npm install
npm start
```

Runs on `http://localhost:3000`.

The client proxies API/socket requests to `http://localhost:3001` (the server). Make sure the server is running.

## Map Setup

The client uses Leaflet with OpenStreetMap tiles. No API key or billing account is required. Map tiles include the required OpenStreetMap attribution.

## Customizing Questions

Edit `SAMPLE_QUIZ` in `src/App.js`:

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

## Exhibition Mode

Exhibition Mode supports multiple devices on a local network without internet:

```powershell
# Start server on all interfaces
cd server
npm start

# Start client on all interfaces
cd client
$env:HOST="0.0.0.0"
npm start
```

## License

MIT
