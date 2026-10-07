// Reads the menus currently open for orders from cart15's public, key-less API
// (same endpoint the Chef Kamal site uses). Resolves to [] on any failure so the
// page falls back to the static menu stored in R2.

import { CART15_SELLER } from "./config.js";

const str = (v) => (typeof v === "string" ? v : null);

function normaliseItem(i) {
  if (!i || typeof i.name !== "string" || typeof i.price !== "number") return null;
  const variants = Array.isArray(i.variants) ? i.variants.filter((v) => typeof v?.price === "number") : [];
  const diet = Array.isArray(i.diet) ? i.diet : [];
  const prices = [i.price, ...variants.map((v) => v.price)];
  return {
    id: String(i.id ?? i.name),
    name: i.name,
    desc: str(i.description),
    price: variants.length ? Math.min(...prices) : i.price,
    from: variants.length > 0,
    diet: diet.includes("VE") ? "vegan" : diet.includes("V") ? "veg" : null,
    available: i.available !== false,
    category: str(i.category),
  };
}

function normaliseMenu(m) {
  if (!m || typeof m.title !== "string") return null;
  const items = (Array.isArray(m.items) ? m.items : []).map(normaliseItem).filter(Boolean);
  if (!items.length) return null;
  return {
    id: String(m.id ?? m.title),
    title: m.title,
    description: str(m.description),
    orderUrl: str(m.orderUrl),
    cutoffAt: str(m.cutoffAt),
    pickupStart: str(m.pickupStart),
    pickupEnd: str(m.pickupEnd),
    offers: (Array.isArray(m.offers) ? m.offers : []).map((o) => str(o?.name)).filter(Boolean),
    items,
  };
}

export async function getOpenMenus(CART15_BASE) {
  try {
    const res = await fetch(`${CART15_BASE}/api/public/kitchens/${encodeURIComponent(CART15_SELLER)}/menus`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(3000),
      cf: { cacheTtl: 300, cacheEverything: true },
    });
    if (!res.ok) return [];
    const body = await res.json();
    return (Array.isArray(body?.menus) ? body.menus : []).map(normaliseMenu).filter(Boolean);
  } catch (err) {
    console.error("cart15: could not load menus", err);
    return [];
  }
}
