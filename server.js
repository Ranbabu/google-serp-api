const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// vqd token cache
let vqdCache = {};
let cacheTime = {};

async function getVqd(query) {
  const now = Date.now();

  if (vqdCache[query] && now - cacheTime[query] < 3600 * 1000) {
    return vqdCache[query];
  }

  const url = `https://duckduckgo.com/?q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" }
  });

  const text = await res.text();
  const match = text.match(/vqd='([^']+)'/);

  if (!match) throw new Error("Failed to get vqd token");

  const token = match[1];
  vqdCache[query] = token;
  cacheTime[query] = now;

  return token;
}

app.get("/api/images", async (req, res) => {
  try {
    const q = req.query.q;
    const s = req.query.s || 0;

    if (!q) return res.json({ error: "Missing query" });

    const vqd = await getVqd(q);

    const apiURL = `https://duckduckgo.com/i.js?l=hi&q=${encodeURIComponent(
      q
    )}&vqd=${vqd}&s=${s}`;

    const imgRes = await fetch(apiURL, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const json = await imgRes.json();
    res.json(json);
  } catch (err) {
    res.json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.send("DDG Proxy Working ✔");
});

app.listen(PORT, () => {
  console.log("DDG Proxy running on port", PORT);
});
