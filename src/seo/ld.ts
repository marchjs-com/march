// JSON-LD (schema.org) builders: plain objects with @context, ready for `jsonLd` in a head input.
//   jsonLd: [ld.website({ name: "Shop", url: "https://shop.example" }), ld.breadcrumbs([["Home", "/"], ["Shoes", "/shoes"]], site)]
import type { JsonLd } from "./head.ts";

const CTX = "https://schema.org";
const clean = (o: Record<string, unknown>): JsonLd => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && v !== ""));
const abs = (u: string | undefined, site?: string): string | undefined => (u && site && u.startsWith("/") ? `${site.replace(/\/+$/, "")}${u}` : u);

export interface OrgInput { name: string; url?: string; logo?: string; sameAs?: string[] }
export interface ArticleInput { headline: string; description?: string; image?: string | string[]; datePublished?: string; dateModified?: string; author?: string | { name: string; url?: string }; url?: string }
export interface ProductInput { name: string; description?: string; image?: string | string[]; sku?: string; brand?: string; price?: number | string; currency?: string; availability?: "InStock" | "OutOfStock" | "PreOrder"; rating?: { value: number; count: number } }

export const ld = {
  /** WebSite (optionally with a site search action: `search: "https://x.com/search?q={q}"`). */
  website: (o: { name: string; url: string; search?: string }): JsonLd => clean({
    "@context": CTX, "@type": "WebSite", name: o.name, url: o.url,
    potentialAction: o.search ? { "@type": "SearchAction", target: o.search.replace("{q}", "{search_term_string}"), "query-input": "required name=search_term_string" } : undefined,
  }),
  organization: (o: OrgInput): JsonLd => clean({ "@context": CTX, "@type": "Organization", name: o.name, url: o.url, logo: o.logo, sameAs: o.sameAs?.length ? o.sameAs : undefined }),
  /** Breadcrumbs from [name, path] pairs; relative paths become absolute with `site`. */
  breadcrumbs: (items: readonly (readonly [string, string])[], site?: string): JsonLd => ({
    "@context": CTX, "@type": "BreadcrumbList",
    itemListElement: items.map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item: abs(item, site) })),
  }),
  article: (o: ArticleInput): JsonLd => clean({
    "@context": CTX, "@type": "Article", headline: o.headline, description: o.description, image: o.image, datePublished: o.datePublished,
    dateModified: o.dateModified, mainEntityOfPage: o.url,
    author: o.author ? (typeof o.author === "string" ? { "@type": "Person", name: o.author } : { "@type": "Person", ...o.author }) : undefined,
  }),
  product: (o: ProductInput): JsonLd => clean({
    "@context": CTX, "@type": "Product", name: o.name, description: o.description, image: o.image, sku: o.sku,
    brand: o.brand ? { "@type": "Brand", name: o.brand } : undefined,
    offers: o.price != null ? clean({ "@type": "Offer", price: String(o.price), priceCurrency: o.currency, availability: o.availability ? `${CTX}/${o.availability}` : undefined }) : undefined,
    aggregateRating: o.rating ? { "@type": "AggregateRating", ratingValue: o.rating.value, reviewCount: o.rating.count } : undefined,
  }),
  faq: (items: readonly (readonly [string, string])[]): JsonLd => ({
    "@context": CTX, "@type": "FAQPage",
    mainEntity: items.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }),
};
