export default {
  async fetch(request) {
    // CORS Headers - ताकि कोई भी वेबसाइट इस API को बिना एरर कॉल कर सके
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const isApi = url.searchParams.get("api");

    // 1. Yahoo & AOL Image Scraper (ताज़ा न्यूज़ इमेजेज के लिए)
    if (isApi === "true" && query) {
      try {
        let images = [];
        const reqHeaders = { 
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept-Language": "hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7"
        };

        // तरीका 1: Yahoo Images (करेंट इवेंट्स और न्यूज़ इमेजेज के लिए बहुत फ़ास्ट है)
        try {
            const yahooUrl = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}`;
            const yahooRes = await fetch(yahooUrl, { headers: reqHeaders });
            
            if (yahooRes.ok) {
                const yahooHtml = await yahooRes.text();
                // Yahoo के HTML से असली हाई-क्वालिटी इमेज URL निकालना
                const matches = [...yahooHtml.matchAll(/imgurl=([^&"']+)/g)];
                for (const match of matches) {
                    images.push({ url: decodeURIComponent(match[1]) });
                }
            }
        } catch (e) {
            console.log("Yahoo Error", e);
        }

        // तरीका 2: AOL Search (अगर किसी वजह से Yahoo सर्वर डाउन हो)
        if (images.length === 0) {
            try {
                const aolUrl = `https://search.aol.com/aol/image?q=${encodeURIComponent(query)}`;
                const aolRes = await fetch(aolUrl, { headers: reqHeaders });
                
                if (aolRes.ok) {
                    const aolHtml = await aolRes.text();
                    const matches = [...aolHtml.matchAll(/imgurl=([^&"']+)/g)];
                    for (const match of matches) {
                        images.push({ url: decodeURIComponent(match[1]) });
                    }
                }
            } catch (e) {
                console.log("AOL Error", e);
            }
        }

        if (images.length === 0) {
            throw new Error("सर्च इंजन ने ब्लॉक कर दिया या कोई करंट इमेज नहीं मिली।");
        }

        // डुप्लीकेट इमेजेज हटाना और टॉप 30 इमेजेज ही भेजना
        images = Array.from(new Set(images.map(i => i.url)))
                      .map(url => ({ url }))
                      .slice(0, 30);

        return new Response(JSON.stringify({ results: images }), {
          headers: { "Content-Type": "application/json", ...corsHeaders }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 200, 
            headers: { "Content-Type": "application/json", ...corsHeaders } 
        });
      }
    }

    // 2. HTML वेबसाइट UI (यूजर इंटरफेस वही रखा गया है)
    const htmlContent = `
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ImageSearchMan - Pro</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #ffffff; color: #333; }
        .header { padding: 20px 15px; background: white; position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
        h1 { font-size: 24px; margin: 0 0 20px 0; font-weight: bold; text-align: center; color: #4285f4; }
        .search-container { position: relative; }
        .search-box { display: flex; align-items: center; border: 1px solid #ddd; border-radius: 25px; padding: 5px 15px; background: #f9f9f9; }
        input[type="text"] { flex: 1; padding: 10px 5px; border: none; background: transparent; font-size: 16px; outline: none; }
        .search-btn { background: none; border: none; font-size: 16px; color: #4285f4; font-weight: bold; cursor: pointer; padding: 10px; }
        .history-section { padding: 10px 15px; }
        .history-title { font-size: 14px; color: #666; margin-bottom: 10px; }
        .history-list { list-style: none; padding: 0; margin: 0; border: 1px solid #eee; border-radius: 8px; }
        .history-item { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #eee; font-size: 15px; cursor: pointer; }
        .history-item:last-child { border-bottom: none; }
        .delete-btn { background: none; border: none; font-size: 18px; cursor: pointer; color: #999; }
        .image-grid { display: none; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; padding: 10px; }
        .image-item { width: 100%; height: 140px; object-fit: cover; border-radius: 8px; background: #eee; box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: pointer; }
        .loading { text-align: center; padding: 30px; display: none; font-size: 16px; color: #666; }
        .back-btn { display: none; background: none; border: none; font-size: 24px; margin-right: 10px; cursor: pointer; color: #333; }
    </style>
</head>
<body>
    <div class="header">
        <div style="display: flex; align-items: center;">
            <button id="backBtn" class="back-btn" onclick="showHistory()">←</button>
            <h1 style="flex:1; margin:0;">ImageSearch</h1>
        </div>
        <div class="search-container" style="margin-top: 15px;">
            <div class="search-box">
                <span>🔍</span>
                <input type="text" id="searchInput" placeholder="इमेज सर्च करें..." onkeypress="if(event.key==='Enter') triggerSearch()">
                <button class="search-btn" onclick="triggerSearch()">खोजें</button>
            </div>
        </div>
    </div>

    <div id="historySection" class="history-section">
        <div class="history-title">सर्च हिस्ट्री</div>
        <ul id="historyList" class="history-list"></ul>
    </div>

    <div id="loading" class="loading">⏳ इमेजेज लोड हो रही हैं...</div>
    <div id="imageGrid" class="image-grid"></div>

    <script>
        const API_URL = window.location.origin + "/?api=true&q=";

        document.addEventListener("DOMContentLoaded", loadHistory);

        function triggerSearch() {
            const query = document.getElementById("searchInput").value.trim();
            if (query) {
                saveToHistory(query);
                fetchImages(query);
            }
        }

        async function fetchImages(query) {
            document.getElementById("historySection").style.display = "none";
            document.getElementById("backBtn").style.display = "block";
            
            const grid = document.getElementById("imageGrid");
            const loading = document.getElementById("loading");

            grid.innerHTML = "";
            grid.style.display = "none";
            loading.style.display = "block";

            try {
                const response = await fetch(API_URL + encodeURIComponent(query));
                const data = await response.json();

                grid.style.display = "grid";
                
                if (data.error) {
                    grid.innerHTML = \`<p style='padding:15px; grid-column: 1 / -1; color:red; text-align:center;'>⚠️ \${data.error}</p>\`;
                }
                else if (data.results && data.results.length > 0) {
                    data.results.forEach(item => {
                        const img = document.createElement("img");
                        img.src = item.url;
                        img.className = "image-item";
                        img.loading = "lazy";
                        
                        img.onerror = function() {
                            this.style.display = 'none';
                        };
                        
                        img.onclick = () => window.open(item.url, '_blank');
                        
                        grid.appendChild(img);
                    });
                } else {
                    grid.innerHTML = "<p style='padding:15px; grid-column: 1 / -1; text-align:center;'>कोई इमेज नहीं मिली। कीवर्ड बदलकर ट्राई करें।</p>";
                }
            } catch (error) {
                grid.style.display = "block";
                grid.innerHTML = "<p style='padding:15px; color:red; text-align:center;'>❌ नेटवर्क एरर आ गया। कृपया दोबारा कोशिश करें।</p>";
            } finally {
                loading.style.display = "none";
            }
        }

        function getHistory() {
            const history = localStorage.getItem('imageSearchHistory');
            return history ? JSON.parse(history) : [];
        }

        function saveToHistory(query) {
            let history = getHistory().filter(item => item !== query);
            history.unshift(query);
            if (history.length > 10) history.pop(); 
            localStorage.setItem('imageSearchHistory', JSON.stringify(history));
            loadHistory();
        }

        function deleteHistoryItem(event, query) {
            event.stopPropagation();
            let history = getHistory().filter(item => item !== query);
            localStorage.setItem('imageSearchHistory', JSON.stringify(history));
            loadHistory();
        }

        function loadHistory() {
            const history = getHistory();
            const list = document.getElementById("historyList");
            list.innerHTML = "";
            if (history.length === 0) {
                list.innerHTML = "<li style='padding:15px; color:#999; text-align:center;'>कोई हिस्ट्री नहीं है</li>";
            } else {
                history.forEach(query => {
                    const li = document.createElement("li");
                    li.className = "history-item";
                    li.onclick = () => { document.getElementById("searchInput").value = query; fetchImages(query); };
                    li.innerHTML = \`<span>\${query}</span><button class="delete-btn" onclick="deleteHistoryItem(event, '\${query}')">✕</button>\`;
                    list.appendChild(li);
                });
            }
        }

        function showHistory() {
            document.getElementById("historySection").style.display = "block";
            document.getElementById("imageGrid").style.display = "none";
            document.getElementById("loading").style.display = "none";
            document.getElementById("backBtn").style.display = "none";
            document.getElementById("searchInput").value = "";
            loadHistory();
        }
    </script>
</body>
</html>
    `;

    return new Response(htmlContent, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
};
