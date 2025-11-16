import express from "express";
import { googleDesktopSerpConfig } from "./googleConfig.js";
import CheerioTree from "cheerio-tree";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/api/v1/google/serp", async (req, res) => {
  const startTime = Date.now();

  try {
    const { gotScraping } = await import("got-scraping");

    // FORCE SAFE STRING VALUES
    const q = String(req.query.q || "");
    const locale = String(req.query.locale || "en");
    const device = String(req.query.device || "desktop");

    if (!q.trim()) {
      return res.status(400).json({ error: "Missing parameter: q" });
    }

    // BUILD URL
    const serpUrl = `https://www.google.com/search?q=${encodeURIComponent(q)}&ie=UTF-8`;

    // FINAL SAFE OPTIONS (NO NUMBERS!)
    const options = {
      url: serpUrl,
      headers: {
        "User-Agent":
          device === "mobile"
            ? String(
                "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120 Safari/537.36"
              )
            : String(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
              ),
        "Accept-Language": String(locale)
      }
    };

    // SCRAPING
    const response = await gotScraping(options);

    // response is not destructured anymore (avoids type errors)
    const statusCode = response.statusCode;
    const body = response.body;

    if (statusCode !== 200) {
      return res.status(statusCode).json({
        error: "Google Response Error",
        statusCode
      });
    }

    // PARSE HTML
    const tree = new CheerioTree({ body });
    const data = tree.parse({ config: googleDesktopSerpConfig });

    const loadtime = ((Date.now() - startTime) / 1000).toFixed(2);

    res.json({
      q,
      locale,
      device,
      loadtime,
      results: data
    });
  } catch (error) {
    return res.status(500).json({
      error: "Server Crashed",
      details: String(error)
    });
  }
});

// HOME ROUTE
app.get("/", (req, res) => {
  res.send("Google SERP Scraper API is running!");
});

app.listen(PORT, () => {
  console.log("Server running on port:", PORT);
});
