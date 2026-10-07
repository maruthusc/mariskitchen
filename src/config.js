// Single source of truth for public contact details and business constants (mirrors chefkamal's lib/config.ts).

/** cart15 host. NEXT_PUBLIC_CART15_URL is a Worker var (see wrangler.jsonc / .dev.vars); a staging deploy points at
 *  staging and production leaves it unset. Everything cart15-related (links and the menu API) derives from this. */
export const cart15Base = (env) => (env.NEXT_PUBLIC_CART15_URL || "https://www.cart15.com").replace(/\/$/, "");
/** cart15 already adjusts its menu times for the kitchen's local time, so they are shown as returned (UTC), with no further conversion. */
export const TIMEZONE = "UTC";
/** Mari's Kitchen business handle on cart15 (cart15.com/{handle}). TODO: confirm the real handle. */
export const CART15_SELLER = "maris-kitchen";

export function getConfig(env) {
  const CART15_BASE = cart15Base(env);
  const SITE = {
    name: "Mari's Kitchen",
    shortName: "Mari's",
    kitchen: "Mari's Kitchen",
    /** Public site URL. Optional: when unset, absolute URLs (og:image, canonical) use the origin the page is served from. */
    url: (env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, ""),
    tagline: "Homemade traditional South Indian food, cooked fresh for collection.",
    postcode: "CB4 3JD",
    collection: "Lunch 1:00 PM – 1:30 PM",
    // TODO: add Mari's WhatsApp number (digits with country code, e.g. 447xxxxxxxxx). The "Questions?" card stays hidden until set.
    whatsappHref: "",
    /** Mari's cart15 storefront: all orders are taken here. */
    cart15Url: `${CART15_BASE}/${CART15_SELLER}`,
  };
  return { CART15_BASE, SITE };
}
