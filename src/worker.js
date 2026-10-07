import fallbackContent from "../menu/menu.json";
import { renderPage } from "./render.js";
import { getOpenMenus } from "./cart15.js";
import { getConfig } from "./config.js";

const MENU_KEY = "menu.json";

async function loadContent(env) {
  try {
    const obj = await env.MENU_BUCKET.get(MENU_KEY);
    if (obj) return await obj.json();
  } catch (err) {
    console.error("menu: could not read from R2, using bundled copy", err);
  }
  return fallbackContent;
}

function securityHeaders(headers) {
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "DENY");
  return headers;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const { CART15_BASE, SITE } = getConfig(env);
      const [content, menus] = await Promise.all([loadContent(env), getOpenMenus(CART15_BASE)]);
      const headers = securityHeaders(new Headers({
        "Content-Type": "text/html; charset=utf-8",
        // Short cache so a menu update shows up within a minute.
        "Cache-Control": "public, max-age=0, s-maxage=60",
      }));
      const html = renderPage({ SITE, menu: content.menu, menus, origin: SITE.url || url.origin });
      return new Response(request.method === "HEAD" ? null : html, { headers });
    }

    if (url.pathname === "/api/menu") {
      const { CART15_BASE } = getConfig(env);
      const [content, menus] = await Promise.all([loadContent(env), getOpenMenus(CART15_BASE)]);
      return Response.json({ ...content, menus }, { headers: { "Cache-Control": "public, max-age=30" } });
    }

    // Dish photos live in R2 under img/<file>
    if (url.pathname.startsWith("/img/")) {
      const key = decodeURIComponent(url.pathname.slice(1));
      if (!/^img\/[\w.-]+$/.test(key)) return new Response("Not found", { status: 404 });
      const obj = await env.MENU_BUCKET.get(key);
      if (!obj) return new Response("Not found", { status: 404 });
      const headers = securityHeaders(new Headers());
      obj.writeHttpMetadata(headers);
      headers.set("ETag", obj.httpEtag);
      headers.set("Cache-Control", "public, max-age=86400");
      return new Response(request.method === "HEAD" ? null : obj.body, { headers });
    }

    // Everything else (CSS, JS, favicon) comes from static assets.
    const res = await env.ASSETS.fetch(request);
    return new Response(res.body, { status: res.status, headers: securityHeaders(new Headers(res.headers)) });
  },
};
