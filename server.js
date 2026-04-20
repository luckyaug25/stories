const express = require('express');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();
const axios = require("axios");

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

// ✅ INIT DB (JSON TAGS)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        cover_image TEXT,
        tags JSONB DEFAULT '[]',  -- ✅ JSON storage
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // ensure column exists
    await pool.query(`
      ALTER TABLE stories 
      ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]';
    `);

    console.log("✅ Database ready (JSON tags)");
  } catch (err) {
    console.error("❌ DB INIT ERROR:", err);
  }
})();

// ----------------------
// PAGES
// ----------------------
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/write', (req, res) => res.sendFile(path.join(__dirname, 'public/write.html')));
app.get('/read', (req, res) => res.sendFile(path.join(__dirname, 'public/read.html')));
app.get('/manage', (req, res) => res.sendFile(path.join(__dirname, 'public/manage.html')));
app.get('/edit-story', (req, res) => res.sendFile(path.join(__dirname, 'public/edit-story.html')));

// ----------------------
// HEALTH
// ----------------------
app.get('/health', (req, res) => {
  res.status(200).send("OK");
});

// ----------------------
// API ROUTES
// ----------------------

// GET ALL STORIES
app.get('/api/stories', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM stories ORDER BY created_at DESC'
    );

    // tags already JSON → just ensure array
    const stories = result.rows.map(story => ({
      ...story,
      tags: Array.isArray(story.tags) ? story.tags : []
    }));

    res.json(stories);

  } catch (err) {
    console.error("GET ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET ONE STORY
app.get('/api/stories/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT * FROM stories WHERE id = $1',
      [req.params.id]
    );

    const story = r.rows[0];

    if (!story) return res.status(404).json({ error: "Not found" });

    story.tags = Array.isArray(story.tags) ? story.tags : [];

    res.json(story);

  } catch (err) {
    console.error("GET ONE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// CREATE STORY
app.post('/api/stories', async (req, res) => {
  const { title, content, cover_image, tags } = req.body;

  console.log("Incoming:", req.body); // debug

  if (!title || !content) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    // ✅ MUST BE VALID JSON
    const tagsJSON = JSON.stringify(
      Array.isArray(tags) ? tags : []
    );

    const result = await pool.query(
      `INSERT INTO stories (title, content, cover_image, tags)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id`,
      [title, content, cover_image, tagsJSON]
    );

    res.json({ id: result.rows[0].id });

  } catch (err) {
    console.error("POST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE STORY
app.put('/api/stories/:id', async (req, res) => {
  const { title, content, cover_image, tags } = req.body;

  try {
    const tagsJSON = JSON.stringify(
      Array.isArray(tags) ? tags : []
    );

    const result = await pool.query(
      `UPDATE stories 
       SET title=$1, content=$2, cover_image=$3, tags=$4::jsonb
       WHERE id=$5`,
      [title, content, cover_image, tagsJSON, req.params.id]
    );

    res.json({ updated: result.rowCount });

  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE STORY
app.delete('/api/stories/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM stories WHERE id=$1',
      [req.params.id]
    );

    res.json({ deleted: r.rowCount });

  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ----------------------
// START SERVER
// ----------------------
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);

  const SERVER_URL =
    process.env.APP_URL || `http://localhost:${port}`;

  // keep alive
  setInterval(async () => {
    try {
      await axios.get(`${SERVER_URL}/health`);
      console.log("✅ Keep-alive ping");
    } catch (err) {
      console.log("⚠️ Ping failed");
    }
  }, 5 * 60 * 1000);
});