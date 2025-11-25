const express = require("express");
const cors = require("cors");
const { DDGS } = require("ddgs");  // ddgs library for auto VQD handling

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

    const ddgs = new DDGS({ lang: "hi" });  // Hindi support
    const page = Math.floor(s / 50) + 1;  // ddgs pagination (50 per page)
    const maxResults = s > 0 ? 50 : 100;  // First page 100, others 50

    const results = await ddgs.images({
      keywords: q,
      max_results: maxResults,
      page: page
    });

    // Format for frontend: title, image, thumbnail, url, source
    const formattedResults = results.map(r => ({
      title: r.title || "",
      image: r.image || "",
      thumbnail: r.thumbnail || r.image || "",
      url: r.url || "",
      source: r.source || ""
    }));

    const hasNext = results.length === maxResults;  // If full, next page available

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
  res.send("DDG Proxy Working ✔ (Updated with ddgs - No VQD needed, 2025 ready)");
});

app.listen(PORT, () => {
  console.log(`DDG Proxy running on port ${PORT}`);
});
