import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const SOCKET_URL = 'http://localhost:3001';

const DISTRICT_GROUPS = [
  {
    city: 'Jakarta Pusat',
    districts: ['Cempaka Putih', 'Gambir', 'Johar Baru', 'Kemayoran', 'Menteng', 'Sawah Besar', 'Senen', 'Tanah Abang']
  },
  {
    city: 'Jakarta Utara',
    districts: ['Cilincing', 'Kelapa Gading', 'Koja', 'Pademangan', 'Penjaringan', 'Tanjung Priok']
  },
  {
    city: 'Jakarta Barat',
    districts: ['Cengkareng', 'Grogol Petamburan', 'Kalideres', 'Kebon Jeruk', 'Kembangan', 'Palmerah', 'Taman Sari', 'Tambora']
  },
  {
    city: 'Jakarta Selatan',
    districts: ['Cilandak', 'Jagakarsa', 'Kebayoran Baru', 'Kebayoran Lama', 'Mampang Prapatan', 'Pancoran', 'Pasar Minggu', 'Pesanggrahan', 'Setiabudi', 'Tebet']
  },
  {
    city: 'Jakarta Timur',
    districts: ['Cakung', 'Cipayung', 'Ciracas', 'Duren Sawit', 'Jatinegara', 'Kramat Jati', 'Makasar', 'Matraman', 'Pasar Rebo', 'Pulo Gadung']
  },
];

const ADMINISTRATIVE_CITIES = DISTRICT_GROUPS.map((group) => group.city);

const DISTRICT_LOCATIONS = [
  ['Cempaka Putih', -6.1818, 106.8718], ['Gambir', -6.1767, 106.8272], ['Johar Baru', -6.1867, 106.8564],
  ['Kemayoran', -6.1588, 106.8538], ['Menteng', -6.1951, 106.8327], ['Sawah Besar', -6.1568, 106.8292],
  ['Senen', -6.1847, 106.8431], ['Tanah Abang', -6.2052, 106.8135],
  ['Cilincing', -6.1185, 106.9386], ['Kelapa Gading', -6.1584, 106.9065], ['Koja', -6.1161, 106.9075],
  ['Pademangan', -6.1364, 106.8334], ['Penjaringan', -6.1275, 106.7882], ['Tanjung Priok', -6.1267, 106.8806],
  ['Cengkareng', -6.1478, 106.7338], ['Grogol Petamburan', -6.1668, 106.7902], ['Kalideres', -6.1374, 106.7013],
  ['Kebon Jeruk', -6.1932, 106.7661], ['Kembangan', -6.1786, 106.7386], ['Palmerah', -6.1904, 106.7974],
  ['Taman Sari', -6.1478, 106.8165], ['Tambora', -6.1516, 106.8014],
  ['Cilandak', -6.2916, 106.7942], ['Jagakarsa', -6.3341, 106.8249], ['Kebayoran Baru', -6.2442, 106.7998],
  ['Kebayoran Lama', -6.2441, 106.7782], ['Mampang Prapatan', -6.2583, 106.8159], ['Pancoran', -6.2573, 106.8414],
  ['Pasar Minggu', -6.2854, 106.8441], ['Pesanggrahan', -6.2635, 106.7519], ['Setiabudi', -6.2115, 106.8280],
  ['Tebet', -6.2308, 106.8520],
  ['Cakung', -6.1734, 106.9444], ['Cipayung', -6.3254, 106.8917], ['Ciracas', -6.3267, 106.8822],
  ['Duren Sawit', -6.2344, 106.9222], ['Jatinegara', -6.2167, 106.8667], ['Kramat Jati', -6.2755, 106.8664],
  ['Makasar', -6.2872, 106.8844], ['Matraman', -6.2048, 106.8618], ['Pasar Rebo', -6.3226, 106.8657],
  ['Pulo Gadung', -6.1907, 106.8951]
].map(([district, lat, lng]) => ({ district, lat, lng }));

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}

function createJakartaQuiz() {
  const questions = DISTRICT_GROUPS.flatMap(({ city, districts }) =>
    districts.map((district) => {
      const options = shuffle([
        city,
        ...shuffle(ADMINISTRATIVE_CITIES.filter((option) => option !== city)).slice(0, 3)
      ]);

      return {
        type: 'multiple-choice',
        prompt: district,
        options,
        correctAnswer: options.indexOf(city),
        district,
        city,
        timeLimit: 5
      };
    })
  );

  return {
    title: 'GeoQuiz Kecamatan DKI Jakarta',
    gameType: 'district-city',
    questions: shuffle(questions).slice(0, 15)
  };
}

function createDistrictMapQuiz() {
  return {
    title: 'GeoQuiz Pin Lokasi Kecamatan DKI Jakarta',
    gameType: 'district-map',
    questions: shuffle(DISTRICT_LOCATIONS).slice(0, 15).map(({ district, lat, lng }) => ({
      type: 'map',
      prompt: district,
      correctLocation: { lat, lng },
      correctRadius: 3000,
      maxDistance: 50000,
      timeLimit: 15
    }))
  };
}

const SAMPLE_QUIZ = createJakartaQuiz();
const DISTRICT_MAP_QUIZ = createDistrictMapQuiz();

const GAME_OPTIONS = [
  {
    id: 'district-city',
    title: 'Tebak Kota Administrasi',
    description: 'Tebak kota administrasi berdasarkan nama kecamatan di DKI Jakarta.',
    questionCount: SAMPLE_QUIZ.questions.length,
    available: true
  },
  {
    id: 'district-map',
    title: 'Pin Lokasi Kecamatan',
    description: 'Tempatkan pin pada lokasi kecamatan DKI Jakarta di peta.',
    questionCount: DISTRICT_MAP_QUIZ.questions.length,
    available: true
  },
  {
    id: 'coming-soon',
    title: 'Game Berikutnya',
    description: 'Mode permainan ketiga sedang dalam perencanaan.',
    available: false
  }
];

function QuizMap({ guessedLocation, correctLocation, showResults, onMapClick }) {
  const map = useMap();

  useMapEvents({
    click: (event) => onMapClick(event.latlng)
  });

  useEffect(() => {
    if (showResults && guessedLocation && correctLocation) {
      map.fitBounds([
        [guessedLocation.lat, guessedLocation.lng],
        [correctLocation.lat, correctLocation.lng]
      ], { padding: [50, 50] });
    }
  }, [map, showResults, guessedLocation, correctLocation]);

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {guessedLocation && (
        <CircleMarker
          center={[guessedLocation.lat, guessedLocation.lng]}
          radius={12}
          pathOptions={{ color: '#fff', weight: 3, fillColor: '#00d4aa', fillOpacity: 1 }}
        />
      )}
      {showResults && guessedLocation && correctLocation && (
        <>
          <CircleMarker
            center={[correctLocation.lat, correctLocation.lng]}
            radius={14}
            pathOptions={{ color: '#fff', weight: 3, fillColor: '#ff6b6b', fillOpacity: 1 }}
          />
          <Polyline
            positions={[
              [guessedLocation.lat, guessedLocation.lng],
              [correctLocation.lat, correctLocation.lng]
            ]}
            pathOptions={{ color: '#ff6b6b', opacity: 0.8, weight: 3 }}
          />
        </>
      )}
    </>
  );
}

function App() {
  const [screen, setScreen] = useState('home');
  const [socket, setSocket] = useState(null);
  const [gamePin, setGamePin] = useState('');
  const [playerName, setPlayerName] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [quizData, setQuizData] = useState(SAMPLE_QUIZ);
  const [selectedGameId, setSelectedGameId] = useState('district-city');
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [gameState, setGameState] = useState('lobby');
  const [myScore, setMyScore] = useState(0);
  const [leaderboard, setLeaderboard] = useState([]);
  const [questionResults, setQuestionResults] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [mapClicked, setMapClicked] = useState(false);
  const [guessedLocation, setGuessedLocation] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [waitingForPlayers, setWaitingForPlayers] = useState(false);
  const [hasSubmittedAnswer, setHasSubmittedAnswer] = useState(false);
  const [answerProgress, setAnswerProgress] = useState({ answeredPlayers: 0, totalPlayers: 0 });
  const timerRef = useRef(null);
  const playerIdRef = useRef(null);
  const answerSubmittedRef = useRef(false);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    if (
      timeRemaining !== 0 ||
      gameState !== 'playing' ||
      !currentQuestion ||
      (currentQuestion.type !== 'multiple-choice' &&
        currentQuestion.type !== 'map') ||
      showResults ||
      answerSubmittedRef.current ||
      !socket ||
      !playerId
    ) {
      return;
    }

    answerSubmittedRef.current = true;
    setHasSubmittedAnswer(true);
    setWaitingForPlayers(answerProgress.totalPlayers > 1);
    setAnswerProgress({ answeredPlayers: 1, totalPlayers: answerProgress.totalPlayers });
    socket.emit('submit-answer', {
      pin: gamePin,
      playerId,
      answer: null,
      timeRemaining: 0
    });
  }, [timeRemaining, gameState, currentQuestion, showResults, socket, playerId, gamePin]);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);

    newSocket.on('connect', () => console.log('Connected to server'));
    newSocket.on('connect_error', () => {
      console.error('Unable to connect to the GeoQuiz server');
    });
    newSocket.on('disconnect', () => console.log('Disconnected'));

    newSocket.on('player-joined', ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('player-left', ({ players: updatedPlayers }) => {
      setPlayers(updatedPlayers);
    });

    newSocket.on('game-started', ({ question, questionIndex: idx, totalQuestions: total, totalPlayers }) => {
      setScreen('game');
      setGameState('playing');
      setCurrentQuestion(question);
      setQuestionIndex(idx);
      setTotalQuestions(total);
      setShowResults(false);
      setHasSubmittedAnswer(false);
      setWaitingForPlayers(false);
      setAnswerProgress({ answeredPlayers: 0, totalPlayers });
      setMapClicked(false);
      setGuessedLocation(null);
      answerSubmittedRef.current = false;
      startTimer(question.timeLimit);
    });

    newSocket.on('new-question', ({ question, questionIndex: idx, totalQuestions: total, totalPlayers }) => {
      setScreen('game');
      setCurrentQuestion(question);
      setQuestionIndex(idx);
      setTotalQuestions(total);
      setShowResults(false);
      setHasSubmittedAnswer(false);
      setWaitingForPlayers(false);
      setAnswerProgress({ answeredPlayers: 0, totalPlayers });
      setMapClicked(false);
      setGuessedLocation(null);
      answerSubmittedRef.current = false;
      startTimer(question.timeLimit);
    });

    newSocket.on('question-results', ({ results, correctAnswer, questionType, answeredPlayers, totalPlayers }) => {
      setQuestionResults({ results, correctAnswer, questionType });
      setAnswerProgress({ answeredPlayers, totalPlayers });
      setShowResults(true);
      setHasSubmittedAnswer(false);
      setWaitingForPlayers(false);
      if (timerRef.current) clearInterval(timerRef.current);

      setPlayers((currentPlayers) => currentPlayers.map((player) => {
        const result = results.find((item) => item.playerId === player.id);
        return result ? { ...player, score: player.score + result.score } : player;
      }));
      
      const myResult = results.find(r => r.playerId === playerIdRef.current);
      if (myResult) {
        setMyScore(prev => prev + myResult.score);
      }
    });

    newSocket.on('answer-progress', ({ answeredPlayers, totalPlayers }) => {
      setAnswerProgress({ answeredPlayers, totalPlayers });
      setWaitingForPlayers(answeredPlayers < totalPlayers && totalPlayers > 1);
    });

    newSocket.on('game-ended', ({ leaderboard: finalLeaderboard }) => {
      setLeaderboard(finalLeaderboard);
      setGameState('ended');
      setShowResults(true);
      if (timerRef.current) clearInterval(timerRef.current);
    });

    return () => {
      newSocket.close();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startTimer = (limit) => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeRemaining(limit);
    timerRef.current = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCreateGame = () => {
    if (!socket || !socket.connected) {
      alert('Server belum terhubung. Jalankan server dengan: cd server lalu npm start');
      return;
    }
    setIsHost(true);
    socket.emit('create-game', quizData, (response) => {
      if (response.success) {
        setGamePin(response.game.pin);
        setScreen('lobby');
      } else {
        alert(response.error || 'Game gagal dibuat');
      }
    });
  };

  const handleGameSelect = (gameId) => {
    if (gameId === 'district-city') {
      setQuizData(SAMPLE_QUIZ);
      setSelectedGameId(gameId);
    }
    if (gameId === 'district-map') {
      setQuizData(DISTRICT_MAP_QUIZ);
      setSelectedGameId(gameId);
    }
  };

  const handleJoinGame = () => {
    if (!socket || !gamePin.trim() || !playerName.trim()) return;
    socket.emit('join-game', { pin: gamePin, name: playerName }, (response) => {
      if (response.success) {
        setPlayerId(response.playerId);
        setPlayers(response.game.players);
        setScreen('lobby');
      } else {
        alert(response.error);
      }
    });
  };

  const handleStartGame = () => {
    if (!socket || !isHost) return;
    socket.emit('start-game', gamePin, (response) => {
      if (!response.success) alert(response.error);
    });
  };

  const handleMapClick = (latlng) => {
    if (gameState !== 'playing' || currentQuestion?.type !== 'map' || showResults) return;
    
    const { lat, lng } = latlng;
    setGuessedLocation({ lat, lng });
    setMapClicked(true);
  };

  const handleSubmitAnswer = () => {
    if (!socket || !playerId || !currentQuestion || answerSubmittedRef.current || showResults) return;

    if (currentQuestion.type === 'map') {
      if (!guessedLocation) return;
      answerSubmittedRef.current = true;
      setHasSubmittedAnswer(true);
      setWaitingForPlayers(answerProgress.totalPlayers > 1);
      setAnswerProgress({ answeredPlayers: 1, totalPlayers: answerProgress.totalPlayers });
      socket.emit('submit-answer', {
        pin: gamePin,
        playerId,
        answer: guessedLocation,
        timeRemaining
      });
    } else if (currentQuestion.type === 'multiple-choice') {
      // Handled by option click
    }
  };

  const handleOptionSelect = (optionIndex) => {
    if (!socket || !playerId || !currentQuestion || showResults || answerSubmittedRef.current) return;
    answerSubmittedRef.current = true;
    setHasSubmittedAnswer(true);
    setWaitingForPlayers(answerProgress.totalPlayers > 1);
    setAnswerProgress({ answeredPlayers: 1, totalPlayers: answerProgress.totalPlayers });
    socket.emit('submit-answer', {
      pin: gamePin,
      playerId,
      answer: optionIndex,
      timeRemaining
    });
  };

  const handleNextQuestion = () => {
    if (!socket || !isHost) return;
    socket.emit('next-question', gamePin);
  };

  // Render different screens
  if (screen === 'home') {
    return (
      <div className="screen home">
        <div className="container">
          <h1 className="title">GeoQuiz</h1>
          <p className="subtitle">Kahoot-style quiz with Saterra map questions</p>
          
          <div className="button-group">
            <button className="btn btn-primary btn-large" onClick={() => setScreen('host-setup')}>
              Host a Game
            </button>
            <button className="btn btn-secondary btn-large" onClick={() => setScreen('join')}>
              Join Game
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'host-setup') {
    return (
      <div className="screen host-setup">
        <div className="container">
          <h2>Choose a Game</h2>
          <div className="game-options" role="list" aria-label="Game options">
            {GAME_OPTIONS.map((game) => (
              <button
                key={game.id}
                type="button"
                className={`game-option ${selectedGameId === game.id ? 'selected' : ''}`}
                onClick={() => game.available && handleGameSelect(game.id)}
                disabled={!game.available}
                aria-pressed={selectedGameId === game.id}
              >
                <span className="game-option-header">
                  <strong>{game.title}</strong>
                  <span className={`game-status ${game.available ? 'available' : 'coming-soon'}`}>
                    {game.available ? 'Ready' : 'Coming soon'}
                  </span>
                </span>
                <span className="game-option-description">{game.description}</span>
                {game.questionCount && (
                  <span className="game-option-meta">{game.questionCount} questions</span>
                )}
              </button>
            ))}
          </div>
          <div className="quiz-preview">
            <h3>{quizData.title}</h3>
            <p>{quizData.questions.length} questions</p>
          </div>
          <button className="btn btn-primary btn-large" onClick={handleCreateGame}>
            Create Game
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('home')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'join') {
    return (
      <div className="screen join">
        <div className="container">
          <h2>Join Game</h2>
          <div className="form-group">
            <label>Game PIN</label>
            <input
              type="text"
              maxLength={6}
              value={gamePin}
              onChange={(e) => setGamePin(e.target.value.toUpperCase())}
              placeholder="XXXXXX"
              className="pin-input"
            />
          </div>
          <div className="form-group">
            <label>Your Name</label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter your name"
            />
          </div>
          <button className="btn btn-primary btn-large" onClick={handleJoinGame} disabled={!gamePin || !playerName}>
            Join
          </button>
          <button className="btn btn-secondary" onClick={() => setScreen('home')}>
            Back
          </button>
        </div>
      </div>
    );
  }

  if (screen === 'lobby') {
    return (
      <div className="screen lobby">
        <div className="container">
          <div className="lobby-header">
            <h2>{isHost ? 'Host Lobby' : 'Waiting for Host'}</h2>
            <div className="pin-display">PIN: <span>{gamePin}</span></div>
          </div>
          
          <div className="players-list">
            <h3>Players ({players.length})</h3>
            <ul>
              {players.map(p => (
                <li key={p.id} className={p.id === playerId ? 'me' : ''}>
                  <span>{p.name} {p.id === playerId && '(You)'}</span>
                  <span className="score">{p.score} pts</span>
                </li>
              ))}
            </ul>
          </div>

          {isHost && (
            <button
              className="btn btn-primary btn-large start-btn"
              onClick={handleStartGame}
              disabled={players.length === 0}
            >
              Start Game
            </button>
          )}
        </div>
      </div>
    );
  }

  if (gameState === 'playing' && currentQuestion) {
    return (
      <div className="screen game">
        <div className="game-header">
          <div className="question-info">
            <span className="question-counter">Question {questionIndex + 1} / {totalQuestions}</span>
            <div className="timer" style={{ color: timeRemaining <= 5 ? '#ff4444' : '#00d4aa' }}>
              {timeRemaining}s
            </div>
          </div>
          <div className="my-score">Score: {myScore}</div>
        </div>

        {isHost ? (
          <div className="host-leaderboard">
            <h2>Live Leaderboard</h2>
            <ol className="final-leaderboard">
              {[...players]
                .sort((first, second) => second.score - first.score)
                .map((player, index) => (
                  <li key={player.id} className={index < 3 ? `top-${index + 1}` : ''}>
                    <span className="rank">#{index + 1}</span>
                    <span className="name">{player.name}</span>
                    <span className="score">{player.score} pts</span>
                  </li>
                ))}
            </ol>
          </div>
        ) : (
          <div className="question-container">
            <h3 className="question-prompt">{currentQuestion.prompt}</h3>

            {currentQuestion.type === 'map' && (
            <div className="map-container">
              <MapContainer
                className="map-wrapper"
                center={currentQuestion.type === 'map' ? [-6.2, 106.85] : [0, 0]}
                zoom={currentQuestion.type === 'map' ? 11 : 2}
                scrollWheelZoom
              >
                <QuizMap
                  guessedLocation={guessedLocation}
                  correctLocation={questionResults?.correctAnswer}
                  showResults={showResults && Boolean(questionResults)}
                  onMapClick={handleMapClick}
                />
              </MapContainer>
              <div className="map-controls">
                {!mapClicked && <p className="map-hint">Click on the map to place your guess</p>}
                {mapClicked && !showResults && (
                  <button className="btn btn-primary submit-btn" onClick={handleSubmitAnswer}>
                    Submit Guess
                  </button>
                )}
              </div>
            </div>
            )}

            {currentQuestion.type === 'multiple-choice' && (
              <div className="options-grid">
                {currentQuestion.options.map((option, i) => (
                  <button
                    key={i}
                    className="option-btn"
                    onClick={() => handleOptionSelect(i)}
                    disabled={showResults}
                  >
                    {option}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isHost && waitingForPlayers && hasSubmittedAnswer && (
          <div className="results-overlay">
            <div className="results-panel waiting-panel">
              <div className="waiting-spinner" aria-hidden="true" />
              <h3>Waiting for other players</h3>
              <p>{answerProgress.answeredPlayers} of {answerProgress.totalPlayers} players have answered.</p>
            </div>
          </div>
        )}

        {!isHost && showResults && questionResults && (
          <div className="results-overlay">
            <div className="results-panel">
              <h3>Results</h3>
              <p className="answer-progress">{answerProgress.answeredPlayers} of {answerProgress.totalPlayers} players answered</p>
              {questionResults.questionType === 'map' && (
                <div className="map-result">
                  <p>
                    Distance: {questionResults.results.find(r => r.playerId === playerId)?.distance != null
                      ? `${(questionResults.results.find(r => r.playerId === playerId).distance / 1000).toFixed(2)} km`
                      : 'No distance'}
                  </p>
                </div>
              )}
              {questionResults.questionType === 'multiple-choice' && (
                <div className="mc-result">
                  <p>Correct answer: {currentQuestion.options[questionResults.correctAnswer]}</p>
                </div>
              )}
              <div className="score-update">
                +{questionResults.results.find(r => r.playerId === playerId)?.score || 0} points earned
              </div>
            </div>
          </div>
        )}

        {isHost && showResults && (
          <button className="btn btn-primary next-btn" onClick={handleNextQuestion}>
            Next Question
          </button>
        )}
      </div>
    );
  }

  if (gameState === 'ended') {
    return (
      <div className="screen ended">
        <div className="container">
          <h2>Game Over!</h2>
          <h3>Final Leaderboard</h3>
          <ol className="final-leaderboard">
            {leaderboard.map((player, i) => (
              <li key={player.id} className={i < 3 ? `top-${i + 1}` : ''}>
                <span className="rank">#{i + 1}</span>
                <span className="name">{player.name} {player.id === playerId && '(You)'}</span>
                <span className="score">{player.score} pts</span>
              </li>
            ))}
          </ol>
          <button className="btn btn-primary btn-large" onClick={() => {
            setScreen('home');
            setGamePin('');
            setPlayerName('');
            setPlayerId(null);
            setIsHost(false);
            setGameState('lobby');
            setPlayers([]);
            setCurrentQuestion(null);
            setMyScore(0);
            setLeaderboard([]);
            setQuestionResults(null);
          }}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  return null;
}

export default App;