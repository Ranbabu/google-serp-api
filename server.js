const express = require('express');
const cors = require('cors');
const { search } = require('duck-duck-scrape');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// रूट चेक
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family: sans-serif; text-align: center; padding: 40px; background: #111; color: #fff; height: 100vh;">
      <h1 style="color: #06ffa5;">DDG Proxy Live 🟢</h1>
      <p>Status: Working with duck-duck-scrape</p>
      <p>Try: <a href="/api/images?q=india" style="color: #ff006e;">Test Search</a></p>
    </div>
  `);
});

// इमेज सर्च API
app.get('/api/images', async (req, res) => {
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    // DuckDuckGo से इमेज सर्च (SafeSearch: Off ताकि ज्यादा रिजल्ट मिलें)
    const searchResults = await search(query, {
      searchType: "image",
      safeSearch: 0 // 0 = off, 1 = moderate, 2 = strict
    });

    // रिजल्ट्स को सही फॉर्मेट में बदलना
    const formattedResults = searchResults.results.map(item => ({
      title: item.title || 'No Title',
      // 'image' वो फुल साइज URL है, 'thumbnail' छोटा वाला
      image: item.image,     
      thumbnail: item.thumbnail,
      source: item.source || 'DuckDuckGo',
      url: item.url // पेज का लिंक
    }));

    // अगर डेटा नहीं मिला
    if (!formattedResults || formattedResults.length === 0) {
      return res.json({ results: [], total: 0 });
    }

    res.json({
      results: formattedResults,
      total: formattedResults.length,
      next: true // सिंपल लॉजिक के लिए हमेशा ट्रू रख रहे हैं
    });

  } catch (error) {
    console.error('Search Error:', error);
    res.status(500).json({ error: 'Failed to fetch images', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
