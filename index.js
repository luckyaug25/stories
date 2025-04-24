const express = require('express');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// SQLite setup
const db = new sqlite3.Database('stories.db');
db.run(`
  CREATE TABLE IF NOT EXISTS stories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
app.get('/api/stories', (req, res) => {
  db.all('SELECT * FROM stories ORDER BY created_at DESC', [], (err, rows) => {
    res.json(rows);
  });
});

app.get('/api/stories/:id', (req, res) => {
  db.get('SELECT * FROM stories WHERE id = ?', [req.params.id], (err, row) => {
    res.json(row);
  });
});

app.post('/api/stories', (req, res) => {
    const { title, content } = req.body;
  
    if (!title || !content) {
      return res.status(400).json({ error: 'Missing title or content' });
    }
  
    const stmt = db.prepare('INSERT INTO stories (title, content) VALUES (?, ?)');
    stmt.run(title, content, function (err) {
      if (err) return res.status(500).json({ error: 'Database error' });
  
      res.status(200).json({ id: this.lastID }); // no need to display this on frontend
    });
  });
  
app.put('/api/stories/:id', (req, res) => {
  const { title, content } = req.body;
  db.run('UPDATE stories SET title = ?, content = ? WHERE id = ?', [title, content, req.params.id], function () {
    res.json({ updated: this.changes });
  });
});

app.delete('/api/stories/:id', (req, res) => {
  db.run('DELETE FROM stories WHERE id = ?', [req.params.id], function () {
    res.json({ deleted: this.changes });
  });
});


app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
