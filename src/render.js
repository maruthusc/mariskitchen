import { TIMEZONE } from "./config.js";

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const gbp = (n) => "£" + (Number.isInteger(n) ? String(n) : n.toFixed(2));

// cart15 already adjusts menu times for the kitchen's local time, so they are shown as returned (UTC).
const fmt = (opts, iso) => new Intl.DateTimeFormat("en-GB", { timeZone: TIMEZONE, ...opts }).format(new Date(iso));
const day = (iso) => fmt({ weekday: "short", day: "numeric", month: "short" }, iso);
const time = (iso) => fmt({ hour: "2-digit", minute: "2-digit", hour12: false }, iso);
const formatCutoff = (iso) => `${day(iso)}, ${time(iso)}`;
const formatWindow = (a, b) =>
  day(a) === day(b) ? `${day(a)}, ${time(a)} to ${time(b)}` : `${day(a)}, ${time(a)} to ${day(b)}, ${time(b)}`;
const longDate = (iso) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(iso + "T00:00:00Z"),
  );

/** A glimpse, not the whole menu: the full menu lives on cart15. */
const MAX_DISHES = 6;

const CHIPS = ["Idly", "Idiyappam", "Kulambu", "Chicken 65", "Nethili fry", "Chicken Sukka", "Kootu", "Poriyal", "Chapathi"];

const icon = {
  steam: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 26h32c0 8-6 14-16 14S8 34 8 26Z"/><path d="M17 8c-3 3 3 5 0 9M24 6c-3 3 3 6 0 11M31 8c-3 3 3 5 0 9"/></svg>`,
  leaf: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 38C8 20 20 8 40 8c0 20-12 32-30 30Z"/><path d="M10 38 28 20"/></svg>`,
  bag: `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 16h28l-2 24H12L10 16Z"/><path d="M17 16v-2a7 7 0 0 1 14 0v2"/><path d="M19 28l4 4 7-8"/></svg>`,
  pin: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21Z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
  chat: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z"/></svg>`,
};

const dietTag = (diet) => (diet ? `<span class="tag">${diet === "vegan" ? "Vegan" : "Veg"}</span>` : "");

function renderDish(d) {
  return `
          <li class="dish${d.available ? "" : " sold-out"}">
            ${d.image ? `<img class="dish-photo" src="/img/${esc(d.image)}" alt="" loading="lazy" width="56" height="56">` : ""}
            <span class="dish-name">${esc(d.name)}${dietTag(d.diet)}</span>
            <span class="dish-dots" aria-hidden="true"></span>
            <span class="price">${d.from ? "from " : ""}${gbp(d.price)}</span>
          </li>`;
}

function renderGlimpseCard({ title, description, banner, meta, offers = [], items, total = items.length, orderUrl, cta }) {
  const shown = items.slice(0, MAX_DISHES);
  const more = total - shown.length;
  const metaHtml = meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("");
  return `
      <article class="menu-card">
        <h3>${esc(title)}</h3>
        ${description ? `<p class="menu-desc">${esc(description)}</p>` : ""}
        ${banner ? `<p class="banner">${banner}</p>` : ""}
        ${metaHtml ? `<dl class="meta">${metaHtml}</dl>` : ""}
        ${offers.length ? `<ul class="offers" aria-label="Offers">${offers.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
        <ul class="dishes">${shown.map(renderDish).join("")}</ul>
        ${more > 0 ? `<p class="more">+ ${more} more ${more === 1 ? "dish" : "dishes"} on the order page</p>` : ""}
        <a class="btn btn-primary block" href="${esc(orderUrl)}" target="_blank" rel="noopener">${cta}</a>
      </article>`;
}

// Live menu published on cart15.
function liveCard(m, SITE) {
  const meta = [];
  if (m.pickupStart && m.pickupEnd) meta.push(["Collect", formatWindow(m.pickupStart, m.pickupEnd)]);
  if (m.cutoffAt) meta.push(["Order by", formatCutoff(m.cutoffAt)]);
  return renderGlimpseCard({
    title: m.title,
    description: m.description,
    meta,
    offers: m.offers,
    items: m.items.filter((i) => i.available),
    orderUrl: m.orderUrl || SITE.cart15Url,
    cta: "See full menu &amp; order",
  });
}

// Fallback from R2 (menu.json) when nothing is open on cart15.
function fallbackCard(menu, SITE) {
  const all = menu.sections.flatMap((s) => s.items);
  const picks = (all.some((i) => i.featured) ? all.filter((i) => i.featured) : all).map((i) => ({
    name: i.name,
    price: i.price,
    from: false,
    diet: i.veg === true ? "veg" : null,
    available: !i.soldOut,
    image: i.image,
  }));
  return renderGlimpseCard({
    title: "A taste of our kitchen",
    banner: menu.date
      ? `Nothing is open for orders right now. Here is a taste of what we cooked on <strong>${esc(longDate(menu.date))}</strong>; menus change daily.`
      : "Nothing is open for orders right now. Menus change daily.",
    meta: [["Collect", SITE.collection]],
    items: picks,
    total: all.length,
    orderUrl: SITE.cart15Url,
    cta: "Check the order page",
  });
}

export function renderPage({ SITE, menu, menus = [] }) {
  const orderUrl = SITE.cart15Url;
  const live = menus.length > 0;
  const waUrl = SITE.whatsappHref ? `${SITE.whatsappHref}?text=${encodeURIComponent(`Hi ${SITE.name}! I have a question.`)}` : "";
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.postcode)}`;
  const pc = esc(SITE.postcode);

  const glimpse = live ? menus.map((m) => liveCard(m, SITE)).join("") : fallbackCard(menu, SITE);

  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: SITE.name,
    servesCuisine: ["South Indian", "Tamil"],
    description: SITE.tagline,
    image: `${SITE.url}/og.png`,
    address: { "@type": "PostalAddress", postalCode: SITE.postcode, addressCountry: "GB" },
    hasMenu: orderUrl,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(SITE.name)} — Homemade South Indian Food, Cambridge</title>
<meta name="description" content="${esc(SITE.tagline)} Idly, idiyappam, kulambu, Chicken 65 and more. Order online and collect fresh.">
<meta name="theme-color" content="#95d0ba">
<meta property="og:title" content="${esc(SITE.name)} — Homemade South Indian Food">
<meta property="og:description" content="${esc(SITE.tagline)}">
<meta property="og:type" content="website">
<meta property="og:image" content="${esc(SITE.url)}/og.png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${ld}</script>
</head>
<body>
<a class="skip" href="#menu">Skip to menu</a>

<header class="top">
  <a class="brand" href="#top" aria-label="${esc(SITE.name)} home">
    <img src="/logo-mark.svg" alt="" width="26" height="30"><span>${esc(SITE.name)}</span>
  </a>
  <nav aria-label="Main">
    <a href="#menu">Menu</a>
    <a href="#how">How it works</a>
    <a href="#visit">Collect</a>
  </nav>
  <a class="btn btn-primary small" href="${esc(orderUrl)}" target="_blank" rel="noopener">Order</a>
</header>

<main id="top">
  <section class="hero">
    <div class="hero-inner">
      <img class="logo" src="/logo.svg" alt="The Homemade Cook — real food for real families" width="640" height="389" fetchpriority="high">
      <h1>Traditional South Indian food, <em>made at home</em> and ready to collect.</h1>
      <p class="lead">Idly, idiyappam, kulambu, Chicken 65 and more. Order online and pick it up fresh.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="${esc(orderUrl)}" target="_blank" rel="noopener">Order now</a>
        <a class="btn btn-light" href="#menu">See the menu</a>
      </div>
      <ul class="facts">
        <li>${icon.clock}<span>${esc(SITE.collection)}</span></li>
        <li>${icon.pin}<span>Collect from ${pc}</span></li>
      </ul>
    </div>
    <svg class="wave" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 60V28C240 4 480 0 720 18s480 26 720 4v38H0Z"/></svg>
  </section>

  <div class="chips" aria-label="Some of what we cook"><ul>${[...CHIPS, ...CHIPS].map((c, i) => `<li${i >= CHIPS.length ? ' aria-hidden="true"' : ""}>${c}</li>`).join("")}</ul></div>

  <section class="menu" id="menu">
    <div class="wrap">
      <p class="eyebrow">${live ? "Open for orders" : "From our kitchen"}</p>
      <h2>On the menu</h2>
      <div class="menu-grid${live && menus.length > 1 ? " two" : ""}">${glimpse}
      </div>
      <p class="allergy"><strong>Allergies?</strong> ${esc(menu.note)} Allergen details are on the order page.</p>
    </div>
  </section>

  <section class="why">
    <div class="wrap">
      <ul class="why-grid">
        <li>${icon.steam}<h3>Homemade</h3><p>Traditional South Indian recipes, cooked at home.</p></li>
        <li>${icon.leaf}<h3>New menu daily</h3><p>Idlies, kulambu, fries and more. Check what is open today.</p></li>
        <li>${icon.bag}<h3>Collect fresh</h3><p>Order online, then pick up in the collection window.</p></li>
      </ul>
    </div>
  </section>

  <section class="how" id="how">
    <div class="wrap">
      <p class="eyebrow">Simple as 1-2-3</p>
      <h2>How to order</h2>
      <ol class="steps">
        <li><b>1</b><div><h3>Pick your dishes</h3><p>Open the order page and choose from the full menu.</p></div></li>
        <li><b>2</b><div><h3>Order before cut-off</h3><p>Each menu closes at its cut-off time, so order early.</p></div></li>
        <li><b>3</b><div><h3>Collect it fresh</h3><p>Pick up from ${pc} in the collection window.</p></div></li>
      </ol>
      <a class="btn btn-primary" href="${esc(orderUrl)}" target="_blank" rel="noopener">Start your order</a>
    </div>
  </section>

  <section class="visit" id="visit">
    <div class="wrap">
      <p class="eyebrow">Find us</p>
      <h2>Collection</h2>
      <div class="cards">
        <div class="card">${icon.pin}<h3>Where</h3><p>Collection venue<br><strong>${pc}</strong></p><a href="${esc(mapLink)}" target="_blank" rel="noopener">Open in Maps →</a></div>
        <div class="card">${icon.clock}<h3>When</h3><p>${esc(SITE.collection)}</p><p class="muted">Menus change daily, so check the order page.</p></div>
        ${waUrl ? `<div class="card">${icon.chat}<h3>Questions?</h3><p>Message us on WhatsApp about allergies or anything else.</p><a href="${esc(waUrl)}" target="_blank" rel="noopener">Message us →</a></div>` : ""}
      </div>
    </div>
  </section>
</main>

<footer>
  <img src="/logo-mark-light.svg" alt="" width="34" height="39">
  <p class="foot-name">${esc(SITE.name)}</p>
  <p class="muted">Real food for real families · Orders are taken on <a href="${esc(orderUrl)}" target="_blank" rel="noopener">cart15</a></p>
</footer>

<div class="order-bar"><a class="btn btn-primary block" href="${esc(orderUrl)}" target="_blank" rel="noopener">Order now</a></div>
</body>
</html>`;
}
