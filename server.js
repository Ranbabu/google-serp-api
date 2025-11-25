const express = require("express");
const cors = require("cors");
const { DDGS } = require("ddgs");  // ddgs लाइब्रेरी

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// API endpoint for images
app.get("/api/images", async (req, res) => {
  try {
    const q = req.query.q;
    const s = parseInt(req.query.s) || 0;  // offset

    if (!q) {
      return res.status(400).json({ error: "Missing query" });
    }

    const ddgs = new DDGS({ lang: "hi" });  // हिंदी सपोर्ट
    const page = Math.floor(s / 50) + 1;  // ddgs में page-based pagination (50 per page)
    const maxResults = s > 0 ? 50 : 100;  // पहला पेज 100, बाकी 50

    const results = await ddgs.images({
      keywords: q,
      max_results: maxResults,
      page: page
    });

    // फ्रंटएंड फॉर्मेट मैच: title, image, thumbnail, url, source
    const formattedResults = results.map(r => ({
      title: r.title || "",
      image: r.image || "",
      thumbnail: r.thumbnail || r.image || "",
      url: r.url || "",
      source: r.source || ""
    }));

    const hasNext = results.length === maxResults;  // अगर फुल, तो नेक्स्ट पेज है

    res.json({
      results: formattedResults,
      next: hasNext
    });
  } catch (err) {
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Failed to fetch images" });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("DDG Proxy Working ✔ (Updated with ddgs - 2025)");
});

app.listen(PORT, () => {
  console.log(`DDG Proxy running on port ${PORT}`);
});
