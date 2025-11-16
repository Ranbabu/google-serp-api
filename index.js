import express from "express";
import { googleDesktopSerpConfig } from "./googleConfig.js";  // नीचे अलग दे दूँगा
import CheerioTree from "cheerio-tree";

// Express server
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/v1/google/serp", async (req, res) => {
  const startTime = Date.now();

  try {
    const { gotScraping } = await import("got-scraping");

    const { q, locale = "en", device = "desktop" } = req.query;

    if (!q) {
      return res.status(400).json({ error: "Missing parameter: q" });
    }

    // Build Google SERP URL
    let serpUrl = "https://www.google.com/search?q=" + encodeURIComponent(q);

    for (const [key, value] of Object.entries(req.query)) {
      if (key !== "q") serpUrl += `&${key}=${value}`;
    }
    serpUrl += "&ie=UTF-8";

    // Scraping Headers & Options
    const options = {
      url: serpUrl,
      headers: {
        "User-Agent":
          device === "mobile"
            ? "Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 Chrome/120 Safari/537.36"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

        "Accept-Language": locale,
      },
      timeout: 20000
    };

    // Scrape Google SERP
    const { statusCode, body } = await gotScraping(options);

    if (statusCode !== 200) {
      return res.status(statusCode).json({
        error: "Google Status Error",
        statusCode,
      });
    }

    // CheerioTree Parsing
    const tree = new CheerioTree({ body });
    const data = tree.parse({ config: googleDesktopSerpConfig });

    const loadtime = ((Date.now() - startTime) / 1000).toFixed(2);
    res.setHeader("x-load-time", loadtime + "s");

    res.json({
      q,
      device,
      locale,
      loadtime,
      results: data
    });
  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: "Server Crashed", details: error.toString() });
  }
});

// Default route
app.get("/", (req, res) => {
  res.send("Google SERP Scraper API is running!");
});

// Start Server
app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});
