const express = require('express');
const cors = require('cors');
const { DDGS } = require('ddgs');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// DDGS इंस्टेंस
const ddgs = new DDGS();

// होम पेज
app.get('/', (req, res) => {
  res.json({ 
    message: "ImageSearchMan DDG Proxy चल रहा है! 🚀", 
    status: "success",
    endpoint: "/api/images?q=your_search"
  });
});

// इमेज सर्च API
app.get('/api/images', async (req, res) => {
  const { q, s = 0 } = req.query;
  
  if (!q) {
    return res.status(400).json({ error: "कृपया 'q' पैरामीटर दें" });
  }

  try {
    const results = await ddgs.images(q, {
      safe_search: 'off',
      size: null,
      type: null,
      layout: null,
      license: null,
      max_results: 100,
      offset: parseInt(s) || 0
    });

    const formatted = results.map(item => ({
      title: item.title || 'No title',
      image: item.image || item.url,
      thumbnail: item.thumbnail,
      url: item.url,
      width: item.width,
      height: item.height,
      source: item.source || new URL(item.url || item.image).hostname
    }));

    res.json({
      results: formatted,
      next: formatted.length === 100 ? true : false,
      total: formatted.length,
      query: q
    });

  } catch (error) {
    console.error("DDGS Error:", error.message);
    res.status(500).json({ 
      error: "इमेजेस लोड करने में दिक्कत हुई", 
      details: error.message 
    });
  }
});

app.listen(PORT, () => {
  console.log(`DDG Proxy Server चल रहा है पोर्ट ${PORT} पर`);
  console.log(`लिंक: https://your-service.onrender.com`);
});
