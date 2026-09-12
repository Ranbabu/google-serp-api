const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const HTML_HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7",
};
const SRC_TIMEOUT = 4500;

function fetchT(url, opts = {}, ms = SRC_TIMEOUT, signal) {
  const ct = new AbortController();
  const t = setTimeout(() => ct.abort(), ms);
  const onAbort = () => ct.abort();
  if (signal) { if (signal.aborted) ct.abort(); else signal.addEventListener("abort", onAbort); }
  return fetch(url, { ...opts, signal: ct.signal, redirect: "follow" })
    .finally(() => { clearTimeout(t); if (signal) signal.removeEventListener("abort", onAbort); });
}
const decodeEnt = s => String(s || "").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
const okUrl = u => typeof u === "string" && /^https?:\/\//i.test(u);
const clip = h => h.slice(0, 1200000);

// 1. GOOGLE NEWS (ताज़ा न्यूज़ इमेजेज)
async function googleNewsImages(q, signal) {
  const res = await fetchT("https://news.google.com/search?q=" + encodeURIComponent(q) + "&hl=hi&gl=IN&ceid=IN:hi", { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  if (signal && signal.aborted) return [];
  const html = clip(await res.text());
  const out = [];
  for (const m of html.matchAll(new RegExp('src="(https://news.google.com/[^"]+|https://[^"]*googleusercontent.com[^"]+)"', "g"))) {
    const d = decodeEnt(m[1]); if (okUrl(d)) out.push({ url: d, thumb: d });
  }
  for (const m of html.matchAll(new RegExp("https://[^\"'\\s<>]+\\.(?:jpg|jpeg|png|webp)", "gi"))) {
    if (okUrl(m[0])) out.push({ url: m[0], thumb: m[0] });
  }
  return out;
}

// 2. GOOGLE IMAGES (last 24h filter)
async function googleImages(q, signal) {
  const res = await fetchT("https://images.google.com/search?q=" + encodeURIComponent(q) + "&hl=hi&gl=in&tbs=qdr:d", { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  if (signal && signal.aborted) return [];
  const html = clip(await res.text());
  const out = [];
  for (const m of html.matchAll(new RegExp("imgurl=([^&\"']+)", "g"))) {
    try { const d = decodeURIComponent(m[1]); if (okUrl(d)) out.push({ url: d }); } catch (e) {}
  }
  for (const m of html.matchAll(new RegExp('data-ou="([^"]+)"', "g"))) {
    const d = decodeEnt(m[1]); if (okUrl(d)) out.push({ url: d });
  }
  return out;
}

// 3. DUCKDUCKGO (JSON API - fastest)
async function ddgImages(q, signal) {
  const t = await fetchT("https://duckduckgo.com/?q=" + encodeURIComponent(q) + "&iax=images&ia=images", { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!t.ok) return [];
  const th = clip(await t.text());
  const vm = th.match(new RegExp('vqd=["\']?([\\d-]+)["\']?')) || th.match(new RegExp("vqd=([^&\"']+)"));
  if (!vm) return [];
  const res = await fetchT("https://duckduckgo.com/i.js?l=wt-wt&o=json&q=" + encodeURIComponent(q) + "&vqd=" + vm[1] + "&f=,,,&p=1", {
    headers: { ...HTML_HEADERS, "x-requested-with": "XMLHttpRequest", Referer: "https://duckduckgo.com/" },
  }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(r => ({ url: r.image, thumb: r.thumbnail || null })).filter(i => okUrl(i.url));
}

// 4. YANDEX IMAGES
async function yandexImages(q, signal) {
  const res = await fetchT("https://yandex.com/images/search?text=" + encodeURIComponent(q), { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  if (signal && signal.aborted) return [];
  const html = clip(await res.text());
  const out = [];
  for (const m of html.matchAll(new RegExp('"origUrl":"(https?://[^"]+)"', "g"))) {
    const d = decodeEnt(m[1]); if (okUrl(d)) out.push({ url: d });
  }
  for (const m of html.matchAll(new RegExp('"(https?://avatars.mds.yandex.net/[^"]+)"', "g"))) {
    out.push({ url: m[1], thumb: m[1] });
  }
  return out;
}

// 5. YAHOO
async function yahooImages(q, signal) {
  const res = await fetchT("https://images.search.yahoo.com/search/images?p=" + encodeURIComponent(q) + "&ei=UTF-8&fr=yfp-t", { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  if (signal && signal.aborted) return [];
  const html = clip(await res.text());
  const out = [];
  for (const m of html.matchAll(new RegExp("imgurl=([^&\"']+)", "g"))) {
    try { const d = decodeURIComponent(m[1]); if (okUrl(d)) out.push({ url: d }); } catch (e) {}
  }
  for (const m of html.matchAll(new RegExp("https://s\\.yimg\\.com/ny/api/res/[^\"'\\s\\\\]+", "g"))) {
    out.push({ url: m[0], thumb: m[0] });
  }
  return out.filter(i => okUrl(i.url));
}

// 6. AOL
async function aolImages(q, signal) {
  const res = await fetchT("https://search.aol.com/aol/image?q=" + encodeURIComponent(q), { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  if (signal && signal.aborted) return [];
  const html = clip(await res.text());
  const out = [];
  for (const m of html.matchAll(new RegExp("imgurl=([^&\"']+)", "g"))) {
    try { const d = decodeURIComponent(m[1]); if (okUrl(d)) out.push({ url: d }); } catch (e) {}
  }
  return out.filter(i => okUrl(i.url));
}

// 7. FLICKR
async function flickrImages(q, signal) {
  const res = await fetchT("https://www.flickr.com/search/?text=" + encodeURIComponent(q) + "&media=photos", { headers: HTML_HEADERS }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  if (signal && signal.aborted) return [];
  const html = clip(await res.text());
  const out = [];
  for (const m of html.matchAll(new RegExp('"(https://live.staticflickr.com/[^"]+)"', "g"))) {
    const u2 = decodeEnt(m[1]); if (okUrl(u2)) out.push({ url: u2, thumb: u2 });
  }
  return out;
}

// 8. OPENVERSE (कभी ब्लॉक नहीं)
async function openverseImages(q, signal) {
  const res = await fetchT("https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) + "&page_size=20", { headers: { "User-Agent": UA } }, SRC_TIMEOUT, signal);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.results || []).map(r => ({ url: r.url, thumb: r.thumbnail || r.url })).filter(i => okUrl(i.url));
}

const SOURCES = [googleNewsImages, ddgImages, googleImages, yandexImages, yahooImages, aolImages, flickrImages, openverseImages];

// ---- Early-exit collector: n इमेज मिलते ही finish, या maxWait पर finish ----
function makeCollector(target, maxWait) {
  const ac = new AbortController();
  let results = [];
  const seen = new Set();
  let settled = false, resolveFn;
  const promise = new Promise(r => { resolveFn = r; });
  const timer = setTimeout(finish, maxWait);
  function finish() {
    if (settled) return;
    settled = true; clearTimeout(timer); ac.abort(); resolveFn(results);
  }
  function push(items) {
    if (settled || !Array.isArray(items)) return;
    for (const it of items) {
      if (!it || !okUrl(it.url)) continue;
      const k = it.url.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      results.push({ url: it.url, thumb: it.thumb || it.url });
      if (results.length >= target) break;
    }
    if (results.length >= target) finish();
  }
  return { push, finish, promise, signal: ac.signal };
}

async function searchOne(query, n, maxWait) {
  const col = makeCollector(n, maxWait);
  const jobs = SOURCES.map(fn => fn(query, col.signal).then(list => col.push(list)).catch(() => {}));
  Promise.allSettled(jobs).then(() => col.finish());
  return col.promise;
}

// ---- Per-query edge cache (10 min) ----
const cacheKeyFor = (q, n) => new Request("https://imgcache.internal/v7?n=" + n + "&q=" + encodeURIComponent(q));
async function cachedResultsFor(q, n) {
  try { const hit = await caches.default.match(cacheKeyFor(q, n)); if (hit) return await hit.json(); } catch (e) {}
  return null;
}
async function storeResultsFor(q, n, results) {
  try {
    await caches.default.put(cacheKeyFor(q, n), new Response(JSON.stringify(results), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=600" },
    }));
  } catch (e) {}
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    const url = new URL(request.url);
    const isApi = url.searchParams.get("api");
    const rawQ = url.searchParams.get("qs") || url.searchParams.get("q") || "";
    const queries = rawQ.split(/[|\n\r]+/).map(s => s.trim()).filter(Boolean).slice(0, 10);
    let n = parseInt(url.searchParams.get("n") || "30", 10); if (!(n > 0)) n = 30; n = Math.min(n, 30);
    let maxWait = parseInt(url.searchParams.get("wait") || "3500", 10); if (!(maxWait > 0)) maxWait = 3500;
    maxWait = Math.max(1200, Math.min(maxWait, 9000));

    if (isApi === "true" && queries.length) {
      const out = {};
      const missing = [];
      await Promise.all(queries.map(async q => {
        const c = await cachedResultsFor(q, n);
        if (c && c.length) out[q] = c; else missing.push(q);
      }));
      if (missing.length) {
        const found = await Promise.all(missing.map(q => searchOne(q, n, maxWait)));
        missing.forEach((q, i) => {
          out[q] = found[i] || [];
          if (found[i] && found[i].length && ctx && ctx.waitUntil) ctx.waitUntil(storeResultsFor(q, n, found[i]));
        });
      }
      const first = out[queries[0]] || [];
      const body = JSON.stringify(queries.length === 1 ? { results: first } : { batches: out, results: first });
      return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=600", ...corsHeaders } });
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
.batch-title{grid-column:1/-1;font-size:14px;font-weight:bold;color:#4285f4;padding:8px 4px 2px;border-bottom:1px solid #eee}
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
  <div class="source-info">Google • DDG • Yandex • Yahoo • AOL • Flickr • Openverse | ⚡ 2-4 सेकंड</div>
</div>
<div id="historySection" class="history-section">
  <div class="history-title">सर्च हिस्ट्री</div>
  <ul id="historyList" class="history-list"></ul>
</div>
<div id="loading" class="loading">⏳ इमेजेज लोड हो रही हैं...</div>
<div id="imageGrid" class="image-grid"></div>
<script>
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
function cacheGet(q){ try { var raw = sessionStorage.getItem('isc:'+q); if (!raw) return null; var o = JSON.parse(raw); if (Date.now()-o.t > 600000) return null; return o.data; } catch(e){ return null; } }
function cacheSet(q,d){ try { sessionStorage.setItem('isc:'+q, JSON.stringify({t:Date.now(), data:d})); } catch(e){} }
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
function renderBatches(batches){
  var grid = document.getElementById('imageGrid');
  grid.innerHTML = ''; grid.style.display = 'grid';
  Object.keys(batches).forEach(function(q){
    var h = document.createElement('div'); h.className = 'batch-title'; h.textContent = q;
    grid.appendChild(h);
    (batches[q] || []).forEach(function(item){ grid.appendChild(makeImg(item)); });
  });
}
async function fetchImages(query){
  document.getElementById('historySection').style.display = 'none';
  document.getElementById('backBtn').style.display = 'block';
  var grid = document.getElementById('imageGrid');
  var loading = document.getElementById('loading');
  var cached = cacheGet(query);
  if (cached) { cached.batches ? renderBatches(cached.batches) : renderResults(cached.results || []); loading.style.display='none'; }
  else { grid.innerHTML=''; grid.style.display='none'; loading.style.display='block'; }
  try {
    var response = await fetch(window.location.origin + '/?api=true&q=' + encodeURIComponent(query));
    var data = await response.json();
    if (data.batches) { cacheSet(query, {batches: data.batches}); renderBatches(data.batches); }
    else if (data.results && data.results.length) { cacheSet(query, {results: data.results}); renderResults(data.results); }
    else if (!cached) { grid.style.display='grid'; grid.innerHTML = "<p style='padding:15px;grid-column:1/-1;text-align:center;'>⚠️ " + (data.error || 'कोई इमेज नहीं मिली।') + "</p>"; }
  } catch (error) {
    if (!cached) { grid.style.display='grid'; grid.innerHTML = "<p style='padding:15px;color:red;text-align:center;'>❌ नेटवर्क एरर। दोबारा कोशिश करें।</p>"; }
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
