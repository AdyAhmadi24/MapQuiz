const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

// In-memory storage for active games
const games = new Map();
const players = new Map();

function generatePin() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function createGame(hostId, quizData) {
  const pin = generatePin();
  const game = {
    id: uuidv4(),
    pin,
    hostId,
    quizData,
    state: 'lobby',
    currentQuestionIndex: 0,
    players: new Map(),
    scores: new Map(),
    answers: new Map(),
    nextQuestionLocked: false,
    createdAt: Date.now()
  };
  games.set(pin, game);
  return game;
}

function getGameByPin(pin) {
  return games.get(pin);
}

function addPlayerToGame(pin, playerId, playerName, socketId) {
  const game = games.get(pin);
  if (!game) return null;
  
  const player = {
    id: playerId,
    name: playerName,
    socketId,
    score: 0,
    joinedAt: Date.now()
  };
  
  game.players.set(playerId, player);
  game.scores.set(playerId, 0);
  players.set(socketId, { gamePin: pin, playerId });
  
  return { game, player };
}

function removePlayer(socketId) {
  const playerInfo = players.get(socketId);
  if (!playerInfo) return;
  
  const game = games.get(playerInfo.gamePin);
  if (game) {
    game.players.delete(playerInfo.playerId);
    game.scores.delete(playerInfo.playerId);
    game.answers.delete(playerInfo.playerId);
    
    // Notify others
    io.to(playerInfo.gamePin).emit('player-left', {
      playerId: playerInfo.playerId,
      players: Array.from(game.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: game.scores.get(p.id) || 0
      }))
    });
    
    // Clean up empty games
    if (game.players.size === 0 && game.state !== 'playing' && game.hostId === socketId) {
      games.delete(playerInfo.gamePin);
    }
  }
  players.delete(socketId);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Host creates a new game
  socket.on('create-game', (quizData, callback) => {
    const game = createGame(socket.id, quizData);
    socket.join(game.pin);
    players.set(socket.id, { gamePin: game.pin, playerId: game.hostId, isHost: true });
    
    callback({ success: true, game: { pin: game.pin, id: game.id } });
    console.log(`Game created: ${game.pin} by ${socket.id}`);
  });

  // Player joins a game
  socket.on('join-game', ({ pin, name }, callback) => {
    const game = getGameByPin(pin);
    if (!game) {
      return callback({ success: false, error: 'Game not found' });
    }
    if (game.state !== 'lobby') {
      return callback({ success: false, error: 'Game already started' });
    }

    const playerId = uuidv4();
    const result = addPlayerToGame(pin, playerId, name, socket.id);
    if (!result) {
      return callback({ success: false, error: 'Failed to join' });
    }

    socket.join(pin);
    
    callback({ 
      success: true, 
      playerId, 
      game: {
        pin: game.pin,
        quizTitle: game.quizData.title,
        players: Array.from(game.players.values()).map(p => ({
          id: p.id,
          name: p.name,
          score: game.scores.get(p.id) || 0
        }))
      }
    });

    // Notify all players in the game
    io.to(pin).emit('player-joined', {
      players: Array.from(game.players.values()).map(p => ({
        id: p.id,
        name: p.name,
        score: game.scores.get(p.id) || 0
      }))
    });
  });

  // Host starts the game
  socket.on('start-game', (pin, callback) => {
    const game = getGameByPin(pin);
    if (!game || game.hostId !== socket.id) {
      if (callback) callback({ success: false, error: 'Not authorized' });
      return;
    }
    
    game.state = 'playing';
    game.currentQuestionIndex = 0;
    
    const question = game.quizData.questions[0];
    io.to(pin).emit('game-started', {
      question,
      questionIndex: 0,
      totalQuestions: game.quizData.questions.length,
      totalPlayers: game.players.size
    });
    if (callback) callback({ success: true });
  });

  // Player submits answer
  socket.on('submit-answer', ({ pin, playerId, answer, timeRemaining }, callback) => {
    const game = getGameByPin(pin);
    if (!game || game.state !== 'playing') {
      if (callback) callback({ success: false, error: 'Game not active' });
      return;
    }

    const question = game.quizData.questions[game.currentQuestionIndex];
    if (game.answers.has(playerId)) {
      if (callback) callback({ success: false, error: 'Answer already submitted' });
      return;
    }

    let score = 0;
    let isCorrect = false;
    let distance = null;

    // Every submitted answer is worth one point only when it is correct.
    if (answer == null) {
      isCorrect = false;
    } else if (question.type === 'map') {
      // Map question: score based on distance from correct location
      const correctLat = question.correctLocation.lat;
      const correctLng = question.correctLocation.lng;
      const guessedLat = answer.lat;
      const guessedLng = answer.lng;
      
      distance = calculateDistance(correctLat, correctLng, guessedLat, guessedLng);
      // Map score depends only on the distance from the actual location.
      score = distance <= 1000
        ? 100
        : Math.max(0, 100 - Math.ceil((distance - 1000) / 100));
      isCorrect = distance <= (question.correctRadius || 50000); // 1km for district map questions
    } else if (question.type === 'multiple-choice') {
      isCorrect = answer === question.correctAnswer;
    }

    if (game.quizData.gameType === 'district-city' || question.type === 'multiple-choice') {
      score = isCorrect ? 1 : 0;
    }

    game.answers.set(playerId, { answer, score, isCorrect, distance, submittedAt: Date.now() });
    game.scores.set(playerId, (game.scores.get(playerId) || 0) + score);

    io.to(pin).emit('answer-progress', {
      answeredPlayers: game.answers.size,
      totalPlayers: game.players.size
    });

    if (callback) {
      callback({ success: true, score, isCorrect, correctAnswer: question.correctAnswer ?? question.correctLocation });
    }

    // Check if all players answered
    if (game.answers.size >= game.players.size) {
      // Allow clients to render the final live progress before showing results.
      setTimeout(() => endQuestion(pin), 200);
    }
  });

  // Host moves to next question
  socket.on('next-question', (pin, callback) => {
    const game = getGameByPin(pin);
    if (!game || game.hostId !== socket.id || game.state !== 'playing') {
      if (callback) callback({ success: false, error: 'Not authorized' });
      return;
    }
    if (game.nextQuestionLocked) {
      if (callback) callback({ success: false, error: 'Question already advanced' });
      return;
    }

    game.nextQuestionLocked = true;

    game.currentQuestionIndex++;
    game.answers.clear();

    if (game.currentQuestionIndex >= game.quizData.questions.length) {
      game.state = 'ended';
      const leaderboard = Array.from(game.players.values())
        .map(p => ({ id: p.id, name: p.name, score: game.scores.get(p.id) || 0 }))
        .sort((a, b) => b.score - a.score);
      io.to(pin).emit('game-ended', { leaderboard });
    } else {
      const question = game.quizData.questions[game.currentQuestionIndex];
      io.to(pin).emit('new-question', { 
        question, 
        questionIndex: game.currentQuestionIndex, 
        totalQuestions: game.quizData.questions.length,
        totalPlayers: game.players.size
      });
    }
    if (callback) callback({ success: true });
  });

  socket.on('disconnect', () => {
    removePlayer(socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

function calculateDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

function endQuestion(pin) {
  const game = games.get(pin);
  if (!game) return;

  const question = game.quizData.questions[game.currentQuestionIndex];
  const results = Array.from(game.answers.entries()).map(([playerId, data]) => ({
    playerId,
    playerName: game.players.get(playerId)?.name,
    ...data
  }));

  io.to(pin).emit('question-results', { 
    results, 
    correctAnswer: question.correctAnswer ?? question.correctLocation,
    questionType: question.type,
    answeredPlayers: game.answers.size,
    totalPlayers: game.players.size
  });
  games.get(pin).nextQuestionLocked = false;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});