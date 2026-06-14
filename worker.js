export default {
  async fetch(request) {
    const url = new URL(request.url);
    const query = url.searchParams.get("q");

    // CORS Headers ताकि आपकी वेबसाइट इस API को कॉल कर सके
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,HEAD,POST,OPTIONS",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (!query) {
      return new Response(JSON.stringify({ error: "कृपया कोई कीवर्ड सर्च करें" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }

    // Yahoo Image Search का इस्तेमाल (Scraping Proxy)
    const searchUrl = `https://images.search.yahoo.com/search/images?p=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(searchUrl);
      const html = await response.text();

      // HTML से इमेज URLs निकालने का बेसिक तरीका
      const imgRegex = /<img[^>]+src="([^">]+)"/g;
      let images = [];
      let match;
      
      while ((match = imgRegex.exec(html)) !== null && images.length < 20) {
         if(match[1].startsWith('http') && !match[1].includes('favicon')) {
            images.push({ url: match[1] });
         }
      }

      return new Response(JSON.stringify({ results: images }), {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders } 
      });
    }
  }
};
