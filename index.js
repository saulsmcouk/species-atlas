const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// NBN Atlas API endpoint
const NBN_API_URL = 'https://records-ws.nbnatlas.org/occurrences/search?q=qid%3A1770719700170&fq=-occurrence_status%3A%22absent%22';

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Serve data files
app.use('/data', express.static(path.join(__dirname, 'data')));

// API proxy endpoint to fetch NBN data
app.get('/api/occurrences', async (req, res) => {
  try {
    const response = await fetch(NBN_API_URL);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Error fetching NBN data:', error);
    res.status(500).json({ error: 'Failed to fetch data from NBN Atlas' });
  }
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`NBN Atlas Viewer running at http://localhost:${PORT}`);
});
