type ResearchItem = {
  slug: string;
  url: string;
  title: string;
  journal?: string;
  publishedAt?: string;
  publishedLabel?: string;
  summary?: string;
  tags: string[];
};

type ResearchDetail = ResearchItem & {
  doi?: string;
  paperUrl?: string;
  tldr?: string;
  abstract?: string;
  keyTakeaways: string[];
  featuredIn: FeaturedEpisode[];
};

type FeaturedEpisode = {
  slug: string;
  title: string;
  date?: string;
  url: string;
};

const SOURCE_ORIGIN = "https://ffppod.com";
const SOURCE_RESEARCH_URL = `${SOURCE_ORIGIN}/research`;
const API_PREFIX = "/ffp-pod";
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export default {
  async fetch(request: Request): Promise<Response> {
    try {
      if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
      if (request.method !== "GET") return json({ error: "Method not allowed" }, 405);

      const url = new URL(request.url);
      const path = normalizePath(url.pathname);

      if (path === API_PREFIX || path === `${API_PREFIX}/`) return json(indexResponse(request));
      if (path === `${API_PREFIX}/health`) return json({ ok: true, source: SOURCE_RESEARCH_URL });
      if (path === `${API_PREFIX}/openapi.json`) return json(openApiSpec(request));
      if (path === `${API_PREFIX}/research`) return listResearch(url);
      if (path === `${API_PREFIX}/search`) return searchResearch(url);

      const detailMatch = path.match(/^\/ffp-pod\/research\/([^/]+)$/);
      if (detailMatch) return researchDetail(detailMatch[1]);

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: "Internal error", message: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
};

async function listResearch(url: URL): Promise<Response> {
  const items = await getResearchIndex();
  const { limit, offset } = pagination(url);
  return json({ total: items.length, limit, offset, items: items.slice(offset, offset + limit) });
}

async function searchResearch(url: URL): Promise<Response> {
  const q = clean(url.searchParams.get("q"));
  const journal = clean(url.searchParams.get("journal"));
  const tag = clean(url.searchParams.get("tag"));
  const from = clean(url.searchParams.get("from"));
  const to = clean(url.searchParams.get("to"));
  const includeDetails = clean(url.searchParams.get("include")) === "details";
  const { limit, offset } = pagination(url);

  let items = await getResearchIndex();

  if (q) {
    const terms = tokenize(q);
    items = items
      .map((item) => ({ item, score: scoreItem(item, terms) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || compareDatesDesc(a.item.publishedAt, b.item.publishedAt))
      .map(({ item }) => item);
  } else {
    items = items.sort((a, b) => compareDatesDesc(a.publishedAt, b.publishedAt));
  }

  if (journal) items = items.filter((item) => item.journal?.toLowerCase().includes(journal.toLowerCase()));
  if (tag) items = items.filter((item) => item.tags.some((candidate) => candidate.toLowerCase().includes(tag.toLowerCase())));
  if (from) items = items.filter((item) => !item.publishedAt || item.publishedAt >= from);
  if (to) items = items.filter((item) => !item.publishedAt || item.publishedAt <= to);

  const page = items.slice(offset, offset + limit);
  if (!includeDetails) return json({ total: items.length, limit, offset, items: page });

  const detailed = await Promise.all(page.map((item) => getResearchDetail(item.slug)));
  return json({ total: items.length, limit, offset, items: detailed });
}

async function researchDetail(slug: string): Promise<Response> {
  const detail = await getResearchDetail(slug);
  if (!detail) return json({ error: "Research item not found" }, 404);
  return json(detail);
}

async function getResearchIndex(): Promise<ResearchItem[]> {
  const html = await cachedText(SOURCE_RESEARCH_URL, 60 * 15);
  return parseResearchIndex(html);
}

async function getResearchDetail(slug: string): Promise<ResearchDetail | null> {
  const index = await getResearchIndex();
  const base = index.find((item) => item.slug === slug);
  const html = await cachedText(`${SOURCE_RESEARCH_URL}/${slug}`, 60 * 60);
  const parsed = parseResearchDetail(html, slug);
  if (!parsed && !base) return null;
  return { ...(base ?? parsed!), ...(parsed ?? {}), slug, url: `${SOURCE_RESEARCH_URL}/${slug}` };
}

function parseResearchIndex(html: string): ResearchItem[] {
  const anchors = [...html.matchAll(/<a\s+[^>]*href=["'](\/research\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const seen = new Set<string>();
  const items: ResearchItem[] = [];

  for (const [, href, innerHtml] of anchors) {
    const slug = href.split("/").filter(Boolean).pop();
    if (!slug || seen.has(slug) || slug === "research") continue;
    seen.add(slug);

    const text = collapse(decodeHtml(stripTags(innerHtml)));
    const parsed = parseCardText(text);
    items.push({
      slug,
      url: `${SOURCE_ORIGIN}${href}`,
      title: parsed.title || titleFromSlug(slug),
      journal: parsed.journal,
      publishedAt: parsed.publishedAt,
      publishedLabel: parsed.publishedLabel,
      summary: parsed.summary,
      tags: parsed.tags,
    });
  }

  return items;
}

function parseCardText(text: string): Omit<ResearchItem, "slug" | "url"> {
  const dateMatch = text.match(/^(.+?)\s+·\s+([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4})\s+(.+)$/);
  if (!dateMatch) return { title: text, tags: [] };

  const journal = dateMatch[1].trim();
  const publishedLabel = dateMatch[2].trim();
  const rest = dateMatch[3].trim();
  const publishedAt = parsePublishedDate(publishedLabel);

  const split = splitTitleAndSummary(rest);
  const tags = inferTags(rest);
  return {
    journal,
    publishedAt,
    publishedLabel,
    title: split.title,
    summary: split.summary,
    tags,
  };
}

function splitTitleAndSummary(text: string): { title: string; summary?: string } {
  const sentenceStart = text.search(/\s+(Imagine|Scientists|This|The|Researchers|A|An|In|For|Under|Universal|Room-temperature|NASA|Think)\b/);
  if (sentenceStart > 20) {
    return { title: text.slice(0, sentenceStart).trim(), summary: text.slice(sentenceStart).trim() };
  }
  return { title: text.trim() };
}

function inferTags(text: string): string[] {
  const tail = text.match(/([A-Za-z][A-Za-z\-/ ]{2,80})$/)?.[1]?.trim();
  if (!tail || tail.length > 80) return [];
  const bad = /^(Earth|Read more|Think|This|They|Scientists|Researchers)$/i;
  if (bad.test(tail)) return [];
  return tail
    .split(/\s{2,}|,\s*/)
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 2 && tag.length < 60)
    .slice(0, 8);
}

function parseResearchDetail(html: string, slug: string): ResearchDetail | null {
  const mainText = collapse(decodeHtml(stripTags(html)));
  const h1 = decodeHtml(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ? stripTags(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)![1]) : "").trim();
  const title = h1 || titleFromSlug(slug);
  const journalDate = mainText.match(new RegExp(`${escapeRegex(title)}\\s+([^·]{2,80})·([A-Z][a-z]{2,}\\s+\\d{1,2},\\s+\\d{4})`));
  const doi = mainText.match(/DOI:\s*([^\s]+)/i)?.[1];
  const paperHref = html.match(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>\s*Read the paper\s*<\/a>/i)?.[1];

  return {
    slug,
    url: `${SOURCE_RESEARCH_URL}/${slug}`,
    title,
    journal: journalDate?.[1]?.trim(),
    publishedLabel: journalDate?.[2]?.trim(),
    publishedAt: journalDate?.[2] ? parsePublishedDate(journalDate[2]) : undefined,
    doi,
    paperUrl: paperHref ? absolutize(paperHref) : undefined,
    tldr: section(mainText, "TL;DR", ["Abstract", "Key Takeaways", "Featured In"]),
    abstract: section(mainText, "Abstract", ["Key Takeaways", "Featured In"]),
    keyTakeaways: numberedSection(mainText, "Key Takeaways", ["Featured In"]),
    featuredIn: parseFeaturedEpisodes(html),
    summary: section(mainText, "TL;DR", ["Abstract", "Key Takeaways", "Featured In"]),
    tags: inferTags(mainText),
  };
}

function parseFeaturedEpisodes(html: string): FeaturedEpisode[] {
  return [...html.matchAll(/<a\s+[^>]*href=["'](\/episodes\/[^"'#?]+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map(([, href, inner]) => {
      const text = collapse(decodeHtml(stripTags(inner)));
      const date = text.match(/\b[A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}\b/)?.[0];
      return { slug: href.split("/").filter(Boolean).pop() ?? "", title: text, date, url: `${SOURCE_ORIGIN}${href}` };
    })
    .filter((episode) => episode.slug && episode.title)
    .slice(0, 10);
}

function section(text: string, heading: string, nextHeadings: string[]): string | undefined {
  const start = text.indexOf(heading);
  if (start < 0) return undefined;
  const bodyStart = start + heading.length;
  let end = text.length;
  for (const next of nextHeadings) {
    const candidate = text.indexOf(next, bodyStart);
    if (candidate >= 0 && candidate < end) end = candidate;
  }
  return collapse(text.slice(bodyStart, end)) || undefined;
}

function numberedSection(text: string, heading: string, nextHeadings: string[]): string[] {
  const body = section(text, heading, nextHeadings);
  if (!body) return [];
  return body
    .split(/\s+(?=\d+\s+)/)
    .map((line) => line.replace(/^\d+\s+/, "").trim())
    .filter(Boolean);
}

async function cachedText(url: string, ttlSeconds: number): Promise<string> {
  const cache = caches.default;
  const cacheKey = new Request(url, { method: "GET" });
  const cached = await cache.match(cacheKey);
  if (cached) return cached.text();

  const response = await fetch(url, { headers: { "user-agent": "ffp-pod-search-api/0.1" } });
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  const text = await response.text();
  await cache.put(cacheKey, new Response(text, { headers: { "cache-control": `public, max-age=${ttlSeconds}` } }));
  return text;
}

function scoreItem(item: ResearchItem, terms: string[]): number {
  const fields = [item.title, item.journal, item.summary, item.tags.join(" ")].filter(Boolean).join(" ").toLowerCase();
  return terms.reduce((score, term) => {
    if (item.title.toLowerCase().includes(term)) return score + 8;
    if (item.tags.some((tag) => tag.toLowerCase().includes(term))) return score + 5;
    if (fields.includes(term)) return score + 2;
    return score;
  }, 0);
}

function pagination(url: URL): { limit: number; offset: number } {
  const limit = clamp(parseInt(url.searchParams.get("limit") || String(DEFAULT_LIMIT), 10), 1, MAX_LIMIT);
  const offset = Math.max(0, parseInt(url.searchParams.get("offset") || "0", 10) || 0);
  return { limit, offset };
}

function json(data: unknown, status = 200): Response {
  return cors(new Response(JSON.stringify(data, null, 2), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=60" } }));
}

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", "*");
  headers.set("access-control-allow-methods", "GET, OPTIONS");
  headers.set("access-control-allow-headers", "content-type");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function normalizePath(pathname: string): string {
  return pathname.replace(/\/+$/, "") || "/";
}

function clean(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((term) => term.length > 1);
}

function stripTags(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ");
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parsePublishedDate(label: string): string | undefined {
  const timestamp = Date.parse(label);
  if (Number.isNaN(timestamp)) return undefined;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function compareDatesDesc(a?: string, b?: string): number {
  return (b ?? "").localeCompare(a ?? "");
}

function titleFromSlug(slug: string): string {
  return slug.split("-").map((word) => word ? word[0].toUpperCase() + word.slice(1) : word).join(" ");
}

function absolutize(href: string): string {
  return href.startsWith("http") ? href : `${SOURCE_ORIGIN}${href.startsWith("/") ? "" : "/"}${href}`;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function indexResponse(request: Request): unknown {
  const origin = new URL(request.url).origin;
  return {
    name: "FFP Pod Research Search API",
    source: SOURCE_RESEARCH_URL,
    endpoints: {
      health: `${origin}${API_PREFIX}/health`,
      list: `${origin}${API_PREFIX}/research`,
      search: `${origin}${API_PREFIX}/search?q=ketamine`,
      detail: `${origin}${API_PREFIX}/research/bulk-hexagonal-diamond`,
      openapi: `${origin}${API_PREFIX}/openapi.json`,
    },
  };
}

function openApiSpec(request: Request): unknown {
  const base = `${new URL(request.url).origin}${API_PREFIX}`;
  return {
    openapi: "3.1.0",
    info: { title: "FFP Pod Research Search API", version: "0.1.0" },
    servers: [{ url: base }],
    paths: {
      "/research": { get: { summary: "List research papers", parameters: paginationParams() } },
      "/search": { get: { summary: "Search research papers", parameters: [{ name: "q", in: "query", schema: { type: "string" } }, { name: "tag", in: "query", schema: { type: "string" } }, { name: "journal", in: "query", schema: { type: "string" } }, { name: "from", in: "query", schema: { type: "string", format: "date" } }, { name: "to", in: "query", schema: { type: "string", format: "date" } }, { name: "include", in: "query", schema: { type: "string", enum: ["details"] } }, ...paginationParams()] } },
      "/research/{slug}": { get: { summary: "Get one research paper detail", parameters: [{ name: "slug", in: "path", required: true, schema: { type: "string" } }] } },
      "/health": { get: { summary: "Health check" } },
    },
  };
}

function paginationParams(): unknown[] {
  return [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: MAX_LIMIT } }, { name: "offset", in: "query", schema: { type: "integer", minimum: 0 } }];
}
