/**
 * Zzz's Icon Aggregation Station - Cloudflare Worker
 */

const BG_API = "https://www.loliapi.com/acg/";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async scheduled(event, env, ctx) {
    await refreshAllConfigs(env);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cache = caches.default;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Public share endpoint, now supports `.json` suffix
    if (path.startsWith("/share/")) {
      let slug = path.replace("/share/", "");
      if (slug.endsWith(".json")) slug = slug.slice(0, -5);
      if (!slug) return new Response("Missing slug", { status: 400, headers: corsHeaders });

      const cacheKey = new Request(new URL(`/share/${slug}.json`, url.origin), request);
      const currentRev = await env.DB.get(`REV:${slug}`);

      const cached = await cache.match(cacheKey);
      if (cached) {
        if (!currentRev) return cached;
        const cachedEtag = cached.headers.get("ETag");
        if (cachedEtag === buildEtag(currentRev)) return cached;
      }

      const data = await env.DB.get(`DATA:${slug}`);
      if (!data) return new Response("Not Found", { status: 404, headers: corsHeaders });

      const dataRev = getRevFromData(data) || getUpdatedAtFromData(data);
      if (cached) {
        const cachedEtag = cached.headers.get("ETag");
        if (dataRev && cachedEtag === buildEtag(dataRev)) return cached;
      }

      const responseRev = currentRev || dataRev;
      const response = new Response(data, {
        headers: {
          "Content-Type": "application/json;charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          "Vary": "Accept-Encoding",
          ...(responseRev ? { ETag: buildEtag(responseRev) } : {}),
        },
      });

      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    }

    if (path === "/" || path === "/index.html") {
      return new Response(renderHTML(), { headers: { "Content-Type": "text/html;charset=utf-8" } });
    }

    // Create a new aggregated config
    if (path === "/api/create" && request.method === "POST") {
      const { gists } = await request.json();
      const slug = Math.random().toString(36).substring(2, 8);
      await env.DB.put(`CONFIG:${slug}`, JSON.stringify(gists));
      const count = await syncData(slug, gists, env);
      return new Response(JSON.stringify({ success: true, slug, count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Refresh an existing aggregation
    if (path === "/api/sync") {
      const slug = url.searchParams.get("slug");
      const config = await env.DB.get(`CONFIG:${slug}`);
      if (!config) return new Response("Fail", { status: 404, headers: corsHeaders });

      const count = await syncData(slug, JSON.parse(config), env);

      // Invalidate cached share responses (.json and legacy)
      const shareRequest = new Request(new URL(`/share/${slug}`, url.origin));
      const shareJsonRequest = new Request(new URL(`/share/${slug}.json`, url.origin));
      ctx.waitUntil(Promise.all([cache.delete(shareRequest), cache.delete(shareJsonRequest)]));

      return new Response(JSON.stringify({ success: true, count }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
};

async function syncData(slug, gists, env) {
  let combinedIcons = [];
  let names = [];

  const syncTime = new Date().toISOString();
  const results = await Promise.allSettled(
    gists.map((sourceUrl) => fetch(addCacheBust(sourceUrl, syncTime)).then((r) => r.json()))
  );

  results.forEach((res) => {
    if (res.status === "fulfilled") {
      const d = res.value;
      if (d.icons) combinedIcons = combinedIcons.concat(d.icons);
      if (d.name) names.push(d.name);
    }
  });

  const payload = {
    name: names.join(" & ") || "Aggregated Icons",
    icons: combinedIcons,
  };
  const rev = await sha256Hex(JSON.stringify(payload));
  const currentRev = await env.DB.get(`REV:${slug}`);

  // KV 写入很贵：内容没变就不写（尤其是 cron 每 30 分钟跑一次时）
  if (currentRev && currentRev === rev) return combinedIcons.length;

  const finalData = JSON.stringify({ ...payload, updated_at: syncTime, rev });
  await Promise.all([env.DB.put(`DATA:${slug}`, finalData), env.DB.put(`REV:${slug}`, rev)]);
  return combinedIcons.length;
}

async function refreshAllConfigs(env) {
  let cursor = undefined;
  let listComplete = false;
  do {
    const list = await env.DB.list({ prefix: "CONFIG:", cursor });
    cursor = list.cursor;
    listComplete = typeof list.list_complete === "boolean" ? list.list_complete : !cursor;
    await mapWithConcurrency(list.keys, 5, async (key) => {
      try {
        const slug = key.name.split(":")[1];
        const gists = await env.DB.get(key.name);
        if (gists) await syncData(slug, JSON.parse(gists), env);
      } catch (err) {
        console.log("Failed to refresh config", key.name, err);
      }
    });
  } while (!listComplete);
}

function renderHTML() {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>Emby 图标链接聚合站</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>">
    <style>
      :root { --primary: #ff85a2; --glass: rgba(255, 255, 255, 0.8); }
      body {
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: url('${BG_API}') no-repeat center center fixed;
        background-size: cover;
        font-family: sans-serif;
        color: white;
      }
      .overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        backdrop-filter: blur(4px);
        z-index: -1;
      }
      .container {
        width: 90%;
        max-width: 500px;
        background: var(--glass);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.4);
        border-radius: 28px;
        padding: 40px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.1);
        text-align: center;
      }
      h1 {
        color: var(--primary);
        font-size: 28px;
        margin-bottom: 25px;
        text-shadow: 0 2px 4px white;
      }
      textarea {
        width: 100%;
        height: 130px;
        border: 2.5px solid rgba(251, 182, 206, 0.5);
        border-radius: 18px;
        padding: 15px;
        box-sizing: border-box;
        background: rgba(255,255,255,0.8);
        outline: none;
        margin-bottom: 20px;
        resize: none;
      }
      .btn {
        width: 100%;
        background: var(--primary);
        color: white;
        border: none;
        padding: 16px;
        border-radius: 18px;
        font-weight: bold;
        cursor: pointer;
        font-size: 17px;
        transition: 0.3s;
      }
      .btn:hover {
        transform: translateY(-2px);
        filter: brightness(1.05);
      }
      .res {
        margin-top: 30px;
        display: none;
        text-align: left;
      }
      .card {
        background: rgba(255,255,255,0.7);
        padding: 15px;
        border-radius: 15px;
        word-break: break-all;
        margin-top: 8px;
        border: 1px solid #fff;
        font-size: 13px;
        color: #333;
      }
      #msg {
        text-align: center;
        font-size: 14px;
        margin-top: 15px;
        color: #ff477e;
        font-weight: bold;
      }
    </style>
  </head>
  <body>
    <div class="overlay"></div>
    <div class="container">
      <h1>🌸 Zzz 的聚合图标站 🌸</h1>
      <textarea id="gs" placeholder="请粘贴 Gist 原始链接，每行一个..."></textarea>
      <button class="btn" onclick="gen()">✅ 生成聚合链接</button>
      <div id="rs" class="res">
        <label style="font-weight:bold; color:#ff477e;">🌸 聚合地址：</label>
        <div id="url" class="card"></div>
        <button class="btn" style="background:#8eb6ff; margin-top:20px;" onclick="sync()">🔄 更新同步数据</button>
        <div id="msg"></div>
      </div>
    </div>
    <script>
      let s = '';
      async function gen(){
        const lines = document.getElementById('gs').value.split('\\n').filter(l=>l.trim().startsWith('http'));
        const r = await fetch('/api/create', { method:'POST', body: JSON.stringify({gists:lines}) });
        const d = await r.json();
        if(d.slug){
          s = d.slug;
          const shareUrl = window.location.origin + '/share/' + s + '.json';
          document.getElementById('rs').style.display='block';
          document.getElementById('url').innerText = shareUrl;
          document.getElementById('msg').innerText = '✅ 已生成，当前聚合 ' + d.count + ' 个图标。';
        }
      }
      async function sync(){
        if(!s) return;
        document.getElementById('msg').innerText = '⌛ 正在同步...';
        const r = await fetch('/api/sync?slug=' + s);
        const d = await r.json();
        document.getElementById('msg').innerText = '✅ 已更新完成！共聚合了 ' + d.count + ' 个图标。';
      }
    </script>
  </body>
  </html>
  `;
}

function buildEtag(rev) {
  return `W/"${rev}"`;
}

function getUpdatedAtFromData(rawData) {
  try {
    const parsed = JSON.parse(rawData);
    if (!parsed || typeof parsed !== "object") return undefined;
    if (typeof parsed.updated_at !== "string" || !parsed.updated_at) return undefined;
    return parsed.updated_at;
  } catch {
    return undefined;
  }
}

function getRevFromData(rawData) {
  try {
    const parsed = JSON.parse(rawData);
    if (!parsed || typeof parsed !== "object") return undefined;
    if (typeof parsed.rev !== "string" || !parsed.rev) return undefined;
    return parsed.rev;
  } catch {
    return undefined;
  }
}

function addCacheBust(rawUrl, cacheBust) {
  try {
    const url = new URL(rawUrl);
    url.searchParams.set("_", cacheBust);
    return url.toString();
  } catch {
    return rawUrl;
  }
}

async function mapWithConcurrency(items, limit, iterator) {
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  const workers = Array.from({ length: safeLimit }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      await iterator(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(workers);
}

async function sha256Hex(text) {
  const encoded = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
