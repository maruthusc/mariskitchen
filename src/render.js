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

const londonToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
const longDate = (iso) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(iso + "T00:00:00Z"),
  );

function dietTag(diet) {
  if (!diet) return "";
  return `<span class="tag">${diet === "vegan" ? "Vegan" : "Veg"}</span>`;
}

function renderDish(d) {
  const photo = d.image
    ? `<img class="dish-photo" src="/img/${esc(d.image)}" alt="" loading="lazy" width="72" height="72">`
    : "";
  return `
        <li class="dish${d.available ? "" : " sold-out"}">
          ${photo}
          <div class="dish-body">
            <h4>${esc(d.name)}${dietTag(d.diet)}</h4>
            ${d.desc ? `<p>${esc(d.desc)}</p>` : ""}
          </div>
          <div class="price">${d.from ? "from " : ""}${gbp(d.price)}${d.available ? "" : `<small>Sold out</small>`}</div>
        </li>`;
}

function groupBy(items, fallbackTitle) {
  const groups = [];
  const index = new Map();
  for (const it of items) {
    const key = it.category || fallbackTitle;
    if (!index.has(key)) {
      const g = { title: key, subtitle: null, items: [] };
      index.set(key, g);
      groups.push(g);
    }
    index.get(key).items.push(it);
  }
  return groups;
}

function renderGroups(groups) {
  return groups
    .map(
      (g) => `
      <div class="group">
        <div class="group-head"><h4 class="group-title">${esc(g.title)}</h4>${g.subtitle ? `<p>${esc(g.subtitle)}</p>` : ""}</div>
        <ul class="dishes">${g.items.map(renderDish).join("")}</ul>
      </div>`,
    )
    .join("");
}

// A live menu published on cart15.
function renderLiveMenu(m, fallbackOrderUrl) {
  const meta = [
    m.pickupStart && m.pickupEnd ? `<div><dt>Collect</dt><dd>${esc(formatWindow(m.pickupStart, m.pickupEnd))}</dd></div>` : "",
    m.cutoffAt ? `<div><dt>Order by</dt><dd>${esc(formatCutoff(m.cutoffAt))}</dd></div>` : "",
  ].join("");
  return `
    <article class="menu-card">
      <h3>${esc(m.title)}</h3>
      ${m.description ? `<p class="menu-desc">${esc(m.description)}</p>` : ""}
      ${meta ? `<dl class="meta">${meta}</dl>` : ""}
      ${m.offers.length ? `<ul class="offers" aria-label="Offers">${m.offers.map((o) => `<li>${esc(o)}</li>`).join("")}</ul>` : ""}
      ${renderGroups(groupBy(m.items, "Menu"))}
      <a class="btn btn-primary block" href="${esc(m.orderUrl || fallbackOrderUrl)}" target="_blank" rel="noopener">Order this menu</a>
    </article>`;
}

// The static menu kept in R2 (menu.json), shown when nothing is open on cart15.
function renderStaticMenu(menu, SITE) {
  const isToday = menu.date === londonToday();
  const dateLabel = menu.date ? longDate(menu.date) : "";
  const groups = menu.sections.map((s) => ({
    title: s.title,
    subtitle: s.subtitle,
    items: s.items.map((i) => ({
      name: i.name,
      desc: i.desc,
      price: i.price,
      from: false,
      diet: i.veg === true ? "veg" : null,
      available: !i.soldOut,
      image: i.image,
    })),
  }));
  return `
    <article class="menu-card">
      <h3>${esc(menu.title)}${dateLabel ? ` <small>${esc(dateLabel)}</small>` : ""}</h3>
      <p class="banner">${
        isToday
          ? `Nothing is open for online orders at the moment — here is what Mari's Kitchen cooks.`
          : `Nothing is open for online orders right now. This was our menu on <strong>${esc(dateLabel)}</strong>; dishes change daily.`
      } Tap order to see the latest on cart15.</p>
      <dl class="meta"><div><dt>Collect</dt><dd>${esc(SITE.collection)}</dd></div></dl>
      ${renderGroups(groups)}
      <a class="btn btn-primary block" href="${esc(SITE.cart15Url)}" target="_blank" rel="noopener">Go to order page</a>
    </article>`;
}

export function renderPage({ SITE, menu, menus = [] }) {
  const orderUrl = SITE.cart15Url;
  const pc = esc(SITE.postcode);
  const mapLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(SITE.postcode)}`;
  const waUrl = SITE.whatsappHref ? `${SITE.whatsappHref}?text=${encodeURIComponent(`Hi ${SITE.name}! I have a question.`)}` : "";
  const live = menus.length > 0;

  const menuHtml = live
    ? menus.map((m) => renderLiveMenu(m, orderUrl)).join("")
    : renderStaticMenu(menu, SITE);

  const ld = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: SITE.name,
    servesCuisine: ["South Indian", "Tamil"],
    description: "Homemade traditional South Indian food, ordered online and collected fresh.",
    address: { "@type": "PostalAddress", postalCode: SITE.postcode, addressCountry: "GB" },
    hasMenu: orderUrl,
  }).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(SITE.name)} — Homemade South Indian Food, Cambridge</title>
<meta name="description" content="Traditional homemade South Indian food — idly, idiyappam, kulambu, Chicken 65 and more. Order online and collect fresh.">
<meta name="theme-color" content="#1f5d3a">
<meta property="og:title" content="${esc(SITE.name)} — Homemade South Indian Food">
<meta property="og:description" content="Traditional homemade South Indian lunches. Order online, collect fresh.">
<meta property="og:type" content="website">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/style.css">
<script type="application/ld+json">${ld}</script>
</head>
<body>
<a class="skip" href="#menu">Skip to menu</a>

<header class="top">
  <a class="brand" href="#top" aria-label="${esc(SITE.name)} home">
    <img src="/favicon.svg" alt="" width="34" height="34"><span>${esc(SITE.name)}</span>
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
    <div class="hero-text">
      <p class="eyebrow">Traditional South Indian · Homemade</p>
      <h1>Home-cooked Tamil food, <em>made fresh</em> for you.</h1>
      <p class="tamil" lang="ta">வீட்டுச் சாப்பாடு — அன்போடு சமைத்தது</p>
      <p class="lead">Soft idlies, fluffy idiyappam, tangy kulambu and crispy fries — cooked in small batches and ready for collection.</p>
      <div class="hero-cta">
        <a class="btn btn-primary" href="${esc(orderUrl)}" target="_blank" rel="noopener">Order now</a>
        <a class="btn btn-ghost" href="#menu">See the menu</a>
      </div>
      <ul class="facts">
        <li><span aria-hidden="true">🕐</span> ${esc(SITE.collection)}</li>
        <li><span aria-hidden="true">📍</span> Collection from ${pc}</li>
      </ul>
    </div>
    <div class="hero-art" aria-hidden="true">${plateSvg()}</div>
  </section>

  <section class="menu" id="menu">
    <div class="wrap">
      <p class="eyebrow">${live ? "Open for orders" : "Our kitchen"}</p>
      <h2>On the menu</h2>
      ${menuHtml}
      <p class="allergy"><strong>Allergies?</strong> ${esc(menu.note)} Allergen details are on the order page.</p>
    </div>
  </section>

  <section class="how" id="how">
    <div class="wrap">
      <p class="eyebrow">Simple as 1-2-3</p>
      <h2>How to order</h2>
      <ol class="steps">
        <li><b>1</b><div><h3>Pick your dishes</h3><p>Choose from the menu on our order page.</p></div></li>
        <li><b>2</b><div><h3>Order before the cut-off</h3><p>Each menu closes at its cut-off time, so order early.</p></div></li>
        <li><b>3</b><div><h3>Collect it fresh</h3><p>Pick up from ${pc} in the collection window shown on the menu.</p></div></li>
      </ol>
    </div>
  </section>

  <section class="visit" id="visit">
    <div class="wrap">
      <p class="eyebrow">Find us</p>
      <h2>Collection</h2>
      <div class="cards">
        <div class="card"><h3>📍 Where</h3><p>Collection venue<br><strong>${pc}</strong></p><a href="${esc(mapLink)}" target="_blank" rel="noopener">Open in Maps →</a></div>
        <div class="card"><h3>⏰ When</h3><p>${esc(SITE.collection)}</p><p class="muted">Menus change daily — check above.</p></div>
        ${
          waUrl
            ? `<div class="card"><h3>💬 Questions?</h3><p>Message us on WhatsApp about allergies or anything else.</p><a href="${esc(waUrl)}" target="_blank" rel="noopener">Message us →</a></div>`
            : ""
        }
      </div>
    </div>
  </section>
</main>

<footer>
  <p>${esc(SITE.name)} · Homemade South Indian food</p>
  <p class="muted">Orders are taken on <a href="${esc(orderUrl)}" target="_blank" rel="noopener">cart15</a>.</p>
</footer>

<div class="order-bar"><a class="btn btn-primary block" href="${esc(orderUrl)}" target="_blank" rel="noopener">Order now</a></div>
</body>
</html>`;
}

function plateSvg() {
  return `<svg viewBox="0 0 320 320" role="presentation">
  <defs>
    <radialGradient id="pl" cx="50%" cy="45%" r="60%"><stop offset="0" stop-color="#fffaf0"/><stop offset="1" stop-color="#f0e2c0"/></radialGradient>
  </defs>
  <circle cx="160" cy="160" r="150" fill="#1f5d3a"/>
  <circle cx="160" cy="160" r="138" fill="none" stroke="#e8a317" stroke-width="2" stroke-dasharray="2 8" stroke-linecap="round"/>
  <circle cx="160" cy="160" r="122" fill="url(#pl)"/>
  <circle cx="160" cy="160" r="104" fill="none" stroke="#e8d3a0" stroke-width="1.5"/>
  <circle cx="160" cy="160" r="38" fill="#fff"/><circle cx="160" cy="160" r="30" fill="#f6efe0"/>
  <circle cx="148" cy="154" r="12" fill="#fff" stroke="#e6dcc3"/><circle cx="170" cy="152" r="12" fill="#fff" stroke="#e6dcc3"/><circle cx="159" cy="171" r="12" fill="#fff" stroke="#e6dcc3"/>
  <circle cx="160" cy="76" r="26" fill="#b8321e"/><circle cx="160" cy="76" r="19" fill="#d4492e"/>
  <circle cx="244" cy="160" r="26" fill="#e8a317"/><circle cx="244" cy="160" r="19" fill="#f2bd45"/>
  <circle cx="160" cy="244" r="26" fill="#8a5a2b"/><circle cx="160" cy="244" r="19" fill="#a8733d"/>
  <circle cx="76" cy="160" r="26" fill="#4f8a3a"/><circle cx="76" cy="160" r="19" fill="#6aa551"/>
  <g fill="#fff" opacity=".35"><circle cx="102" cy="102" r="5"/><circle cx="218" cy="102" r="5"/><circle cx="218" cy="218" r="5"/><circle cx="102" cy="218" r="5"/></g>
</svg>`;
}
