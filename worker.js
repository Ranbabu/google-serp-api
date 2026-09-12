// ===== ImageSearch Worker - No Bing, No Wikimedia =====
// Sources: Yahoo, AOL, DuckDuckGo, Qwant, Openverse, Google News RSS, Startpage

var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
var HDRS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7",
};

function fetchT(url, opts, ms) {
  ms = ms || 9000;
  var c = new AbortController();
  var t = setTimeout(function() { c.abort(); }, ms);
  return fetch(url, Object.assign({}, opts, { signal: c.signal, redirect: "follow" }))
    .finally(function() { clearTimeout(t); });
}

function isUrl(u) {
  return typeof u === "string" && u.indexOf("http") === 0;
}

function grabAfter(html, prefix) {
  var out = [], idx = 0;
  for (;;) {
    idx = html.indexOf(prefix, idx);
    if (idx < 0) break;
    var s = idx + prefix.length;
    var e1 = html.indexOf("&", s);
    var e2 = html.indexOf('"', s);
    var e3 = html.indexOf("'", s);
    var ends = [e1, e2, e3].filter(function(x) { return x > s; });
    var e = ends.length ? Math.min.apply(null, ends) : s + 300;
    try {
      var v = decodeURIComponent(html.substring(s, e));
      if (isUrl(v)) out.push(v);
    } catch (x) {}
    idx = s;
  }
  return out;
}

function grabUrls(html, pat) {
  var out = [], idx = 0;
  for (;;) {
    idx = html.indexOf(pat, idx);
    if (idx < 0) break;
    var e = idx + pat.length;
    while (e < html.length && e < idx + 500) {
      var ch = html[e];
      if (ch === '"' || ch === "'" || ch === " " || ch === "<" || ch === ">") break;
      e++;
    }
    var v = html.substring(idx, e);
    if (v.length > pat.length + 5) out.push(v);
    idx = e;
  }
  return out;
}

// ===== 1. Yahoo Images =====
async function srcYahoo(q) {
  var r = await fetchT(
    "https://images.search.yahoo.com/search/images?p=" + encodeURIComponent(q) + "&ei=UTF-8",
    { headers: HDRS }
  );
  if (!r.ok) return [];
  var h = await r.text();
  var out = [];
  grabAfter(h, "imgurl=").forEach(function(u) { out.push({ url: u }); });
  grabUrls(h, "https://s.yimg.com/ny/api/res/").forEach(function(u) {
    out.push({ url: u, thumb: u });
  });
  return out;
}

// ===== 2. AOL Images =====
async function srcAol(q) {
  var r = await fetchT(
    "https://search.aol.com/aol/image?q=" + encodeURIComponent(q),
    { headers: HDRS }
  );
  if (!r.ok) return [];
  var h = await r.text();
  var out = [];
  grabAfter(h, "imgurl=").forEach(function(u) { out.push({ url: u }); });
  return out;
}

// ===== 3. DuckDuckGo Images =====
async function srcDdg(q) {
  var r = await fetchT(
    "https://duckduckgo.com/?q=" + encodeURIComponent(q) + "&iax=images&ia=images",
    { headers: HDRS }
  );
  if (!r.ok) return [];
  var h = await r.text();
  var vqd = "";
  var i1 = h.indexOf("vqd=");
  if (i1 >= 0) {
    var s = i1 + 4;
    var e = h.indexOf("&", s);
    if (e < 0) e = h.indexOf('"', s);
    if (e < 0) e = h.indexOf("'", s);
    if (e < 0) e = s + 20;
    vqd = h.substring(s, e);
  }
  if (!vqd) {
    var i2 = h.indexOf('vqd="');
    if (i2 >= 0) {
      var s2 = i2 + 5;
      var e2 = h.indexOf('"', s2);
      if (e2 >= 0) vqd = h.substring(s2, e2);
    }
  }
  if (!vqd) return [];
  var r2 = await fetchT(
    "https://duckduckgo.com/i.js?l=wt-wt&o=json&q=" + encodeURIComponent(q) + "&vqd=" + vqd + "&f=,,,&p=1",
    { headers: Object.assign({}, HDRS, { "x-requested-with": "XMLHttpRequest", Referer: "https://duckduckgo.com/" }) }
  );
  if (!r2.ok) return [];
  var d = await r2.json();
  return (d.results || [])
    .filter(function(x) { return isUrl(x.image); })
    .map(function(x) { return { url: x.image, thumb: x.thumbnail || null }; });
}

// ===== 4. Qwant Images API =====
async function srcQwant(q) {
  var r = await fetchT(
    "https://api.qwant.com/v3/search/images?q=" + encodeURIComponent(q) + "&count=30&offset=0&device=desktop&safesearch=1",
    { headers: { "User-Agent": UA, Accept: "application/json" } }
  );
  if (!r.ok) return [];
  var d = await r.json();
  var items = (d.data && d.data.result && d.data.result.items) || [];
  return items
    .filter(function(x) { return isUrl(x.media); })
    .map(function(x) { return { url: x.media, thumb: x.thumbnail || null }; });
}

// ===== 5. Openverse API =====
async function srcOpenverse(q) {
  var r = await fetchT(
    "https://api.openverse.org/v1/images/?q=" + encodeURIComponent(q) + "&page_size=30",
    { headers: { "User-Agent": UA } }
  );
  if (!r.ok) return [];
  var d = await r.json();
  return (d.results || [])
    .filter(function(x) { return isUrl(x.url); })
    .map(function(x) { return { url: x.url, thumb: x.thumbnail || x.url }; });
}

// ===== 6. Google News RSS =====
async function srcGoogleNews(q) {
  var r = await fetchT(
    "https://news.google.com/rss/search?q=" + encodeURIComponent(q) + "&hl=en-IN&gl=IN&ceid=IN:en",
    { headers: { "User-Agent": UA, Accept: "application/xml,text/xml" } }
  );
  if (!r.ok) return [];
  var xml = await r.text();
  var out = [];
  grabUrls(xml, "https://").forEach(function(u) {
    if (u.indexOf(".jpg") > 0 || u.indexOf(".jpeg") > 0 || u.indexOf(".png") > 0 || u.indexOf(".webp") > 0) {
      out.push({ url: u, thumb: u });
    }
  });
  return out;
}

// ===== 7. Startpage (Google Proxy) =====
async function srcStartpage(q) {
  var r = await fetchT(
    "https://www.startpage.com/sp/search?q=" + encodeURIComponent(q) + "&cat=pics",
    { headers: Object.assign({}, HDRS, { Referer: "https://www.startpage.com/" }) }
  );
  if (!r.ok) return [];
  var h = await r.text();
  var out = [];
  grabUrls(h, "https://").forEach(function(u) {
    var hasImg = u.indexOf(".jpg") > 0 || u.indexOf(".jpeg") > 0 || u.indexOf(".png") > 0 || u.indexOf(".webp") > 0;
    var notSelf = u.indexOf("startpage") < 0 && u.indexOf("google") < 0;
    if (hasImg && notSelf) out.push({ url: u, thumb: u });
  });
  return out;
}

// ===== Gather All =====
async function gather(query) {
  var jobs = [
    srcYahoo(query).catch(function() { return []; }),
    srcAol(query).catch(function() { return []; }),
    srcDdg(query).catch(function() { return []; }),
    srcQwant(query).catch(function() { return []; }),
    srcOpenverse(query).catch(function() { return []; }),
    srcGoogleNews(query).catch(function() { return []; }),
    srcStartpage(query).catch(function() { return []; }),
  ];
  var all = await Promise.allSettled(jobs);
  var merged = [], seen = {};
  for (var s = 0; s < all.length; s++) {
    var list = all[s].status === "fulfilled" && Array.isArray(all[s].value) ? all[s].value : [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (!it || !isUrl(it.url)) continue;
      var k = it.url.toLowerCase();
      if (seen[k]) continue;
      seen[k] = true;
      merged.push({ url: it.url, thumb: it.thumb || it.url });
      if (merged.length >= 30) return merged;
    }
  }
  if (!merged.length) throw new Error("No images found.");
  return merged;
}

export default {
  async fetch(request, env, ctx) {
    var cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Allow-Headers": "*",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    var url = new URL(request.url);
    var q = url.searchParams.get("q");
    var api = url.searchParams.get("api");

    if (api === "true" && q) {
      var cache = caches.default;
      var ck = new Request(url.origin + "/?api=true&q=" + encodeURIComponent(q) + "&v=6", { method: "GET" });
      try { var hit = await cache.match(ck); if (hit) return hit; } catch (e) {}

      var results = [], err = "";
      try { results = await gather(q); } catch (e) { err = e.message; }

      var body = JSON.stringify(results.length ? { results: results } : { error: err || "No images." });
      var resp = new Response(body, {
        headers: Object.assign({ "Content-Type": "application/json;charset=utf-8", "Cache-Control": "public,max-age=300" }, cors),
      });
      try { ctx.waitUntil(cache.put(ck, resp.clone())); } catch (e) {}
      return resp;
    }

    return new Response(getHtml(), { headers: { "Content-Type": "text/html;charset=utf-8" } });
  },
};

function getHtml() {
  return [
    "<!DOCTYPE html>",
    "<html lang=hi><head><meta charset=UTF-8>",
    '<meta name=viewport content="width=device-width,initial-scale=1">',
    "<title>ImageSearch Pro</title><style>",
    "*{box-sizing:border-box}",
    "body{font-family:Arial,sans-serif;margin:0;background:#fff;color:#333}",
    ".hd{padding:16px;background:#fff;position:sticky;top:0;z-index:99;box-shadow:0 2px 6px rgba(0,0,0,.1)}",
    "h1{font-size:22px;margin:0 0 12px;text-align:center;color:#4285f4}",
    ".sb{display:flex;align-items:center;border:1px solid #ddd;border-radius:24px;padding:4px 14px;background:#f9f9f9}",
    ".sb input{flex:1;padding:10px 6px;border:0;background:0 0;font-size:16px;outline:0}",
    ".sb button{background:0 0;border:0;font-size:15px;color:#4285f4;font-weight:700;cursor:pointer;padding:8px}",
    ".hs{padding:10px 14px}",
    ".hs ul{list-style:none;padding:0;margin:0;border:1px solid #eee;border-radius:8px}",
    ".hs li{display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid #eee;cursor:pointer}",
    ".hs li:last-child{border:0}",
    ".hs .x{background:0 0;border:0;font-size:18px;cursor:pointer;color:#999}",
    ".g{display:none;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px;padding:10px}",
    ".g img{width:100%;height:140px;object-fit:cover;border-radius:8px;background:#eee;cursor:pointer}",
    ".ld{text-align:center;padding:30px;display:none;color:#666}",
    ".bk{display:none;background:0 0;border:0;font-size:22px;cursor:pointer;margin-right:8px}",
    "</style></head><body>",
    '<div class=hd>',
    '<div style="display:flex;align-items:center">',
    '<button id=bk class=bk onclick=goHome()>&#8592;</button>',
    "<h1 style=flex:1>ImageSearch</h1></div>",
    '<div class=sb><span>&#128269;</span>',
    '<input id=si placeholder="Search images..." onkeypress="if(event.key===\'Enter\')doGo()">',
    '<button onclick=doGo()>Go</button></div></div>',
    '<div id=hs class=hs><div style="font-size:14px;color:#666;margin-bottom:8px">History</div>',
    "<ul id=hl></ul></div>",
    '<div id=ld class=ld>Loading...</div>',
    '<div id=gr class=g></div>',
    "<script>",
    "function doGo(){var v=document.getElementById('si').value.trim();if(v){save(v);go(v)}}",
    "function go(q){",
    "document.getElementById('hs').style.display='none';",
    "document.getElementById('bk').style.display='block';",
    "var g=document.getElementById('gr'),l=document.getElementById('ld');",
    "g.innerHTML='';g.style.display='none';l.style.display='block';",
    "fetch('/?api=true&q='+encodeURIComponent(q))",
    ".then(function(r){return r.json()})",
    ".then(function(d){",
    "g.style.display='grid';",
    "if(d.error){g.innerHTML='<p style=padding:15px;color:red;grid-column:1/-1;text-align:center>'+d.error+'</p>'}",
    "else if(d.results&&d.results.length){d.results.forEach(function(it){",
    "var img=document.createElement('img');img.loading='lazy';",
    "img.src=it.thumb||it.url;",
    "img.onerror=function(){if(this.src!==it.url){this.src=it.url}else{this.style.display='none'}};",
    "img.onclick=function(){window.open(it.url,'_blank')};",
    "g.appendChild(img)})",
    "}else{g.innerHTML='<p style=padding:15px;grid-column:1/-1;text-align:center>No images found</p>'}",
    "}).catch(function(){",
    "g.style.display='grid';",
    "g.innerHTML='<p style=padding:15px;color:red;text-align:center>Network error</p>'",
    "}).finally(function(){l.style.display='none'})",
    "}",
    "function save(q){var h=get();h=h.filter(function(x){return x!==q});h.unshift(q);if(h.length>10)h.pop();localStorage.setItem('ish',JSON.stringify(h));render()}",
    "function get(){try{return JSON.parse(localStorage.getItem('ish'))||[]}catch(e){return[]}}",
    "function del(q){var h=get().filter(function(x){return x!==q});localStorage.setItem('ish',JSON.stringify(h));render()}",
    "function render(){var l=document.getElementById('hl');l.innerHTML='';var h=get();",
    "if(!h.length){l.innerHTML='<li style=padding:14px;color:#999;text-align:center>No history</li>';return}",
    "h.forEach(function(q){var li=document.createElement('li');",
    "var sp=document.createElement('span');sp.textContent=q;",
    "var b=document.createElement('button');b.className='x';b.textContent='x';",
    "b.onclick=function(e){e.stopPropagation();del(q)};",
    "li.onclick=function(){document.getElementById('si').value=q;go(q)};",
    "li.appendChild(sp);li.appendChild(b);l.appendChild(li)})",
    "}",
    "function goHome(){document.getElementById('hs').style.display='block';",
    "document.getElementById('gr').style.display='none';",
    "document.getElementById('ld').style.display='none';",
    "document.getElementById('bk').style.display='none';",
    "document.getElementById('si').value='';render()}",
    "render()",
    "</script></body></html>",
  ].join("\n");
}
