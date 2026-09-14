const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('DATABASE_URL is not set. PostgreSQL persistence is unavailable.');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function initializeDatabase() {
  if (!connectionString) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS game_results (
      id BIGSERIAL PRIMARY KEY,
      game_pin VARCHAR(6) NOT NULL,
      game_type TEXT NOT NULL,
      game_title TEXT NOT NULL,
      player_name TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      played_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS index_game_results_score
    ON game_results(score DESC, played_at ASC)
  `);
}

async function saveGameResults({ gamePin, gameType, gameTitle, players }) {
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const player of players) {
      await client.query(`
        INSERT INTO game_results (game_pin, game_type, game_title, player_name, score)
        VALUES ($1, $2, $3, $4, $5)
      `, [gamePin, gameType, gameTitle, player.name, player.score]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getScoreboard(limit = 20) {
  if (!connectionString) throw new Error('DATABASE_URL is not configured');

  const { rows } = await pool.query(`
    SELECT
      player_name AS name,
      MAX(score)::INTEGER AS score,
      COUNT(*)::INTEGER AS games_played,
      MAX(played_at) AS latest_game
    FROM game_results
    GROUP BY player_name
    ORDER BY score DESC, latest_game ASC
    LIMIT $1
  `, [limit]);

  return rows;
}

module.exports = { getScoreboard, initializeDatabase, saveGameResults };
