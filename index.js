 import express from "express";
import { googleDesktopSerpConfig } from "./googleConfig.js";
import CheerioTree from "cheerio-tree";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/v1/google/serp", async (req, res) => {
  const startTime = Date.now();

  try {
    const { gotScraping } = await import("got-scraping");

    // FIXED QUERY PARSING
    const q = String(req.query.q || "");
    const locale = req.query.locale ? String(req.query.locale) : "en";
    const device = req.query.device ? String(req.query.device) : "desktop";

    if (!q.trim()) {
      return res.status(400).json({ error: "Missing parameter: q" });
    }

    // Build SERP URL
    let serpUrl = "https://www.google.com/search?q=" + encodeURIComponent(q);
    serpUrl += "&ie=UTF-8";

    // FIXED SAFE OPTIONS
    const options = {
      url: serpUrl,
      headers: {
        "User-Agent":
          device === "mobile"
            ? "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Safari/537.36"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

        "Accept-Language": locale
      },
      timeout: 20000
    };

    // SCRAPE GOOGLE
    const { statusCode, body } = await gotScraping(options);

    if (statusCode !== 200) {
      return res.status(statusCode).json({
        error: "Google Response Error",
        statusCode
      });
    }

    // PARSE HTML USING CHEERIOTREE
    const tree = new CheerioTree({ body });
    const data = tree.parse({ config: googleDesktopSerpConfig });

    const loadtime = ((Date.now() - startTime) / 1000).toFixed(2);

    return res.json({
      q,
      locale,
      device,
      loadtime,
      results: data
    });

  } catch (error) {
    return res.status(500).json({
      error: "Server Crashed",
      details: error.toString()
    });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("Google SERP Scraper API is running!");
});

// Start server
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});   
