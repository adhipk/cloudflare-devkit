import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const source = "https://ffppod.com/research";
const out = "public/ffp-pod/rss.xml";
const res = await fetch(source);
if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
const html = await res.text();

const seen = new Set();
const items = [];
for (const match of html.matchAll(/<a\s+[^>]*href=["'](\/research\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
  const href = match[1];
  const slug = href.split("/").filter(Boolean).at(-1);
  if (!slug || seen.has(slug)) continue;
  seen.add(slug);
  const text = clean(match[2]);
  const parsed = parseCard(text, slug);
  items.push({ ...parsed, url: `https://ffppod.com${href}` });
}

items.sort((a, b) => (b.isoDate || "").localeCompare(a.isoDate || ""));

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>From First Principles Research</title>
    <link>${source}</link>
    <description>Research papers featured by From First Principles.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://api.adhipk.dev/ffp-pod/rss.xml" rel="self" type="application/rss+xml" />
${items.map(itemXml).join("\n")}
  </channel>
</rss>
`;

await mkdir(dirname(out), { recursive: true });
await writeFile(out, xml);
console.log(`wrote ${items.length} items`);

function parseCard(text, slug) {
  const m = text.match(/^(.+?)\s+·\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+(.+)$/);
  if (!m) return { title: titleFromSlug(slug), description: text };
  const journal = m[1].trim();
  const isoDate = toIsoDate(m[2]);
  const rest = m[3].trim();
  const splitAt = rest.search(/\s+(Imagine|Scientists|This|The|Researchers|A|An|In|For|Under|Universal|Room-temperature|NASA|Think)\b/);
  const title = splitAt > 20 ? rest.slice(0, splitAt).trim() : rest;
  const summary = splitAt > 20 ? rest.slice(splitAt).trim() : "";
  return { title, isoDate, description: [journal, summary].filter(Boolean).join(". ") };
}

function itemXml(item) {
  const pubDate = item.isoDate ? `\n      <pubDate>${new Date(`${item.isoDate}T00:00:00Z`).toUTCString()}</pubDate>` : "";
  return `    <item>
      <title>${esc(item.title)}</title>
      <link>${esc(item.url)}</link>
      <guid isPermaLink="true">${esc(item.url)}</guid>${pubDate}
      <description>${esc(item.description || item.title)}</description>
    </item>`;
}

function clean(s) {
  return s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function toIsoDate(s) {
  const t = Date.parse(s);
  return Number.isNaN(t) ? "" : new Date(t).toISOString().slice(0, 10);
}

function titleFromSlug(slug) {
  return slug.split("-").map(w => w ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
