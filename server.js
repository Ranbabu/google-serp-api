const express = require('express');
const cors = require('cors');
const { DDGS } = require('ddgs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// DDGS सेटअप (2025 लेटेस्ट, no VQD needed)
const ddgs = new DDGS({
  lang: 'hi',  // हिंदी सपोर्ट
  lite: true,  // फास्ट मोड
  backend: 'lite'  // लाइट बैकएंड, no heavy scraping
});

// होमपेज
app.get('/', (req, res) => {
  res.send(`
    <div style="text-align:center; padding:50px; color:#fff; background:#000; font-family:Arial;">
      <h1>🦆 DDG Proxy Working ✔ (2025 No VQD Edition)</h1>
      <p>ImageSearchMan के लिए तैयार! 🚀</p>
      <p><a href="/api/images?q=test" style="color:#06ffa5;">टेस्ट सर्च करें</a></p>
      <p>Status: Live | ddgs: v9.6.1 | Node: 20+</p>
    </div>
  `);
});

// इमेज API (pure ddgs, no VQD)
app.get('/api/images', async (req, res) => {
  try {
    const { q, s = 0 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'क्वेरी "q" जरूरी है! (जैसे q=cat)' });
    }

    // DDGS images सर्च (max 100, offset सपोर्ट)
    const results = await ddgs.images({
      keywords: q,
      max_results: 100,
      offset: parseInt(s) || 0
    });

    // फ्रंटएंड फॉर्मेट
    const formatted = results.map(item => ({
      title: item.title || 'कोई टाइटल नहीं',
      image: item.image || item.url,
      thumbnail: item.thumbnail || item.image,
      url: item.url || '',
      source: item.source || (item.url ? new URL(item.url).hostname : 'DDG'),
      width: item.width,
      height: item.height
    }));

    res.json({
      results: formatted,
      next: results.length === 100,  // नेक्स्ट पेज?
      total: results.length,
      query: q
    });

  } catch (error) {
    console.error('DDGS Error:', error);
    res.status(500).json({ 
      error: 'इमेज लोड करने में दिक्कत', 
      details: error.message 
    });
  }
});

// सर्वर स्टार्ट
app.listen(PORT, () => {
  console.log(`🚀 ImageSearchMan DDG Proxy पोर्ट ${PORT} पर लाइव!`);
  console.log(`टेस्ट करें: https://your-url.onrender.com/api/images?q=cat`);
});
