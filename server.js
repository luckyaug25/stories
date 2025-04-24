const express = require('express');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL
require('dotenv').config();

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// PostgreSQL setup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // put this in your .env file
  ssl: {
    rejectUnauthorized: false, // needed for many free cloud DBs
  },
});

// Create table if it doesn't exist
pool.query(`
  CREATE TABLE IF NOT EXISTS stories (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/write', (req, res) => res.sendFile(path.join(__dirname, 'public/write.html')));
app.get('/read', (req, res) => res.sendFile(path.join(__dirname, 'public/read.html')));
app.get('/manage', (req, res) => res.sendFile(path.join(__dirname, 'public/manage.html')));

// API
app.get('/api/stories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stories ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stories WHERE id = $1', [req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/stories', async (req, res) => {
  const { title, content } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Missing title or content' });
  }

  try {
    const result = await pool.query(
      'INSERT INTO stories (title, content) VALUES ($1, $2) RETURNING id',
      [title, content]
    );
    res.status(200).json({ id: result.rows[0].id });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/stories/:id', async (req, res) => {
  const { title, content } = req.body;
  try {
    const result = await pool.query(
      'UPDATE stories SET title = $1, content = $2 WHERE id = $3',
      [title, content, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/stories/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM stories WHERE id = $1', [req.params.id]);
    res.json({ deleted: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
