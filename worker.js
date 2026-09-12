const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HTML_HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7",
};

function fetchT(url, opts = {}, ms = 9000) {
  const ct = new AbortController();
  const t = setTimeout(() => ct.abort(), ms);
  return fetch(url, { ...opts, signal: ct.signal, redirect: "follow" }).finally(() => clearTimeout(t));
}
const decodeEnt = s => String(s || "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const okUrl = u => typeof u === "string" && /^https?:\/\//i.test(u);

// ---------- 1. GOOGLE IMAGES (news + fresh) ----------
async function googleImages(q) {
  const u = "https://images.google.com/search?q=" + encodeURIComponent(q) + "&hl=hi&gl=in&safe=off&tbs=qdr:d";
  const res = await fetchT(u, { headers: HTML_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  // imgurl= से निकालो (standard Google format)
  for (const m of html.matchAll(new RegExp("imgurl=([^&\"']+)", "g"))) {
    try { const d = decodeURIComponent(m[1]); if (okUrl(d)) out.push({ url: d, thumb: null }); } catch (e) {}
  }
  // data-ou= fallback
  for (const m of html.matchAll(new RegExp('data-ou="([^"]+)"', "g"))) {
    const d = decodeEnt(m[1]); if (okUrl(d)) out.push({ url: d, thumb: null });
  }
  return out;
}

// ---------- 2. GOOGLE NEWS IMAGES (सिर्फ ताज़ा न्यूज़) ----------
async function googleNewsImages(q) {
  const u = "https://news.google.com/search?q=" + encodeURIComponent(q) + "&hl=hi&gl=IN&ceid=IN:hi";
  const res = await fetchT(u, { headers: HTML_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  // Google News thumbnails
  for (const m of html.matchAll(new RegExp('src="(https://news.google.com/list[^"]+|https://[^"]*googleusercontent.com[^"]+)"', "g"))) {
    const d = decodeEnt(m[1]); if (okUrl(d)) out.push({ url: d, thumb: d });
  }
  // generic https images
  for (const m of html.matchAll(new RegExp("https://[^\"'\\s<>]+\\.(?:jpg|jpeg|png|webp)", "gi"))) {
    if (okUrl(m[0])) out.push({ url: m[0], thumb: m[0] });
  }
  return out;
}

// ---------- 3. YANDEX IMAGES (scraping friendly) ----------
async function yandexImages(q) {
  const u = "https://yandex.com/images/search?text=" + encodeURIComponent(q);
  const res = await fetchT(u, { headers: HTML_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  for (const m of html.matchAll(new RegExp('"origUrl":"(https?://[^"]+)"', "g"))) {
    const d = decodeEnt(m[1]); if (okUrl(d)) out.push({ url: d, thumb: null });
  }
  // yandex thumbs
  for (const m of html.matchAll(new RegExp('"(https?://avatars.mds.yandex.net/[^"]+)"', "g"))) {
    out.push({ url: m[1], thumb: m[1] });
  }
  return out;
}

// ---------- 4. DUCKDUCKGO IMAGES (JSON API) ----------
async function ddgImages(q) {
  const t = await fetchT("https://duckduckgo.com/?q=" + encodeURIComponent(q) + "&iax=images&ia=images", { headers: HTML_HEADERS });
  if (!t.ok) return [];
  const th = await t.text();
  const vm = th.match(new RegExp('vqd=["\']?([\\d-]+)["\']?')) || th.match(new RegExp("vqd=([^&\"']+)"));
  if (!vm) return [];
  const res = await fetchT("https://duckduckgo.com/i.js?l=wt-wt&o=json&q=" + encodeURIComponent(q) + "&vqd=" + vm[1] + "&f=,,,&p=1", {
    headers: { ...HTML_HEADERS, "x-requested-with": "XMLHttpRequest", Referer: "https://duckduckgo.com/" },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(r => ({ url: r.image, thumb: r.thumbnail || null })).filter(i => okUrl(i.url));
}

// ---------- 5. YAHOO IMAGES ----------
async function yahooImages(q) {
  const u = "https://images.search.yahoo.com/search/images?p=" + encodeURIComponent(q) + "&ei=UTF-8&fr=yfp-t";
  const res = await fetchT(u, { headers: HTML_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  for (const m of html.matchAll(new RegExp("imgurl=([^&\"']+)", "g"))) {
    try { const d = decodeURIComponent(m[1]); if (okUrl(d)) out.push({ url: d }); } catch (e) {}
  }
  for (const m of html.matchAll(new RegExp("https://s\\.yimg\\.com/ny/api/res/[^\"'\\s\\\\]+", "g"))) {
    out.push({ url: m[0], thumb: m[0] });
  }
  return out.filter(i => okUrl(i.url));
}

// ---------- 6. AOL IMAGES ----------
async function aolImages(q) {
  const u = "https://search.aol.com/aol/image?q=" + encodeURIComponent(q);
  const res = await fetchT(u, { headers: HTML_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  for (const m of html.matchAll(new RegExp("imgurl=([^&\"']+)", "g"))) {
    try { const d = decodeURIComponent(m[1]); if (okUrl(d)) out.push({ url: d }); } catch (e) {}
  }
  return out.filter(i => okUrl(i.url));
}

// ---------- 7. OPENVERSE API (कभी ब्लॉक नहीं) ----------
async function openverseImages(q) {
  const res = await fetchT("https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) + "&page_size=25", { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(r => ({ url: r.url, thumb: r.thumbnail || r.url })).filter(i => okUrl(i.url));
}

// ---------- 8. FLICKR PUBLIC SEARCH (no auth) ----------
async function flickrImages(q) {
  const u = "https://www.flickr.com/search/?text=" + encodeURIComponent(q) + "&media=photos&dimension_search_mode=min&height=400&width=400";
  const res = await fetchT(u, { headers: HTML_HEADERS });
  if (!res.ok) return [];
  const html = await res.text();
  const out = [];
  for (const m of html.matchAll(new RegExp('"(https://live.staticflickr.com/[^"]+)"', "g"))) {
    const u2 = decodeEnt(m[1]);
    if (okUrl(u2) && !out.some(o => o.url === u2)) out.push({ url: u2, thumb: u2 });
  }
  return out;
}

// ---------- MAIN AGGREGATOR (priority order for news) ----------
async function gatherImages(query) {
  const jobs = [
    googleNewsImages(query).catch(() => []),   // प्राथमिकता: ताज़ा न्यूज़
    googleImages(query).catch(() => []),       // Google main
    ddgImages(query).catch(() => []),
    yandexImages(query).catch(() => []),
    yahooImages(query).catch(() => []),
    aolImages(query).catch(() => []),
    flickrImages(query).catch(() => []),
    openverseImages(query).catch(() => []),
  ];
  const settled = await Promise.allSettled(jobs);
  const merged = [];
  const seen = new Set();
  for (const s of settled) {
    const list = s.status === "fulfilled" && Array.isArray(s.value) ? s.value : [];
    for (const item of list) {
      if (!item || !okUrl(item.url)) continue;
      const key = item.url.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ url: item.url, thumb: item.thumb || item.url });
      if (merged.length >= 30) return merged;
    }
  }
  if (!merged.length) throw new Error("सभी स्रोत विफल। कोई इमेज नहीं मिली। कीवर्ड बदलकर ट्राई करें।");
  return merged;
}

// ========== Worker Entry ==========
export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const query = url.searchParams.get("q");
    const isApi = url.searchParams.get("api");

    if (isApi === "true" && query) {
      const cache = caches.default;
      const cacheKey = new Request(url.origin + "/?api=true&q=" + encodeURIComponent(query) + "&v=5", { method: "GET" });
      try { const hit = await cache.match(cacheKey); if (hit) return hit; } catch (e) {}

      let results = [], errorMsg = "";
      try { results = await gatherImages(query); } catch (e) { errorMsg = e.message; }

      const body = JSON.stringify(results.length ? { results } : { error: errorMsg });
      const resp = new Response(body, {
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", ...corsHeaders },
      });
      try { if (ctx && ctx.waitUntil) ctx.waitUntil(cache.put(cacheKey, resp.clone())); } catch (e) {}
      return resp;
    }

    const htmlContent = `
<!DOCTYPE html>
<html lang="hi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>ImageSearchMan - Pro</title>
<style>
body{font-family:Arial,sans-serif;margin:0;padding:0;background:#fff;color:#333}
.header{padding:20px 15px;background:#fff;position:sticky;top:0;z-index:100;box-shadow:0 2px 5px rgba(0,0,0,.1)}
h1{font-size:24px;margin:0;font-weight:bold;text-align:center;color:#4285f4}
.search-box{display:flex;align-items:center;border:1px solid #ddd;border-radius:25px;padding:5px 15px;background:#f9f9f9;margin-top:15px}
input[type=text]{flex:1;padding:10px 5px;border:none;background:transparent;font-size:16px;outline:none}
.search-btn{background:none;border:none;font-size:16px;color:#4285f4;font-weight:bold;cursor:pointer;padding:10px}
.history-section{padding:10px 15px}
.history-title{font-size:14px;color:#666;margin-bottom:10px}
.history-list{list-style:none;padding:0;margin:0;border:1px solid #eee;border-radius:8px}
.history-item{display:flex;justify-content:space-between;align-items:center;padding:15px;border-bottom:1px solid #eee;font-size:15px;cursor:pointer}
.history-item:last-child{border-bottom:none}
.delete-btn{background:none;border:none;font-size:18px;cursor:pointer;color:#999}
.image-grid{display:none;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;padding:10px}
.image-item{width:100%;height:140px;object-fit:cover;border-radius:8px;background:#eee;box-shadow:0 1px 3px rgba(0,0,0,.2);cursor:pointer}
.loading{text-align:center;padding:30px;display:none;font-size:16px;color:#666}
.back-btn{display:none;background:none;border:none;font-size:24px;margin-right:10px;cursor:pointer;color:#333}
.source-info{text-align:center;font-size:11px;color:#999;margin-top:8px}
</style>
</head>
<body>
<div class="header">
  <div style="display:flex;align-items:center;">
    <button id="backBtn" class="back-btn" onclick="showHistory()">←</button>
    <h1 style="flex:1;">ImageSearch</h1>
  </div>
  <div class="search-box">
    <span>🔍</span>
    <input type="text" id="searchInput" placeholder="हेडलाइन डालें..." onkeypress="if(event.key==='Enter') triggerSearch()">
    <button class="search-btn" onclick="triggerSearch()">खोजें</button>
  </div>
  <div class="source-info">Google • Yandex • DDG • Yahoo • AOL • Flickr • Openverse</div>
</div>
<div id="historySection" class="history-section">
  <div class="history-title">सर्च हिस्ट्री</div>
  <ul id="historyList" class="history-list"></ul>
</div>
<div id="loading" class="loading">⏳ इमेजेज लोड हो रही हैं...</div>
<div id="imageGrid" class="image-grid"></div>
<script>
var lastQuery='';
document.addEventListener('DOMContentLoaded', function(){
  loadHistory();
  document.getElementById('historyList').addEventListener('click', function(e){
    var li = e.target.closest('.history-item');
    if (!li) return;
    if (e.target.closest('.delete-btn')) { removeHistory(li.dataset.q); }
    else { document.getElementById('searchInput').value = li.dataset.q; fetchImages(li.dataset.q); }
  });
});
function triggerSearch(){
  var q = document.getElementById('searchInput').value.trim();
  if (q) { saveToHistory(q); fetchImages(q); }
}
function cacheGet(q){ try { var raw = sessionStorage.getItem('isc:'+q); if (!raw) return null; var o = JSON.parse(raw); if (Date.now()-o.t > 600000) return null; return o.results; } catch(e){ return null; } }
function cacheSet(q,r){ try { sessionStorage.setItem('isc:'+q, JSON.stringify({t:Date.now(), results:r.slice(0,30)})); } catch(e){} }
function makeImg(item){
  var img = document.createElement('img');
  img.className = 'image-item'; img.loading = 'lazy'; img.decoding = 'async';
  var primary = item.thumb || item.url;
  img.src = primary;
  img.dataset.fallback = (primary !== item.url) ? item.url : '';
  img.onerror = function(){ var fb = this.dataset.fallback; if (fb){ this.dataset.fallback=''; this.src=fb; } else { this.style.display='none'; } };
  img.onclick = function(){ window.open(item.url, '_blank'); };
  return img;
}
function renderResults(results){
  var grid = document.getElementById('imageGrid');
  grid.innerHTML = ''; grid.style.display = 'grid';
  results.forEach(function(item){ grid.appendChild(makeImg(item)); });
}
async function fetchImages(query){
  lastQuery = query;
  document.getElementById('historySection').style.display = 'none';
  document.getElementById('backBtn').style.display = 'block';
  var grid = document.getElementById('imageGrid');
  var loading = document.getElementById('loading');
  var cached = cacheGet(query);
  if (cached && cached.length) { renderResults(cached); loading.style.display='none'; }
  else { grid.innerHTML=''; grid.style.display='none'; loading.style.display='block'; }
  try {
    var response = await fetch(window.location.origin + '/?api=true&q=' + encodeURIComponent(query));
    var data = await response.json();
    if (data.error) {
      if (!cached) { grid.innerHTML = "<p style='padding:15px;grid-column:1/-1;color:red;text-align:center;'>⚠️ " + data.error + "</p>"; grid.style.display='grid'; }
    } else if (data.results && data.results.length) {
      cacheSet(query, data.results);
      renderResults(data.results);
    } else if (!cached) {
      grid.style.display='grid';
      grid.innerHTML = "<p style='padding:15px;grid-column:1/-1;text-align:center;'>कोई इमेज नहीं मिली। कीवर्ड बदलकर ट्राई करें।</p>";
    }
  } catch (error) {
    if (!cached) { grid.style.display='grid'; grid.innerHTML = "<p style='padding:15px;color:red;text-align:center;'>❌ नेटवर्क एरर। कृपया दोबारा कोशिश करें।</p>"; }
  } finally { loading.style.display = 'none'; }
}
function getHistory(){ var h = localStorage.getItem('imageSearchHistory'); return h ? JSON.parse(h) : []; }
function saveToHistory(q){ var h = getHistory().filter(function(i){ return i !== q; }); h.unshift(q); if (h.length > 10) h.pop(); localStorage.setItem('imageSearchHistory', JSON.stringify(h)); loadHistory(); }
function removeHistory(q){ var h = getHistory().filter(function(i){ return i !== q; }); localStorage.setItem('imageSearchHistory', JSON.stringify(h)); loadHistory(); }
function loadHistory(){
  var list = document.getElementById('historyList');
  list.innerHTML = '';
  var h = getHistory();
  if (!h.length) { list.innerHTML = "<li style='padding:15px;color:#999;text-align:center;'>कोई हिस्ट्री नहीं है</li>"; return; }
  h.forEach(function(q){
    var li = document.createElement('li');
    li.className = 'history-item'; li.dataset.q = q;
    var sp = document.createElement('span'); sp.textContent = q;
    var btn = document.createElement('button'); btn.className = 'delete-btn'; btn.textContent = '✕';
    li.appendChild(sp); li.appendChild(btn);
    list.appendChild(li);
  });
}
function showHistory(){
  document.getElementById('historySection').style.display = 'block';
  document.getElementById('imageGrid').style.display = 'none';
  document.getElementById('loading').style.display = 'none';
  document.getElementById('backBtn').style.display = 'none';
  document.getElementById('searchInput').value = '';
  loadHistory();
}
</script>
</body>
</html>
    `;
    return new Response(htmlContent, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
};
