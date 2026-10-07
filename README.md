# Mari's Kitchen

One-page, mobile-first website for Mari's Kitchen: homemade traditional South Indian food, collected fresh.
Built on **Cloudflare Workers** with **R2**. Orders are taken on **cart15**, the same setup as the Chef Kamal site.

## How it works

- `src/worker.js` renders the page on the server (no client JS needed) and serves static files from `public/`.
- **Menu**: read live from cart15's public API, `GET {cart15}/api/public/kitchens/{CART15_SELLER}/menus` (cached 5 minutes).
  Dishes, prices, offers, cut-off and collection times come from cart15 as published. Every **Order** button opens
  the menu's cart15 order page (or the storefront, `SITE.cart15Url`).
- **R2** (`maris-kitchen` bucket) holds:
  - `menu.json`: the static fallback menu shown when nothing is open on cart15 or cart15 is down (seeded from `menu/menu.json`).
  - `img/<file>`: optional dish photos, served at `/img/<file>`. Reference one from a dish with `"image": "<file>"`.
- No quote or catering feature for now.

## Names (same as chefkamal)

| Name | Where | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_CART15_URL` | Worker var | cart15 host. Leave unset for production (`https://www.cart15.com`); set for staging. |
| `NEXT_PUBLIC_SITE_URL` | Worker var | Public site URL. |
| `CART15_BASE`, `CART15_SELLER`, `TIMEZONE` | `src/config.js` | cart15 host, Mari's cart15 handle, display timezone (`UTC`, as cart15 already adjusts times). |
| `SITE` (`cart15Url`, `whatsappHref`, ...) | `src/config.js` | Public contact details and business constants. |
| `getOpenMenus()` | `src/cart15.js` | Menus open for orders on cart15. |

## TODO before launch

- [ ] Confirm Mari's cart15 handle and set `CART15_SELLER` in `src/config.js` (currently `maris-kitchen`).
- [ ] Set `SITE.whatsappHref` (e.g. `https://wa.me/447xxxxxxxxx`) to show the "Questions?" card.
- [ ] Confirm the venue postcode (`CB4 3JD`) and collection times in `SITE`.

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars   # optional: point at cart15 staging
npm run dev                      # seeds local R2 with menu/menu.json, then http://localhost:8787
```

## Deploy

```sh
npx wrangler r2 bucket create maris-kitchen   # once
npm run menu:upload                           # push menu/menu.json to R2
npm run deploy
```

Update the fallback menu by editing `menu/menu.json` and running `npm run menu:upload`; no redeploy needed.
Upload a dish photo with `npx wrangler r2 object put maris-kitchen/img/idly.jpg --file idly.jpg --remote`.
