// server.js
// DuckDuckGo image proxy for client apps (Express)
// Usage: GET /api/images?q=QUERY&s=OFFSET
// Returns the JSON from DuckDuckGo i.js after obtaining vqd token.
// Small in-memory caching for vqd and results to reduce requests.

const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors()); // Allow all origins by default (you can restrict if needed)
app.use(express.json());

// Simple in-memory caches
const vqdCache = new Map();   // key = query, value = {vqd, ts}
const resultCache = new Map(); // key = q|s, value = {data, ts}
const CACHE_TTL = 1000 * 60 * 2; // 2 minutes for results
const VQD_TTL = 1000 * 60 * 60;  // 1 hour for vqd

// helper: get vqd token by fetching DuckDuckGo search page
async function getVqd(query) {
  const key = query;
  const now = Date.now();
  // cached?
  const cached = vqdCache.get(key);
  if (cached && (now - cached.ts) < VQD_TTL) {
    return cached.vqd;
  }

  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&t=h_&ia=images`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });
  const text = await res.text();

  // vqd pattern examples in page: vqd='3-1234567890123456789';
  const m = text.match(/vqd='([^']+)'/);
  if (m && m[1]) {
    const vqd = m[1];
    vqdCache.set(key, { vqd, ts: now });
    return vqd;
  }

  // fallback: try another pattern
  const m2 = text.match(/vqd=([\d-]+)/);
  if (m2 && m2[1]) {
    const vqd = m2[1];
    vqdCache.set(key, { vqd, ts: now });
    return vqd;
  }

  throw new Error('vqd token not found');
}

// API endpoint
app.get('/api/images', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    const s = parseInt(req.query.s || '0', 10) || 0;

    if (!q) {
      return res.status(400).json({ error: 'Missing query param q' });
    }

    const cacheKey = `${q}|${s}`;
    const now = Date.now();
    const cached = resultCache.get(cacheKey);
    if (cached && (now - cached.ts) < CACHE_TTL) {
      return res.json({ cached: true, ...cached.data });
    }

    // get vqd
    const vqd = await getVqd(q);

    // call i.js with vqd
    const ijsUrl = `https://duckduckgo.com/i.js?l=hi&q=${encodeURIComponent(q)}&vqd=${encodeURIComponent(vqd)}&s=${s}`;

    const ires = await fetch(ijsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0 Safari/537.36',
        'Referer': `https://duckduckgo.com/?q=${encodeURIComponent(q)}`
      }
    });

    if (!ires.ok) {
      // Try once more after clearing vqd (in case it's expired)
      vqdCache.delete(q);
      throw new Error('DuckDuckGo i.js responded with status ' + ires.status);
    }

    const data = await ires.json();
    // cache result
    resultCache.set(cacheKey, { data, ts: now });
    // send result to client
    res.json(data);
  } catch (err) {
    console.error('Error /api/images', err.message || err);
    res.status(500).json({ error: err.message || 'Server error' });
  }
});

// Health
app.get('/', (req, res) => {
  res.send('DDG Proxy is running. Use /api/images?q=...&s=0');
});

// Start server
app.listen(PORT, () => {
  console.log(`DDG proxy listening on port ${PORT}`);
});
