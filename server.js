const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();
const axios = require("axios"); // ✅ ADD THIS

const app = express();
const port = process.env.PORT || 3000;

// ----------------------
// BODY PARSER
// ----------------------
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Static files
app.use(express.static('public'));

// ----------------------
// DATABASE
// ----------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// Create table
pool.query(`
  CREATE TABLE IF NOT EXISTS stories (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    cover_image TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// ----------------------
// PAGES
// ----------------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/write', (req, res) => res.sendFile(path.join(__dirname, 'public/write.html')));
app.get('/read', (req, res) => res.sendFile(path.join(__dirname, 'public/read.html')));
app.get('/manage', (req, res) => res.sendFile(path.join(__dirname, 'public/manage.html')));
app.get('/edit-story', (req, res) => res.sendFile(path.join(__dirname, 'public/edit-story.html')));

// ✅ HEALTH ROUTE (VERY IMPORTANT)
app.get('/health', (req, res) => {
  res.status(200).send("OK");
});

// ----------------------
// API ROUTES
// ----------------------
app.get('/api/stories', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM stories ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/stories/:id', async (req, res) => {
  try {
    const r = await pool.query('SELECT * FROM stories WHERE id = $1', [req.params.id]);
    res.json(r.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.post('/api/stories', async (req, res) => {
  const { title, content, cover_image } = req.body;

  if (!title || !content)
    return res.status(400).json({ error: 'Missing fields' });

  try {
    const result = await pool.query(
      'INSERT INTO stories (title, content, cover_image) VALUES ($1,$2,$3) RETURNING id',
      [title, content, cover_image]
    );
    res.json({ id: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/stories/:id', async (req, res) => {
  const { title, content, cover_image } = req.body;

  try {
    const result = await pool.query(
      'UPDATE stories SET title=$1, content=$2, cover_image=$3 WHERE id=$4',
      [title, content, cover_image, req.params.id]
    );
    res.json({ updated: result.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.delete('/api/stories/:id', async (req, res) => {
  try {
    const r = await pool.query('DELETE FROM stories WHERE id=$1', [req.params.id]);
    res.json({ deleted: r.rowCount });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error' });
  }
});

// ----------------------
// START SERVER
// ----------------------
app.listen(port, () => {
  console.log(`Server running on port ${port}`);

  // ✅ KEEP ALIVE SELF PING
  const SERVER_URL =
    process.env.APP_URL || `http://localhost:${port}`;

  setInterval(async () => {
    try {
      await axios.get(`${SERVER_URL}/health`);
      console.log("✅ Keep-alive ping sent");
    } catch (err) {
      console.log("⚠️ Ping failed");
    }
  }, 10 * 60 * 1000); // every 5 minutes
});