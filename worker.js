/**
 * Zzzの聚合图标站 - 极致加速+图标统计版
 */

const BG_API = "https://www.loliapi.com/acg/";

export default {
  async scheduled(event, env, ctx) {
    await refreshAllConfigs(env);
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cache = caches.default;

    // --- 极速分发层 ---
    if (path.startsWith("/share/")) {
      let response = await cache.match(request);
      if (response) return response;

      const slug = path.split("/")[2];
      const data = await env.DB.get(`DATA:${slug}`);
      if (!data) return new Response("数据未找到", { status: 404 });

      response = new Response(data, {
        headers: {
          "Content-Type": "application/json;charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
          "Vary": "Accept-Encoding"
        }
      });

      ctx.waitUntil(cache.put(request, response.clone()));
      return response;
    }

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    if (path === "/" || path === "/index.html") {
      return new Response(renderHTML(), { headers: { "Content-Type": "text/html;charset=utf-8" } });
    }

    // 创建并返回图标数量
    if (path === "/api/create" && request.method === "POST") {
      const { gists } = await request.json();
      const slug = Math.random().toString(36).substring(2, 8);
      await env.DB.put(`CONFIG:${slug}`, JSON.stringify(gists));
      const count = await syncData(slug, gists, env);
      return new Response(JSON.stringify({ success: true, slug, count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 同步并返回图标数量
    if (path === "/api/sync") {
      const slug = url.searchParams.get("slug");
      const config = await env.DB.get(`CONFIG:${slug}`);
      if (!config) return new Response("Fail", { status: 404, headers: corsHeaders });
      
      const count = await syncData(slug, JSON.parse(config), env);
      
      const shareRequest = new Request(new URL(`/share/${slug}`, url.origin));
      ctx.waitUntil(cache.delete(shareRequest));
      
      return new Response(JSON.stringify({ success: true, count }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response("Not Found", { status: 404 });
  }
};

async function syncData(slug, gists, env) {
  let combinedIcons = [];
  let names = [];

  const results = await Promise.allSettled(
    gists.map(u => fetch(u).then(r => r.json()))
  );

  results.forEach(res => {
    if (res.status === 'fulfilled') {
      const d = res.value;
      if (d.icons) combinedIcons = combinedIcons.concat(d.icons);
      if (d.name) names.push(d.name);
    }
  });

  const finalData = JSON.stringify({
    name: names.join(" & ") || "Aggregated Icons",
    icons: combinedIcons,
    updated_at: new Date().toLocaleString()
  });

  await env.DB.put(`DATA:${slug}`, finalData);
  return combinedIcons.length; // 返回图标总数
}

async function refreshAllConfigs(env) {
  const list = await env.DB.list({ prefix: "CONFIG:" });
  for (const key of list.keys) {
    const slug = key.name.split(":")[1];
    const gists = await env.DB.get(key.name);
    if (gists) await syncData(slug, JSON.parse(gists), env);
  }
}

function renderHTML() {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
    <meta charset="UTF-8">
    <title>Emby图标链接の聚合地</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🌸</text></svg>">
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
        background: rgba(255,255,255,0.7); /* 保持一致的浅色透明背景 */
        padding: 15px;
        border-radius: 15px;
        word-break: break-all;
        margin-top: 8px;
        border: 1px solid #fff;
        font-size: 13px;
        color: #333; /* 使用较深的文本颜色 */
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
      <h1>🌸 Zzzの聚合图标站 🌸</h1>
      <textarea id="gs" placeholder="请粘贴 Gist 原始链接，每行一个..."></textarea>
      <button class="btn" onclick="gen()">✨ 生成聚合链接</button>
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
          document.getElementById('rs').style.display='block';
          document.getElementById('url').innerText = window.location.origin + '/share/' + s;
          document.getElementById('msg').innerText = '✅ 已更新完毕！共聚合了 ' + d.count + ' 个图标';
        }
      }
      async function sync(){
        document.getElementById('msg').innerText = '⏳ 正在同步...';
        const r = await fetch('/api/sync?slug=' + s);
        const d = await r.json();
        document.getElementById('msg').innerText = '✅ 已更新完毕！共聚合了 ' + d.count + ' 个图标';
      }
    </script>
  </body>
  </html>
  `;
}
